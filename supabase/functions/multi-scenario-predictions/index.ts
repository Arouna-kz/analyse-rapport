import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { callAI, getAIProviderConfig, translateModel, MODEL_API_NAMES, handleAIError } from '../_shared/ai-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIModel {
  id: string;
  name: string;
  enabled: boolean;
  isLovableAI: boolean;
  baseUrl?: string;
  apiKey?: string;
}

interface ModelResponse {
  modelId: string;
  modelName: string;
  response: string;
  confidence: number;
  processingTime: number;
  error?: string;
}

// Use MODEL_API_NAMES from shared provider

async function queryModel(
  model: AIModel,
  prompt: string,
  systemPrompt: string,
  lovableApiKey: string
): Promise<ModelResponse> {
  const startTime = Date.now();
  
  try {
    let response;
    if (model.isLovableAI) {
      const config = getAIProviderConfig();
      const rawName = MODEL_API_NAMES[model.id] || 'google/gemini-2.5-flash';
      const apiModelName = translateModel(rawName);
      response = await fetch(config.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: apiModelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
        }),
      });
    } else if (model.baseUrl && model.apiKey) {
      response = await fetch(`${model.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${model.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
        }),
      });
    } else {
      throw new Error('Model not configured');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      modelId: model.id,
      modelName: model.name,
      response: content,
      confidence: 0.8,
      processingTime: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      modelId: model.id,
      modelName: model.name,
      response: '',
      confidence: 0,
      processingTime: Date.now() - startTime,
      error: error.message,
    };
  }
}

async function synthesizeResponses(
  responses: ModelResponse[],
  scenarioType: string,
  lovableApiKey: string
): Promise<{ goldResponse: string; consensusScore: number }> {
  const validResponses = responses.filter(r => !r.error && r.response);
  
  if (validResponses.length === 0) {
    return { goldResponse: '', consensusScore: 0 };
  }

  if (validResponses.length === 1) {
    return { goldResponse: validResponses[0].response, consensusScore: 1 };
  }

  const synthesisPrompt = `Tu es un expert en synthèse d'analyses. Voici ${validResponses.length} prédictions ${scenarioType} de différents modèles IA.

${validResponses.map((r, i) => `=== MODÈLE ${i + 1}: ${r.modelName} ===\n${r.response}\n`).join('\n')}

TÂCHE:
1. Identifie les consensus entre les modèles
2. Détecte les incohérences ou hallucinations potentielles
3. Produis une "Réponse Gold" optimale qui fusionne les meilleures idées

Réponds en JSON avec cette structure:
{
  "title": "Scénario ${scenarioType}",
  "predicted_kpis": {"KPI1": valeur, "KPI2": valeur},
  "confidence_scores": {"overall": 0-1},
  "assumptions": ["assumption1", "assumption2"],
  "risk_factors": ["risk1", "risk2"],
  "recommendations": ["rec1", "rec2"],
  "probability": 0-1,
  "consensusScore": 0-1
}`;

  try {
    const synthConfig = getAIProviderConfig();
    const response = await fetch(synthConfig.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${synthConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: synthConfig.proModel,
        messages: [
          { role: 'system', content: 'Tu es un expert en synthèse. Réponds uniquement en JSON valide.' },
          { role: 'user', content: synthesisPrompt }
        ],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      throw new Error('Synthesis failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    return { goldResponse: content, consensusScore: 0.85 };
  } catch (error) {
    return { goldResponse: validResponses[0].response, consensusScore: 0.5 };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseReportIds, useArena, models } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mainConfig = getAIProviderConfig();
    const lovableApiKey = mainConfig.apiKey;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating multi-scenario predictions for reports:', baseReportIds);
    console.log('Arena mode:', useArena);

    // Fetch base reports data
    const { data: reports } = await supabase
      .from('reports')
      .select('*, report_analyses(*)')
      .in('id', baseReportIds)
      .eq('user_id', user.id);

    if (!reports || reports.length === 0) {
      throw new Error('No reports found');
    }

    // Build context from reports
    const contextData = reports.map(r => {
      const analysis = r.report_analyses?.[0];
      return `
Rapport: ${r.title}
Type: ${r.report_type}
Date: ${new Date(r.created_at).toLocaleDateString('fr-FR')}
Résumé: ${analysis?.summary || 'N/A'}
Points clés: ${analysis?.key_points?.join(', ') || 'N/A'}
KPIs: ${JSON.stringify(analysis?.kpis || {})}
      `;
    }).join('\n---\n');

    const scenarios = ['optimistic', 'realistic', 'pessimistic'];
    
    // Arena mode: query multiple models and synthesize
    if (useArena && models && models.length > 0) {
      const enabledModels = models.filter((m: AIModel) => m.enabled);
      
      const predictions = await Promise.all(
        scenarios.map(async (scenarioType) => {
          const systemPrompt = 'Tu es un expert en analyse prédictive. Réponds uniquement en JSON valide.';
          const prompt = `En tant qu'expert en analyse prédictive, génère un rapport de prévision ${scenarioType} basé sur les données suivantes :

${contextData}

Pour le scénario ${scenarioType.toUpperCase()} :
${scenarioType === 'optimistic' ? '- Suppose les meilleures conditions possibles\n- Croissance maximale réaliste\n- Résolution rapide des problèmes' : ''}
${scenarioType === 'realistic' ? '- Suppose une continuation des tendances actuelles\n- Croissance modérée\n- Quelques défis prévisibles' : ''}
${scenarioType === 'pessimistic' ? '- Suppose des conditions défavorables\n- Risques élevés\n- Obstacles majeurs' : ''}

Réponds en format JSON avec cette structure:
{
  "title": "Scénario ${scenarioType}",
  "predicted_kpis": {"KPI1": valeur, "KPI2": valeur},
  "confidence_scores": {"overall": 0-1, "kpi1": 0-1},
  "assumptions": ["assumption1", "assumption2"],
  "risk_factors": ["risk1", "risk2"],
  "recommendations": ["rec1", "rec2"],
  "probability": 0-1
}`;

          // Query all models in parallel
          const modelResponses = await Promise.all(
            enabledModels.map((model: AIModel) => queryModel(model, prompt, systemPrompt, lovableApiKey))
          );

          // Synthesize responses
          const { goldResponse, consensusScore } = await synthesizeResponses(
            modelResponses, scenarioType, lovableApiKey
          );

          // Parse the gold response
          let result;
          try {
            const jsonMatch = goldResponse.match(/```json\n([\s\S]*?)\n```/) || 
                             goldResponse.match(/```\n([\s\S]*?)\n```/) ||
                             goldResponse.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : goldResponse;
            result = JSON.parse(jsonStr);
          } catch (e) {
            result = {
              title: `Scénario ${scenarioType}`,
              predicted_kpis: {},
              confidence_scores: { overall: 0.5 },
              assumptions: [],
              risk_factors: [],
              recommendations: [],
              probability: 0.33
            };
          }

          // Store prediction
          const { data: prediction } = await supabase
            .from('report_predictions')
            .insert({
              base_reports: baseReportIds,
              prediction_type: scenarioType,
              predicted_kpis: result.predicted_kpis,
              confidence_scores: result.confidence_scores,
              methodology: { model: 'arena-consensus', consensusScore, modelsUsed: enabledModels.length },
              assumptions: result.assumptions,
              risk_factors: result.risk_factors,
              recommendations: result.recommendations,
              created_by: user.id
            })
            .select()
            .single();

          return { 
            ...result, 
            id: prediction?.id, 
            scenario_type: scenarioType,
            arenaDetails: {
              modelResponses: modelResponses.map(r => ({
                modelId: r.modelId,
                modelName: r.modelName,
                confidence: r.confidence,
                processingTime: r.processingTime,
                error: r.error
              })),
              consensusScore
            }
          };
        })
      );

      return new Response(
        JSON.stringify({ predictions, arenaMode: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Standard mode: single model
    const predictions = await Promise.all(
      scenarios.map(async (scenarioType) => {
        const prompt = `En tant qu'expert en analyse prédictive, génère un rapport de prévision ${scenarioType} basé sur les données suivantes :

${contextData}

Pour le scénario ${scenarioType.toUpperCase()} :
${scenarioType === 'optimistic' ? '- Suppose les meilleures conditions possibles\n- Croissance maximale réaliste\n- Résolution rapide des problèmes' : ''}
${scenarioType === 'realistic' ? '- Suppose une continuation des tendances actuelles\n- Croissance modérée\n- Quelques défis prévisibles' : ''}
${scenarioType === 'pessimistic' ? '- Suppose des conditions défavorables\n- Risques élevés\n- Obstacles majeurs' : ''}

Réponds en format JSON avec cette structure:
{
  "title": "Scénario ${scenarioType}",
  "predicted_kpis": {"KPI1": valeur, "KPI2": valeur},
  "confidence_scores": {"overall": 0-1, "kpi1": 0-1},
  "assumptions": ["assumption1", "assumption2"],
  "risk_factors": ["risk1", "risk2"],
  "recommendations": ["rec1", "rec2"],
  "probability": 0-1
}`;

        const stdConfig = getAIProviderConfig();
        const response = await fetch(stdConfig.baseUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stdConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: stdConfig.flashModel,
            messages: [
              { role: 'system', content: 'Tu es un expert en analyse prédictive. Réponds uniquement en JSON valide.' },
              { role: 'user', content: prompt }
            ],
            temperature: scenarioType === 'optimistic' ? 0.9 : scenarioType === 'pessimistic' ? 0.5 : 0.7,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate ${scenarioType} prediction`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        let result;
        try {
          const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                           content.match(/```\n([\s\S]*?)\n```/);
          const jsonStr = jsonMatch ? jsonMatch[1] : content;
          result = JSON.parse(jsonStr);
        } catch (e) {
          result = {
            title: `Scénario ${scenarioType}`,
            predicted_kpis: {},
            confidence_scores: { overall: 0.5 },
            assumptions: [],
            risk_factors: [],
            recommendations: [],
            probability: 0.33
          };
        }

        // Store prediction in database
        const { data: prediction } = await supabase
          .from('report_predictions')
          .insert({
            base_reports: baseReportIds,
            prediction_type: scenarioType,
            predicted_kpis: result.predicted_kpis,
            confidence_scores: result.confidence_scores,
            methodology: { model: 'gemini-2.5-flash', temperature: scenarioType === 'optimistic' ? 0.9 : 0.7 },
            assumptions: result.assumptions,
            risk_factors: result.risk_factors,
            recommendations: result.recommendations,
            created_by: user.id
          })
          .select()
          .single();

        return { ...result, id: prediction?.id, scenario_type: scenarioType };
      })
    );

    return new Response(
      JSON.stringify({ predictions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Multi-scenario prediction error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
