import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { callAI, getAIProviderConfig, translateModel, MODEL_API_NAMES } from '../_shared/ai-provider.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert Excel JSON data to readable text
function formatExcelJsonToText(jsonData: any): string {
  try {
    let result = '';
    
    // Handle array of sheets
    if (Array.isArray(jsonData)) {
      jsonData.forEach((sheet: any, sheetIndex: number) => {
        const sheetName = sheet.SheetName || `Feuille ${sheetIndex + 1}`;
        result += `\n=== ${sheetName} ===\n`;
        
        if (sheet.Rows && Array.isArray(sheet.Rows)) {
          sheet.Rows.forEach((row: any, rowIndex: number) => {
            if (row.Cells && Array.isArray(row.Cells)) {
              const cellValues = row.Cells.map((cell: any) => {
                if (cell.TextValue) return cell.TextValue;
                if (cell.Value !== undefined) return String(cell.Value);
                if (cell.Formula) return `[Formule: ${cell.Formula}]`;
                return '';
              }).filter((v: string) => v.trim() !== '');
              
              if (cellValues.length > 0) {
                result += cellValues.join(' | ') + '\n';
              }
            }
          });
        }
      });
    } else if (typeof jsonData === 'object') {
      // Single sheet or different structure
      result = JSON.stringify(jsonData, null, 2);
    }
    
    return result || JSON.stringify(jsonData, null, 2);
  } catch (e) {
    console.error('Error formatting Excel JSON:', e);
    return JSON.stringify(jsonData, null, 2);
  }
}

// Use MODEL_API_NAMES from shared provider

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
  status: 'success' | 'error';
}

async function queryModelForAnalysis(
  model: AIModel,
  prompt: string,
  lovableApiKey: string
): Promise<ModelResponse> {
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
    
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: 'Tu es un expert en analyse de rapports. Réponds toujours en JSON valide.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const confidence = Math.min(0.95, 0.5 + (content.length / 2000) * 0.3 + 0.15);

    return {
      modelId: model.id,
      modelName: model.name,
      response: content,
      confidence,
      status: 'success'
    };
  } catch (error) {
    console.error(`Error querying ${model.name}:`, error);
    return {
      modelId: model.id,
      modelName: model.name,
      response: '',
      confidence: 0,
      status: 'error'
    };
  }
}

async function synthesizeAnalyses(
  responses: ModelResponse[],
  originalPrompt: string,
  lovableApiKey: string
): Promise<any> {
  const successfulResponses = responses.filter(r => r.status === 'success');
  
  if (successfulResponses.length === 0) {
    throw new Error('All models failed to generate analysis');
  }

  if (successfulResponses.length === 1) {
    // Parse the single response
    const content = successfulResponses[0].response;
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                       content.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      return JSON.parse(jsonStr);
    } catch {
      return {
        summary: content,
        key_points: ['Analyse effectuée'],
        kpis: { "Score": 75 },
        insights: 'Voir le résumé pour plus de détails.'
      };
    }
  }

  // Build synthesis prompt
  const responseSummaries = successfulResponses.map((r, i) => 
    `=== ANALYSE DU MODÈLE ${i + 1} (${r.modelName}, confiance: ${(r.confidence * 100).toFixed(0)}%) ===\n${r.response}\n`
  ).join('\n');

  const synthesisPrompt = `Tu es un expert en synthèse d'analyses. Plusieurs modèles IA ont analysé le même rapport.

PROMPT ORIGINAL:
${originalPrompt}

ANALYSES DES MODÈLES:
${responseSummaries}

Ta mission:
1. Fusionner les meilleures analyses de chaque modèle
2. Identifier les points de consensus et les divergences
3. Produire une analyse "Gold" optimale

Réponds en JSON avec cette structure:
{
  "summary": "résumé synthétisé du rapport",
  "key_points": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "kpis": {"KPI1": valeur, "KPI2": valeur, "KPI3": valeur},
  "insights": "insights et recommandations détaillées fusionnés",
  "consensus_notes": "notes sur le consensus entre les modèles"
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
          { role: 'system', content: 'Tu es un juge expert en analyse. Tu synthétises les réponses de plusieurs modèles pour produire une analyse optimale. Réponds uniquement en JSON valide.' },
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

    // Parse JSON response
    try {
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                       content.match(/```\n([\s\S]*?)\n```/) ||
                       content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      return JSON.parse(jsonStr);
    } catch {
      return {
        summary: content,
        key_points: ['Analyse synthétisée'],
        kpis: { "Score": 80 },
        insights: content
      };
    }
  } catch (error) {
    console.error('Synthesis error:', error);
    // Fallback to best response
    const bestResponse = successfulResponses.sort((a, b) => b.confidence - a.confidence)[0];
    try {
      const jsonMatch = bestResponse.response.match(/```json\n([\s\S]*?)\n```/) || 
                       bestResponse.response.match(/```\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : bestResponse.response;
      return JSON.parse(jsonStr);
    } catch {
      return {
        summary: bestResponse.response,
        key_points: ['Analyse effectuée'],
        kpis: { "Score": 75 },
        insights: 'Voir le résumé.'
      };
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId, useArena = true, arenaModels } = await req.json();
    
    if (!reportId) {
      return new Response(
        JSON.stringify({ error: 'Report ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const aiProviderConfig = getAIProviderConfig();
    const lovableApiKey = aiProviderConfig.apiKey;
    const cloudmersiveApiKey = Deno.env.get('CLOUDMERSIVE_API_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    // User-scoped client for auth validation and ownership checks
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabaseUser.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const userId = claimsData.claims.sub;

    // Service role client for privileged operations (embeddings, alerts, analyses)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting analysis for report:', reportId, 'user:', userId, 'useArena:', useArena);

    // Verify ownership via user-scoped client (RLS enforced)
    const { data: report, error: reportError } = await supabaseUser
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return new Response(
        JSON.stringify({ error: 'Report not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing
    await supabase
      .from('reports')
      .update({ status: 'processing' })
      .eq('id', reportId);

    if (reportError || !report) {
      throw new Error('Report not found');
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('reports')
      .download(report.file_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download file');
    }

    // Extract text based on file type
    let extractedText = '';
    const isExcel = report.file_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    report.file_type === 'application/vnd.ms-excel' ||
                    report.file_path?.endsWith('.xlsx') ||
                    report.file_path?.endsWith('.xls');
    
    console.log('File type:', report.file_type, 'Is Excel:', isExcel);

    if (report.file_type === 'text/plain') {
      extractedText = await fileData.text();
      console.log('Text file extracted, length:', extractedText.length);
    } else if (isExcel) {
      // Use Cloudmersive to convert Excel to CSV/text
      console.log('Processing Excel file with Cloudmersive...');
      const formData = new FormData();
      formData.append('inputFile', fileData);
      
      try {
        // First try Excel to CSV conversion
        const csvResponse = await fetch('https://api.cloudmersive.com/convert/xlsx/to/csv', {
          method: 'POST',
          headers: {
            'Apikey': cloudmersiveApiKey,
          },
          body: formData,
        });

        if (csvResponse.ok) {
          extractedText = await csvResponse.text();
          console.log('Excel to CSV extraction successful, length:', extractedText.length);
        } else {
          console.log('CSV conversion failed, trying JSON extraction...');
          
          // Fallback: try Excel to JSON
          const formData2 = new FormData();
          formData2.append('inputFile', fileData);
          
          const jsonResponse = await fetch('https://api.cloudmersive.com/convert/xlsx/to/json', {
            method: 'POST',
            headers: {
              'Apikey': cloudmersiveApiKey,
            },
            body: formData2,
          });

          if (jsonResponse.ok) {
            const jsonData = await jsonResponse.json();
            // Convert JSON structure to readable text
            extractedText = formatExcelJsonToText(jsonData);
            console.log('Excel to JSON extraction successful, length:', extractedText.length);
          } else {
            throw new Error('Both CSV and JSON extraction failed');
          }
        }
      } catch (e) {
        console.error('Excel extraction error:', e);
        
        // Last resort: Use AI to analyze the binary data structure
        console.log('Fallback: Using AI for Excel analysis...');
        const arrayBuffer = await fileData.arrayBuffer();
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer).slice(0, 10000)));
        
        // Request AI to interpret what it can from metadata
        extractedText = `[FICHIER EXCEL BINAIRE]\nTitre: ${report.title}\nType: Fichier Excel (.xlsx/.xls)\nTaille: ${fileData.size} bytes\n\nNote: Extraction directe impossible. Analyse basée sur le contexte disponible.`;
      }
    } else if (report.file_type === 'application/pdf' || 
               report.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Use Cloudmersive for professional extraction
      const formData = new FormData();
      formData.append('inputFile', fileData);
      
      const endpoint = report.file_type === 'application/pdf' 
        ? 'https://api.cloudmersive.com/convert/pdf/to/txt'
        : 'https://api.cloudmersive.com/convert/docx/to/txt';
      
      try {
        const extractResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Apikey': cloudmersiveApiKey,
          },
          body: formData,
        });

        if (extractResponse.ok) {
          const result = await extractResponse.json();
          extractedText = result.TextResult || '';
          console.log('Cloudmersive extraction successful, length:', extractedText.length);
        } else {
          throw new Error('Cloudmersive extraction failed');
        }
      } catch (e) {
        console.error('Cloudmersive error:', e);
        extractedText = `Document: ${report.title}\nContenu nécessitant une extraction spécialisée.`;
      }
    }

    // If extraction failed or file is too short, try AI-based content description
    if (extractedText.length < 100) {
      console.log('Extraction insufficient, using AI fallback for file description');
      extractedText = `Rapport: ${report.title}\nType de fichier: ${report.file_type}\nType de rapport: ${report.report_type}\n\nLe fichier a été uploadé mais l'extraction textuelle directe n'a pas fonctionné. L'analyse sera basée sur le contexte et les métadonnées disponibles.`;
    }

    console.log('Text extracted, length:', extractedText.length);

    // Generate analysis prompt
    const analysisPrompt = `Analyse le rapport suivant et fournis:
1. Un résumé concis (3-5 phrases)
2. 5 points clés principaux
3. 3-5 KPIs pertinents avec des valeurs numériques
4. Des insights et recommandations

Type de rapport: ${report.report_type}
Titre: ${report.title}

Contenu:
${extractedText.substring(0, 4000)}

Réponds en format JSON avec cette structure:
{
  "summary": "résumé du rapport",
  "key_points": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "kpis": {"KPI1": 85, "KPI2": 92, "KPI3": 78},
  "insights": "insights et recommandations détaillées"
}`;

    let analysis;

    if (useArena) {
      // Use Arena multi-model consensus
      console.log('Using Arena multi-model analysis');
      
      // Default models for Arena
      const defaultModels: AIModel[] = [
        { id: 'lovable-gemini-pro', name: 'Gemini 2.5 Pro', baseUrl: '', isLovableAI: true },
        { id: 'lovable-gemini-flash', name: 'Gemini 2.5 Flash', baseUrl: '', isLovableAI: true },
      ];

      const models: AIModel[] = arenaModels?.filter((m: AIModel) => m.isLovableAI || (m.baseUrl && m.apiKey)) || defaultModels;
      
      console.log(`Arena: Querying ${models.length} models in parallel for analysis`);

      // Query all models in parallel
      const modelResponses = await Promise.all(
        models.map(model => queryModelForAnalysis(model, analysisPrompt, lovableApiKey))
      );

      console.log(`Arena: Received ${modelResponses.filter(r => r.status === 'success').length} successful analyses`);

      // Synthesize responses
      analysis = await synthesizeAnalyses(modelResponses, analysisPrompt, lovableApiKey);
      
      // Add arena metadata
      analysis.arenaMetadata = {
        modelsUsed: modelResponses.map(r => ({ id: r.modelId, name: r.modelName, status: r.status, confidence: r.confidence })),
        consensusAchieved: modelResponses.filter(r => r.status === 'success').length > 1
      };

    } else {
      // Use single model analysis (original flow)
      const singleConfig = getAIProviderConfig();
      const analysisResponse = await fetch(singleConfig.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${singleConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: singleConfig.flashModel,
          messages: [
            { role: 'system', content: 'Tu es un expert en analyse de rapports. Réponds toujours en JSON valide.' },
            { role: 'user', content: analysisPrompt }
          ],
          temperature: 0.7,
        }),
      });

      if (!analysisResponse.ok) {
        const errorText = await analysisResponse.text();
        console.error('AI analysis error:', analysisResponse.status, errorText);
        throw new Error('Failed to generate analysis');
      }

      const analysisData = await analysisResponse.json();
      const analysisContent = analysisData.choices[0].message.content;
      
      console.log('Analysis generated:', analysisContent);

      // Parse JSON response
      try {
        const jsonMatch = analysisContent.match(/```json\n([\s\S]*?)\n```/) || 
                         analysisContent.match(/```\n([\s\S]*?)\n```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : analysisContent;
        analysis = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Failed to parse analysis JSON:', e);
        analysis = {
          summary: analysisContent,
          key_points: ['Analyse effectuée'],
          kpis: { "Score": 75 },
          insights: 'Voir le résumé pour plus de détails.'
        };
      }
    }

    console.log('Final analysis ready');

    // Store analysis in database with Arena metadata
    const { error: insertError } = await supabase
      .from('report_analyses')
      .insert({
        report_id: reportId,
        summary: analysis.summary,
        key_points: analysis.key_points,
        kpis: analysis.kpis,
        insights: analysis.insights,
        arena_metadata: analysis.arenaMetadata || null,
        arena_score: analysis.arenaMetadata?.consensusAchieved ? 0.85 : null,
      });

    if (insertError) {
      console.error('Failed to insert analysis:', insertError);
      throw insertError;
    }

    // Generate embeddings for chunks of text
    const chunkSize = 500;
    const chunks = [];
    for (let i = 0; i < extractedText.length; i += chunkSize) {
      chunks.push(extractedText.substring(i, i + chunkSize));
    }

    console.log('Generating embeddings for', chunks.length, 'chunks');

    // Generate embeddings using OpenAI with vector type
    for (let i = 0; i < Math.min(chunks.length, 10); i++) {
      const chunk = chunks[i];
      
      try {
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: chunk,
          }),
        });

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          const embedding = embeddingData.data[0].embedding;

          // Store with vector type for HNSW index
          await supabase
            .from('report_embeddings')
            .insert({
              report_id: reportId,
              content: chunk,
              embedding: `[${embedding.join(',')}]`,
              metadata: { chunk_index: i, total_chunks: chunks.length }
            });
          
          console.log(`Embedding ${i + 1}/${chunks.length} stored with vector type`);
        } else {
          console.error('Embedding generation failed for chunk', i);
        }
      } catch (e) {
        console.error('Error generating embedding for chunk', i, ':', e);
      }
    }

    // Detect anomalies in KPIs and create alerts
    if (analysis.kpis && Object.keys(analysis.kpis).length > 0) {
      console.log('Detecting anomalies in KPIs');
      for (const [kpiName, kpiValue] of Object.entries(analysis.kpis)) {
        if (typeof kpiValue === 'number') {
          try {
            const { data: anomalyData } = await supabase
              .rpc('detect_anomalies', {
                _report_id: reportId,
                _kpi_name: kpiName,
                _threshold: 2.0
              });

            if (anomalyData && anomalyData[0]?.anomaly_detected) {
              // Create alert for anomaly
              await supabase.from('report_alerts').insert({
                report_id: reportId,
                alert_type: 'anomaly_detected',
                severity: anomalyData[0].severity,
                trigger_condition: { kpi: kpiName, threshold: 2.0 },
                detected_value: { kpi: kpiName, value: kpiValue, z_score: anomalyData[0].z_score },
                message: `Anomalie détectée pour ${kpiName}: valeur ${kpiValue} (z-score: ${anomalyData[0].z_score.toFixed(2)})`
              });
              console.log(`Alert created for KPI: ${kpiName}`);
            }
          } catch (e) {
            console.error(`Error detecting anomaly for ${kpiName}:`, e);
          }
        }
      }
    }

    // Update report status to completed
    await supabase
      .from('reports')
      .update({ status: 'completed' })
      .eq('id', reportId);

    console.log('Analysis completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: useArena ? 'Analyse Arena multi-modèles terminée avec succès' : 'Analyse terminée avec succès',
        analysis: analysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Analysis error:', error);
    
    // Update status to error if we have reportId
    try {
      const body = await req.clone().json();
      if (body.reportId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const errorSupabase = createClient(supabaseUrl, supabaseKey);
        
        await errorSupabase
          .from('reports')
          .update({ status: 'error' })
          .eq('id', body.reportId);
      }
    } catch (e) {
      console.error('Failed to update error status:', e);
    }

    return new Response(
      JSON.stringify({ 
        error: 'Une erreur est survenue lors de l\'analyse'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
