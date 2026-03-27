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
    const { reportType, baseReportIds } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
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

    console.log('Generating future report based on:', baseReportIds);

    // Fetch base reports analyses
    let contextData = '';
    
    if (baseReportIds && baseReportIds.length > 0) {
      const { data: reports } = await supabase
        .from('reports')
        .select('*, report_analyses(*)')
        .in('id', baseReportIds)
        .eq('user_id', user.id);

      if (reports) {
        contextData = reports.map(r => {
          const analysis = r.report_analyses?.[0];
          return `
Rapport: ${r.title}
Type: ${r.report_type}
Résumé: ${analysis?.summary || 'N/A'}
Points clés: ${analysis?.key_points?.join(', ') || 'N/A'}
KPIs: ${JSON.stringify(analysis?.kpis || {})}
          `;
        }).join('\n---\n');
      }
    }

    const prompt = `En tant qu'expert en analyse prédictive, génère un rapport futur détaillé basé sur les rapports suivants :

${contextData}

Le rapport futur doit inclure :
1. Un titre accrocheur
2. Une introduction contextuelle
3. Des prévisions détaillées basées sur les tendances observées
4. Des KPIs projetés avec des valeurs numériques
5. Des recommandations stratégiques
6. Une conclusion

Réponds en format JSON avec cette structure:
{
  "title": "Titre du rapport futur",
  "content": "Contenu complet du rapport en markdown",
  "projectedKpis": {"KPI1": valeur, "KPI2": valeur},
  "recommendations": ["rec1", "rec2", "rec3"]
}`;

    const { data: result } = await callAIJson({
      messages: [
        { role: 'system', content: 'Tu es un expert en analyse prédictive et génération de rapports. Réponds en JSON valide.' },
        { role: 'user', content: prompt }
      ],
      model: 'google/gemini-2.5-flash',
      temperature: 0.8,
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Future report generation error:', error);
    return handleAIError(error, corsHeaders);
  }
});
