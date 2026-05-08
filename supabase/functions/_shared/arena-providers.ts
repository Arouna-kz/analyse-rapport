// Shared helper to merge admin-configured Arena providers (DB) with frontend-provided models.
// Used by all edge functions that support Arena multi-model consensus.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

export interface ArenaModel {
  id: string;
  name: string;
  provider?: string;
  baseUrl: string;
  modelName?: string;
  apiKey?: string;
  isLovableAI: boolean;
  enabled?: boolean;
}

// Normalize a provider's base_url into a chat-completions endpoint
export function buildEndpointUrl(provider_type: string, base_url: string): string {
  const trimmed = (base_url || '').replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.includes('/chat/completions')) return trimmed;
  if (provider_type === 'ollama') return `${trimmed}/v1/chat/completions`;
  if (provider_type === 'gemini') {
    return `${trimmed.includes('/v1beta/openai') ? trimmed : trimmed + '/v1beta/openai'}/chat/completions`;
  }
  return trimmed.endsWith('/v1') ? `${trimmed}/chat/completions` : `${trimmed}/v1/chat/completions`;
}

/**
 * Merge admin-configured Arena providers (from DB, shared globally)
 * with the user's local model selection from the frontend payload.
 * Admin providers are always added when enabled, unless already present (by id).
 */
export async function mergeAdminArenaProviders(userModels: ArenaModel[]): Promise<ArenaModel[]> {
  const merged: ArenaModel[] = [...(userModels || [])];

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: dbProviders, error } = await adminClient
      .from('arena_providers')
      .select('id, name, provider_type, base_url, model_name, api_key')
      .eq('enabled', true)
      .order('priority', { ascending: true });

    if (error) {
      console.error('mergeAdminArenaProviders: DB fetch error', error);
      return merged;
    }

    if (dbProviders && dbProviders.length > 0) {
      for (const p of dbProviders as Array<{
        id: string; name: string; provider_type: string; base_url: string;
        model_name: string; api_key: string | null;
      }>) {
        const id = `db-${p.id}`;
        if (merged.some(m => m.id === id)) continue;
        merged.push({
          id,
          name: p.name,
          provider: p.provider_type,
          baseUrl: buildEndpointUrl(p.provider_type, p.base_url),
          modelName: p.model_name,
          apiKey: p.api_key || (p.provider_type === 'ollama' ? 'ollama' : ''),
          isLovableAI: false,
          enabled: true,
        });
      }
      console.log(`Arena: merged ${dbProviders.length} admin-configured provider(s) from DB`);
    }
  } catch (e) {
    console.error('mergeAdminArenaProviders failed:', e);
  }

  return merged;
}

/**
 * Filter to only models that can actually be called:
 * - Lovable AI models (use gateway), or
 * - Models with baseUrl + (apiKey OR ollama provider)
 */
export function filterCallableModels(models: ArenaModel[]): ArenaModel[] {
  return (models || []).filter(m =>
    m.isLovableAI || (m.baseUrl && (m.provider === 'ollama' || m.apiKey))
  );
}

/**
 * Public list of admin providers (for read-only display in user UI).
 * Returns only safe fields — no API keys.
 */
export async function listPublicAdminProviders() {
  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data } = await adminClient
      .from('arena_providers')
      .select('id, name, provider_type, model_name, enabled, role_description, priority')
      .eq('enabled', true)
      .order('priority', { ascending: true });
    return data || [];
  } catch (e) {
    console.error('listPublicAdminProviders failed:', e);
    return [];
  }
}
