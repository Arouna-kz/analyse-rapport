import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { getAIProviderConfig, translateModel, MODEL_API_NAMES } from '../_shared/ai-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIModel {
  id: string;
  name: string;
  baseUrl: string;
  isLovableAI: boolean;
  apiKey?: string;
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

async function queryModel(
  model: AIModel,
  prompt: string,
  systemPrompt: string,
  lovableApiKey: string,
  images?: string[],
  conversationHistory?: { role: string; content: string }[]
): Promise<ModelResponse> {
  const startTime = Date.now();
  
  try {
    const config = getAIProviderConfig();
    const apiKey = model.isLovableAI ? config.apiKey : model.apiKey;
    const baseUrl = model.isLovableAI 
      ? config.baseUrl 
      : model.baseUrl;
    
    if (!apiKey || !baseUrl) {
      throw new Error('Missing API key or base URL');
    }

    const rawModelName = MODEL_API_NAMES[model.id] || model.id;
    const modelName = model.isLovableAI ? translateModel(rawModelName) : rawModelName;
    
    // Build messages array
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history for context
    if (conversationHistory && Array.isArray(conversationHistory)) {
      messages.push(...conversationHistory);
    }

    // Build user message content (with images if provided)
    if (images && images.length > 0) {
      const content: any[] = [{ type: 'text', text: prompt }];
      for (const imageData of images) {
        content.push({
          type: 'image_url',
          image_url: { url: imageData }
        });
      }
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: 'user', content: prompt });
    }
    
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Model ${model.name} error (attempt 1):`, response.status, errorText);
      
      // Retry once after a short delay
      await new Promise(r => setTimeout(r, 1000));
      const retryResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: 0.7,
        }),
      });
      
      if (!retryResponse.ok) {
        const retryErrorText = await retryResponse.text();
        console.error(`Model ${model.name} error (attempt 2):`, retryResponse.status, retryErrorText);
        throw new Error(`API error: ${retryResponse.status}`);
      }
      
      const retryData = await retryResponse.json();
      const retryContent = retryData.choices?.[0]?.message?.content || '';
      const processingTime = Date.now() - startTime;
      const confidence = Math.min(0.95, 0.5 + (retryContent.length / 2000) * 0.3 + 0.15);
      
      return {
        modelId: model.id,
        modelName: model.name,
        response: retryContent,
        confidence,
        processingTime,
        status: 'success'
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const processingTime = Date.now() - startTime;

    // Estimate confidence based on response length and structure
    const confidence = Math.min(0.95, 0.5 + (content.length / 2000) * 0.3 + 0.15);

    return {
      modelId: model.id,
      modelName: model.name,
      response: content,
      confidence,
      processingTime,
      status: 'success'
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`Error querying ${model.name}:`, error);
    
    return {
      modelId: model.id,
      modelName: model.name,
      response: '',
      confidence: 0,
      processingTime,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function synthesizeResponses(
  responses: ModelResponse[],
  judgeModel: AIModel,
  originalPrompt: string,
  lovableApiKey: string
): Promise<{
  goldResponse: string;
  consensusScore: number;
  hallucinations: string[];
  synthesisNotes: string;
}> {
  const successfulResponses = responses.filter(r => r.status === 'success');
  
  if (successfulResponses.length === 0) {
    return {
      goldResponse: 'Aucun modèle n\'a pu générer une réponse valide.',
      consensusScore: 0,
      hallucinations: [],
      synthesisNotes: 'Échec de tous les modèles'
    };
  }

  if (successfulResponses.length === 1) {
    return {
      goldResponse: successfulResponses[0].response,
      consensusScore: successfulResponses[0].confidence,
      hallucinations: [],
      synthesisNotes: `Réponse unique de ${successfulResponses[0].modelName}`
    };
  }

  // Build synthesis prompt
  const responseSummaries = successfulResponses.map((r, i) => 
    `=== RÉPONSE DU MODÈLE ${i + 1} (${r.modelName}, confiance: ${(r.confidence * 100).toFixed(0)}%) ===\n${r.response}\n`
  ).join('\n');

  const synthesisPrompt = `Tu es un expert en analyse et synthèse de réponses IA. Plusieurs modèles ont répondu à la même question.

QUESTION ORIGINALE:
${originalPrompt}

RÉPONSES DES MODÈLES:
${responseSummaries}

Ta mission:
1. Analyser toutes les réponses pour identifier les points de consensus
2. Détecter les hallucinations ou incohérences (informations contradictoires ou non vérifiables)
3. Fusionner les meilleures idées de chaque réponse
4. Produire une "Réponse Gold" optimale

Réponds en JSON avec cette structure:
{
  "goldResponse": "La réponse synthétisée optimale",
  "consensusScore": 0.0-1.0,
  "hallucinations": ["description de chaque hallucination détectée"],
  "synthesisNotes": "Notes sur le processus de synthèse"
}`;

  try {
    const judgeConfig = getAIProviderConfig();
    const judgeApiKey = judgeModel.isLovableAI ? judgeConfig.apiKey : judgeModel.apiKey;
    const judgeBaseUrl = judgeModel.isLovableAI 
      ? judgeConfig.baseUrl 
      : judgeModel.baseUrl;
    
    const rawJudgeModelName = MODEL_API_NAMES[judgeModel.id] || judgeModel.id;
    const modelName = judgeModel.isLovableAI ? translateModel(rawJudgeModelName) : rawJudgeModelName;

    const response = await fetch(judgeBaseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${judgeApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { 
            role: 'system', 
            content: 'Tu es un juge expert en IA. Tu analyses les réponses de plusieurs modèles pour produire une synthèse optimale. Réponds uniquement en JSON valide.' 
          },
          { role: 'user', content: synthesisPrompt }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error('Judge model failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON response
    let result;
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                       content.match(/```\n([\s\S]*?)\n```/) ||
                       content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      result = JSON.parse(jsonStr);
    } catch (e) {
      // If JSON parsing fails, use the content as is
      result = {
        goldResponse: content,
        consensusScore: 0.75,
        hallucinations: [],
        synthesisNotes: 'Synthèse effectuée'
      };
    }

    return {
      goldResponse: result.goldResponse || content,
      consensusScore: result.consensusScore || 0.75,
      hallucinations: result.hallucinations || [],
      synthesisNotes: result.synthesisNotes || 'Synthèse effectuée'
    };

  } catch (error) {
    console.error('Synthesis error:', error);
    
    // Fallback: use the best response by confidence
    const bestResponse = successfulResponses.sort((a, b) => b.confidence - a.confidence)[0];
    return {
      goldResponse: bestResponse.response,
      consensusScore: bestResponse.confidence,
      hallucinations: [],
      synthesisNotes: `Fallback vers ${bestResponse.modelName} (échec de la synthèse)`
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { data: claimsData, error: authError } = await supabaseClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Arena: Authenticated user', claimsData.claims.sub);

    const { 
      prompt, 
      systemPrompt = 'Tu es un assistant IA expert en analyse.',
      models,
      judgeModelId,
      context,
      images,
      conversationHistory
    } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const arenaConfig = getAIProviderConfig();
    const lovableApiKey = arenaConfig.apiKey;
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const startTime = Date.now();

    // Filter enabled models
    const enabledModels: AIModel[] = (models || []).filter((m: AIModel) => 
      m.isLovableAI || (m.baseUrl && m.apiKey)
    );

    // If no models configured, use default Lovable AI models
    if (enabledModels.length === 0) {
      enabledModels.push(
        { id: 'lovable-gemini-pro', name: 'Gemini 2.5 Pro', baseUrl: '', isLovableAI: true },
        { id: 'lovable-gemini-flash', name: 'Gemini 2.5 Flash', baseUrl: '', isLovableAI: true }
      );
    }

    console.log(`Arena: Querying ${enabledModels.length} models in parallel`);

    // Enrich prompt with context if provided
    const enrichedPrompt = context 
      ? `Contexte:\n${context}\n\nQuestion/Tâche:\n${prompt}`
      : prompt;

    // Phase 1: Query all models in parallel (with images and history support)
    const modelResponses = await Promise.all(
      enabledModels.map(model => queryModel(model, enrichedPrompt, systemPrompt, lovableApiKey, images, conversationHistory))
    );

    console.log(`Arena: Received ${modelResponses.filter(r => r.status === 'success').length} successful responses`);

    // Phase 2 & 3: Synthesize responses using judge model
    const judgeModel = enabledModels.find(m => m.id === judgeModelId) || 
      enabledModels.find(m => m.isLovableAI && m.id.includes('gemini-pro')) ||
      enabledModels[0];

    const synthesis = await synthesizeResponses(
      modelResponses, 
      judgeModel, 
      enrichedPrompt, 
      lovableApiKey
    );

    const totalTime = Date.now() - startTime;

    console.log(`Arena: Completed in ${totalTime}ms with consensus ${(synthesis.consensusScore * 100).toFixed(0)}%`);

    return new Response(
      JSON.stringify({
        goldResponse: synthesis.goldResponse,
        modelResponses,
        consensusScore: synthesis.consensusScore,
        hallucinations: synthesis.hallucinations,
        synthesisNotes: synthesis.synthesisNotes,
        processingTime: totalTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Arena error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred processing the arena request'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
