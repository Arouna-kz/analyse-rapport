import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { callAI, callAIJson, handleAIError } from '../_shared/ai-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId, feedback, type = 'analysis' } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Refining ${type} for report ${reportId} with feedback:`, feedback);

    // Get current report and analysis
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*, report_analyses(*)')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      throw new Error('Rapport non trouvé');
    }

    const currentAnalysis = report.report_analyses?.[0];
    
    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'analysis') {
      systemPrompt = `Tu es un analyste expert. Tu dois améliorer l'analyse d'un rapport en tenant compte des retours de l'utilisateur.
Tu dois conserver les bonnes parties de l'analyse actuelle tout en améliorant les points demandés.

Réponds en JSON avec cette structure:
{
  "summary": "Résumé amélioré",
  "keyPoints": ["point1", "point2", ...],
  "kpis": {"KPI1": valeur, "KPI2": valeur, ...},
  "insights": "Insights et recommandations améliorés"
}`;

      userPrompt = `RAPPORT: ${report.title}

ANALYSE ACTUELLE:
Résumé: ${currentAnalysis?.summary || 'Aucun'}
Points clés: ${JSON.stringify(currentAnalysis?.key_points || [])}
KPIs: ${JSON.stringify(currentAnalysis?.kpis || {})}
Insights: ${currentAnalysis?.insights || 'Aucun'}

RETOUR UTILISATEUR:
${feedback}

Améliore l'analyse en tenant compte des demandes de l'utilisateur.`;

    } else if (type === 'prediction') {
      systemPrompt = `Tu es un expert en prévisions et analyse prédictive. Tu dois améliorer les prédictions en tenant compte des retours de l'utilisateur.

Réponds en JSON avec cette structure:
{
  "predictions": [
    {
      "scenario_type": "optimistic|realistic|pessimistic",
      "title": "Titre du scénario",
      "predicted_kpis": {"kpi1": valeur, ...},
      "confidence_scores": {"kpi1": 0.85, ...},
      "assumptions": ["hypothèse1", ...],
      "risk_factors": ["risque1", ...],
      "recommendations": ["recommandation1", ...],
      "probability": 0.3
    }
  ]
}`;

      userPrompt = `RAPPORT DE BASE: ${report.title}

ANALYSE ACTUELLE:
${JSON.stringify(currentAnalysis || {}, null, 2)}

RETOUR UTILISATEUR:
${feedback}

Génère des prédictions améliorées en tenant compte des demandes.`;

    } else if (type === 'generation') {
      systemPrompt = `Tu es un rédacteur de rapports professionnel. Tu dois améliorer le rapport généré en tenant compte des retours de l'utilisateur.

Réponds en JSON avec cette structure:
{
  "summary": "Résumé amélioré",
  "keyPoints": ["point1", "point2", ...],
  "kpis": {"KPI1": valeur, "KPI2": valeur, ...},
  "insights": "Insights et recommandations améliorés"
}`;

      userPrompt = `RAPPORT: ${report.title}

CONTENU ACTUEL:
Résumé: ${currentAnalysis?.summary || 'Aucun'}
Points clés: ${JSON.stringify(currentAnalysis?.key_points || [])}
KPIs: ${JSON.stringify(currentAnalysis?.kpis || {})}
Insights: ${currentAnalysis?.insights || 'Aucun'}

RETOUR UTILISATEUR:
${feedback}

Améliore le rapport en tenant compte des demandes.`;
    }

    // Call AI via provider abstraction
    const { data: result } = await callAIJson({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'google/gemini-2.5-flash',
      temperature: 0.7,
    });

    if (type === 'prediction') {
      return new Response(
        JSON.stringify({ success: true, predictions: result.predictions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Always create a new analysis version to preserve history
    const { error: insertError } = await supabase
      .from('report_analyses')
      .insert({
        report_id: reportId,
        summary: result.summary || currentAnalysis?.summary || '',
        key_points: result.keyPoints || currentAnalysis?.key_points || [],
        kpis: result.kpis || currentAnalysis?.kpis || {},
        insights: result.insights || currentAnalysis?.insights || '',
      });

    if (insertError) {
      console.error('Insert error:', insertError);
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Refine analysis error:', error);
    return handleAIError(error, corsHeaders);
  }
});
