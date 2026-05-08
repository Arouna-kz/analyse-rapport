import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestPayload {
  // Either an existing provider id (test stored config) ...
  providerId?: string;
  // ... or an inline provider (test before saving)
  inline?: {
    provider_type: 'openai' | 'gemini' | 'ollama' | 'custom';
    base_url: string;
    model_name: string;
    api_key?: string;
  };
}

function buildEndpointUrl(provider_type: string, base_url: string): string {
  // Normalize: if base_url doesn't already include /chat/completions, append the appropriate path
  const trimmed = base_url.replace(/\/+$/, '');
  if (trimmed.includes('/chat/completions')) return trimmed;
  if (provider_type === 'ollama') return `${trimmed}/v1/chat/completions`;
  if (provider_type === 'gemini') return `${trimmed.includes('/v1beta/openai') ? trimmed : trimmed + '/v1beta/openai'}/chat/completions`;
  // openai / custom: assume root is the v1 base
  return trimmed.endsWith('/v1') ? `${trimmed}/chat/completions` : `${trimmed}/v1/chat/completions`;
}

async function pingProvider(p: { provider_type: string; base_url: string; model_name: string; api_key?: string }) {
  const url = buildEndpointUrl(p.provider_type, p.base_url);
  const apiKey = p.api_key || (p.provider_type === 'ollama' ? 'ollama' : '');

  if (!url) throw new Error('URL de base manquante');
  if (!apiKey && p.provider_type !== 'ollama') throw new Error('Clé API manquante');
  if (!p.model_name) throw new Error('Nom du modèle manquant');

  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: p.model_name,
        messages: [
          { role: 'system', content: 'Reply with the single word: OK' },
          { role: 'user', content: 'ping' }
        ],
        temperature: 0,
        max_tokens: 5,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}${text ? ` — ${text.slice(0, 200)}` : ''}`);
    }
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';
    return {
      status: 'success' as const,
      message: `Connexion réussie. Réponse modèle: "${String(reply).slice(0, 80)}"`,
      latencyMs,
    };
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : 'Erreur inconnue';
    return { status: 'error' as const, message: msg, latencyMs: Date.now() - start };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentification requise' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await userClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Authentification invalide' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = claimsData.claims.sub;

    // Vérifier le rôle admin
    const { data: roles } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'super_admin']);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Accès admin requis' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = (await req.json()) as TestPayload;

    // Use service role to read full provider config (with API key) when given an ID
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let target: { provider_type: string; base_url: string; model_name: string; api_key?: string };

    if (body.providerId) {
      const { data, error } = await adminClient
        .from('arena_providers')
        .select('provider_type, base_url, model_name, api_key')
        .eq('id', body.providerId)
        .maybeSingle();
      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Fournisseur introuvable' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      target = data as typeof target;
    } else if (body.inline) {
      target = body.inline;
    } else {
      return new Response(JSON.stringify({ error: 'providerId ou inline requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await pingProvider(target);

    // If testing a stored provider, persist the test result
    if (body.providerId) {
      await adminClient
        .from('arena_providers')
        .update({
          last_test_status: result.status,
          last_test_message: result.message,
          last_test_latency_ms: result.latencyMs,
          last_test_at: new Date().toISOString(),
        })
        .eq('id', body.providerId);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : 'Erreur lors du test'
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
