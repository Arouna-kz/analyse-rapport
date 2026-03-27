import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { callAI, handleAIError, getAIProviderConfig } from '../_shared/ai-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, conversationId, images, conversationHistory } = await req.json();

    // Build messages array with conversation history
    const messages: any[] = [
      { 
        role: 'system', 
        content: `Tu es un assistant IA spécialisé dans l'analyse de rapports et documents. 
Tu aides les utilisateurs à comprendre leurs documents, extraire des insights et générer des prévisions.
Tu peux analyser des images et des documents joints.
Réponds toujours de manière professionnelle et détaillée en français.` 
      }
    ];

    // Add conversation history for context
    if (conversationHistory && Array.isArray(conversationHistory)) {
      messages.push(...conversationHistory);
    }

    // Build user message content
    if (images && images.length > 0) {
      const content: any[] = [{ type: 'text', text: message || 'Analyse les fichiers joints.' }];
      
      for (const imageData of images) {
        content.push({
          type: 'image_url',
          image_url: { url: imageData }
        });
      }
      
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: 'user', content: message || 'Bonjour' });
    }

    const config = getAIProviderConfig();
    console.log('Calling AI with provider:', Deno.env.get('AI_PROVIDER') || 'lovable');
    
    const response = await callAI({
      messages,
      model: 'google/gemini-2.5-flash',
      temperature: 0.7,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requêtes atteinte, réessayez plus tard.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Crédits insuffisants, veuillez ajouter des fonds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: `AI error: ${response.status}`, details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'Désolé, je n\'ai pas pu générer une réponse.';

    console.log('AI response received successfully');

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in chat function:', error);
    return handleAIError(error, corsHeaders);
  }
});
