import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { getAIProviderConfig, MODEL_API_NAMES } from '../_shared/ai-provider.ts';
import { mergeAdminArenaProviders, filterCallableModels } from '../_shared/arena-providers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIModel {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  modelName?: string;
  apiKey?: string;
  isLovableAI: boolean;
}

interface ModelResponse {
  modelId: string;
  modelName: string;
  response: string;
  confidence: number;
  processingTime: number;
  status: 'success' | 'error';
  errorMessage?: string;
}

function resolveModelEndpoint(model: AIModel): { url: string; apiKey: string; modelName: string } {
  const globalConfig = getAIProviderConfig();

  // Lovable AI models always use the gateway
  if (model.isLovableAI) {
    const modelName = model.modelName || MODEL_API_NAMES[model.id] || 'google/gemini-2.5-flash';
    return {
      url: globalConfig.baseUrl,
      apiKey: globalConfig.apiKey,
      modelName,
    };
  }

  // Per-model configuration: each model has its own endpoint, key, and model name
  const url = model.baseUrl;
  const apiKey = model.apiKey || (model.provider === 'ollama' ? 'ollama' : '');
  const modelName = model.modelName || model.id;

  return { url, apiKey, modelName };
}

async function queryModel(
  model: AIModel,
  prompt: string,
  systemPrompt: string,
  images?: string[],
  conversationHistory?: { role: string; content: string }[]
): Promise<ModelResponse> {
  const startTime = Date.now();
  
  try {
    const { url, apiKey, modelName } = resolveModelEndpoint(model);

    if (!url) throw new Error('Missing endpoint URL');
    if (!apiKey) throw new Error('Missing API key');

    const messages: any[] = [{ role: 'system', content: systemPrompt }];
    if (conversationHistory?.length) messages.push(...conversationHistory);

    if (images?.length) {
      const content: any[] = [{ type: 'text', text: prompt }];
      for (const img of images) {
        content.push({ type: 'image_url', image_url: { url: img } });
      }
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const doFetch = () => fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, messages, temperature: 0.7 }),
    });

    let response = await doFetch();
    if (!response.ok) {
      console.error(`Model ${model.name} error (attempt 1):`, response.status);
      await new Promise(r => setTimeout(r, 1000));
      response = await doFetch();
      if (!response.ok) throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const processingTime = Date.now() - startTime;
    const confidence = Math.min(0.95, 0.5 + (content.length / 2000) * 0.3 + 0.15);

    return { modelId: model.id, modelName: model.name, response: content, confidence, processingTime, status: 'success' };
  } catch (error) {
    console.error(`Error querying ${model.name}:`, error);
    return {
      modelId: model.id, modelName: model.name, response: '', confidence: 0,
      processingTime: Date.now() - startTime, status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function synthesizeResponses(
  responses: ModelResponse[],
  judgeModel: AIModel,
  originalPrompt: string
): Promise<{ goldResponse: string; consensusScore: number; hallucinations: string[]; synthesisNotes: string }> {
  const successful = responses.filter(r => r.status === 'success');
  
  if (successful.length === 0) {
    return { goldResponse: 'Aucun modèle n\'a pu générer une réponse valide.', consensusScore: 0, hallucinations: [], synthesisNotes: 'Échec de tous les modèles' };
  }
  if (successful.length === 1) {
    return { goldResponse: successful[0].response, consensusScore: successful[0].confidence, hallucinations: [], synthesisNotes: `Réponse unique de ${successful[0].modelName}` };
  }

  const summaries = successful.map((r, i) => 
    `=== RÉPONSE DU MODÈLE ${i + 1} (${r.modelName}, confiance: ${(r.confidence * 100).toFixed(0)}%) ===\n${r.response}\n`
  ).join('\n');

  const synthesisPrompt = `Tu es un expert en analyse et synthèse de réponses IA. Plusieurs modèles ont répondu à la même question.

QUESTION ORIGINALE:
${originalPrompt}

RÉPONSES DES MODÈLES:
${summaries}

Ta mission:
1. Analyser toutes les réponses pour identifier les points de consensus
2. Détecter les hallucinations ou incohérences
3. Fusionner les meilleures idées de chaque réponse
4. Produire une "Réponse Gold" optimale

Réponds en JSON:
{
  "goldResponse": "La réponse synthétisée optimale",
  "consensusScore": 0.0-1.0,
  "hallucinations": ["description de chaque hallucination"],
  "synthesisNotes": "Notes sur le processus de synthèse"
}`;

  try {
    const { url, apiKey, modelName } = resolveModelEndpoint(judgeModel);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: 'Tu es un juge expert en IA. Tu analyses les réponses de plusieurs modèles pour produire une synthèse optimale. Réponds uniquement en JSON valide.' },
          { role: 'user', content: synthesisPrompt }
        ],
      }),
    });

    if (!response.ok) throw new Error('Judge model failed');

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let result;
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content);
    } catch {
      result = { goldResponse: content, consensusScore: 0.75, hallucinations: [], synthesisNotes: 'Synthèse effectuée' };
    }

    return {
      goldResponse: result.goldResponse || content,
      consensusScore: result.consensusScore || 0.75,
      hallucinations: result.hallucinations || [],
      synthesisNotes: result.synthesisNotes || 'Synthèse effectuée'
    };
  } catch (error) {
    console.error('Synthesis error:', error);
    const best = successful.sort((a, b) => b.confidence - a.confidence)[0];
    return { goldResponse: best.response, consensusScore: best.confidence, hallucinations: [], synthesisNotes: `Fallback vers ${best.modelName}` };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabaseClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { prompt, systemPrompt = 'Tu es un assistant IA expert en analyse.', models, judgeModelId, context, images, conversationHistory } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const startTime = Date.now();

    // Merge user-selected models with admin-configured providers from DB,
    // then filter to only models that can actually be called.
    const mergedModels = await mergeAdminArenaProviders((models || []) as AIModel[]);
    const enabledModels: AIModel[] = filterCallableModels(mergedModels) as AIModel[];

    if (enabledModels.length === 0) {
      enabledModels.push(
        { id: 'lovable-gemini-pro', name: 'Gemini 2.5 Pro', provider: 'lovable', baseUrl: '', modelName: 'google/gemini-2.5-pro', isLovableAI: true },
        { id: 'lovable-gemini-flash', name: 'Gemini 2.5 Flash', provider: 'lovable', baseUrl: '', modelName: 'google/gemini-2.5-flash', isLovableAI: true }
      );
    }

    console.log(`Arena: Querying ${enabledModels.length} models from ${new Set(enabledModels.map(m => m.provider)).size} providers`);

    const enrichedPrompt = context ? `Contexte:\n${context}\n\nQuestion/Tâche:\n${prompt}` : prompt;

    const modelResponses = await Promise.all(
      enabledModels.map(model => queryModel(model, enrichedPrompt, systemPrompt, images, conversationHistory))
    );

    console.log(`Arena: ${modelResponses.filter(r => r.status === 'success').length}/${modelResponses.length} successful`);

    const judgeModel = enabledModels.find(m => m.id === judgeModelId) || 
      enabledModels.find(m => m.isLovableAI && m.id.includes('gemini-pro')) || enabledModels[0];

    const synthesis = await synthesizeResponses(modelResponses, judgeModel, enrichedPrompt);
    const totalTime = Date.now() - startTime;

    return new Response(JSON.stringify({
      goldResponse: synthesis.goldResponse,
      modelResponses,
      consensusScore: synthesis.consensusScore,
      hallucinations: synthesis.hallucinations,
      synthesisNotes: synthesis.synthesisNotes,
      processingTime: totalTime
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Arena error:', error);
    return new Response(JSON.stringify({ error: 'An error occurred processing the arena request' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
