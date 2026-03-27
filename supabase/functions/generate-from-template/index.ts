import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { callAI, getAIProviderConfig, translateModel, MODEL_API_NAMES, handleAIError } from '../_shared/ai-provider.ts';

// Note: dataFilePaths is now optional - can generate from template alone

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
  lovableApiKey: string
): Promise<{ goldResponse: string; consensusScore: number }> {
  const validResponses = responses.filter(r => !r.error && r.response);
  
  if (validResponses.length === 0) {
    return { goldResponse: '', consensusScore: 0 };
  }

  if (validResponses.length === 1) {
    return { goldResponse: validResponses[0].response, consensusScore: 1 };
  }

  const synthesisPrompt = `Tu es un expert en synthèse de rapports. Voici ${validResponses.length} versions de rapport générées par différents modèles IA.

${validResponses.map((r, i) => `=== MODÈLE ${i + 1}: ${r.modelName} ===\n${r.response}\n`).join('\n')}

TÂCHE:
1. Identifie les consensus entre les modèles
2. Détecte les incohérences ou hallucinations potentielles
3. Produis une "Réponse Gold" optimale qui fusionne les meilleures idées

Le format de réponse doit être un JSON avec cette structure:
{
  "title": "Titre du rapport",
  "content": "Contenu complet du rapport",
  "summary": "Résumé exécutif",
  "keyPoints": ["point1", "point2"],
  "kpis": {"KPI1": valeur},
  "insights": "Analyse et recommandations"
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

// Helper function to extract text from any file using AI
async function extractTextWithAI(fileData: Blob, fileName: string, lovableApiKey: string): Promise<string> {
  try {
    // Convert blob to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    const extractConfig = getAIProviderConfig();
    const response = await fetch(extractConfig.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${extractConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: extractConfig.flashModel,
        messages: [
          { 
            role: 'system', 
            content: 'Tu es un extracteur de texte. Extrais et retourne UNIQUEMENT le contenu textuel du document fourni. Ne fais aucune analyse, ne résume pas. Retourne le texte brut tel quel.' 
          },
          { 
            role: 'user', 
            content: [
              {
                type: 'text',
                text: `Extrais le texte de ce fichier ${fileName}:`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/octet-stream;base64,${base64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    }
  } catch (e) {
    console.error('AI extraction failed:', e);
  }
  return '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      dataFilePath, // Single file (backward compatibility)
      dataFilePaths, // Array of files (new)
      templateFilePath, 
      templateSource, 
      selectedReportIds, 
      reportTitle,
      additionalInstructions,
      useArena,
      models
    } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mainConfig = getAIProviderConfig();
    const lovableApiKey = mainConfig.apiKey;

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

    console.log('Starting report generation from template');
    console.log('Template source:', templateSource);

    // Combine all data file paths (support both single file and multiple files)
    const allDataFilePaths: string[] = [];
    if (dataFilePaths && Array.isArray(dataFilePaths)) {
      allDataFilePaths.push(...dataFilePaths);
    }
    if (dataFilePath && !allDataFilePaths.includes(dataFilePath)) {
      allDataFilePaths.push(dataFilePath);
    }

    console.log('Data files to process:', allDataFilePaths.length);

    // Extract text from all data files (optional - can be empty)
    let dataText = '';
    
    for (const filePath of allDataFilePaths) {
      try {
        const { data: dataFileData, error: dataDownloadError } = await supabase.storage
          .from('reports')
          .download(filePath);

        if (dataDownloadError) {
          console.error('Download error for', filePath, ':', dataDownloadError);
          continue;
        }

        let fileText = '';
        const dataFileName = filePath.toLowerCase();

        // Try to extract text based on file type
        if (dataFileName.endsWith('.txt') || dataFileName.endsWith('.csv') || dataFileName.endsWith('.json')) {
          fileText = await dataFileData.text();
          console.log('Text file extracted directly:', filePath);
        } else if (dataFileName.endsWith('.pdf') || dataFileName.endsWith('.docx') || dataFileName.endsWith('.doc')) {
          // For binary files, try to read as text first
          try {
            const textAttempt = await dataFileData.text();
            const validTextRatio = textAttempt.replace(/[^\x20-\x7E\n\r\t]/g, '').length / textAttempt.length;
            if (validTextRatio > 0.8 && textAttempt.length > 20) {
              fileText = textAttempt;
              console.log('Binary file had readable text:', filePath);
            } else {
              console.log('Attempting AI extraction for binary file:', filePath);
              fileText = await extractTextWithAI(dataFileData, filePath, lovableApiKey);
            }
          } catch (e) {
            console.log('Text extraction failed, using AI:', e);
            fileText = await extractTextWithAI(dataFileData, filePath, lovableApiKey);
          }
        } else {
          // Try to read as text for any other file type
          try {
            fileText = await dataFileData.text();
          } catch (e) {
            console.error('Failed to read file as text:', filePath, e);
          }
        }

        if (fileText && fileText.trim().length > 10) {
          const fileName = filePath.split('/').pop() || filePath;
          dataText += `\n\n=== FICHIER: ${fileName} ===\n${fileText}\n`;
        }
      } catch (e) {
        console.error('Error processing file:', filePath, e);
      }
    }

    // If no data files or extraction failed, note this - report can still be generated from template
    if (!dataText || dataText.trim().length < 10) {
      if (allDataFilePaths.length > 0) {
        console.log('Could not extract text from data files, will rely on template and instructions');
        dataText = `Note: ${allDataFilePaths.length} fichier(s) de données fourni(s) mais l'extraction automatique n'a pas réussi. Le rapport sera généré principalement à partir du modèle et des instructions.`;
      } else {
        console.log('No data files provided, generating from template and instructions only');
        dataText = 'Aucun fichier de données fourni. Le rapport sera généré à partir du modèle de rédaction et des instructions.';
      }
    }

    console.log('Total data text length:', dataText.length);

    // Get template content
    let templateContent = '';

    if (templateSource === 'file' && templateFilePath) {
      // Download template file
      const { data: templateFileData, error: templateDownloadError } = await supabase.storage
        .from('reports')
        .download(templateFilePath);

      if (templateDownloadError) {
        console.error('Template download error:', templateDownloadError);
        // Continue without template - not critical
        templateContent = '';
      } else {
        const templateFileName = templateFilePath.toLowerCase();

        if (templateFileName.endsWith('.txt') || templateFileName.endsWith('.csv')) {
          templateContent = await templateFileData.text();
        } else {
          try {
            const textAttempt = await templateFileData.text();
            const validTextRatio = textAttempt.replace(/[^\x20-\x7E\n\r\t]/g, '').length / textAttempt.length;
            if (validTextRatio > 0.7) {
              templateContent = textAttempt;
            } else {
              templateContent = await extractTextWithAI(templateFileData, templateFilePath, lovableApiKey);
            }
          } catch (e) {
            templateContent = await extractTextWithAI(templateFileData, templateFilePath, lovableApiKey);
          }
        }
      }

      console.log('Template content length:', templateContent.length);

    } else if (templateSource === 'database' && selectedReportIds?.length > 0) {
      // Fetch analyses from selected reports
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select('id, title, report_analyses(*)')
        .in('id', selectedReportIds)
        .eq('user_id', user.id);

      if (reportsError) {
        console.error('Reports fetch error:', reportsError);
        throw new Error(`Erreur récupération rapports: ${reportsError.message}`);
      }

      if (reports && reports.length > 0) {
        templateContent = reports.map(r => {
          const analysis = r.report_analyses?.[0];
          return `
=== EXEMPLE DE RAPPORT: ${r.title} ===
Résumé: ${analysis?.summary || 'N/A'}
Points clés: ${analysis?.key_points?.join('\n- ') || 'N/A'}
Insights: ${analysis?.insights || 'N/A'}
KPIs: ${JSON.stringify(analysis?.kpis || {}, null, 2)}
===================================
`;
        }).join('\n\n');
      }

      console.log('Template content from database, length:', templateContent.length);
    }

    // Build prompt for AI
    const systemPrompt = `Tu es un expert en rédaction de rapports professionnels. Tu dois générer un rapport structuré et professionnel.

RÈGLES IMPORTANTES:
1. Si un modèle est fourni, suis son style et sa structure
2. Si les données sont limitées, utilise le titre et les instructions pour créer un rapport cohérent
3. Maintiens un ton professionnel
4. Inclus des KPIs pertinents
5. Génère un contenu complet et détaillé
6. N'utilise JAMAIS de caractères ** dans le texte

Réponds en JSON avec cette structure:
{
  "title": "Titre du rapport",
  "content": "Contenu complet du rapport en markdown (sans ** pour le gras, utilise simplement du texte normal)",
  "summary": "Résumé exécutif (200-300 mots)",
  "keyPoints": ["point1", "point2", "point3"],
  "kpis": {"KPI1": valeur, "KPI2": valeur},
  "insights": "Analyse et recommandations"
}`;

    const userPrompt = `TITRE SOUHAITÉ: ${reportTitle}

DONNÉES À ANALYSER:
${dataText.substring(0, 15000)}

${templateContent ? `MODÈLE DE RÉDACTION À SUIVRE:
${templateContent.substring(0, 10000)}` : 'Crée un rapport professionnel standard avec les sections habituelles: résumé exécutif, analyse, conclusions et recommandations.'}

${additionalInstructions ? `INSTRUCTIONS SUPPLÉMENTAIRES:
${additionalInstructions}` : ''}

Génère maintenant un rapport professionnel complet.`;

    console.log('Calling AI API... Arena mode:', useArena);

    let aiContent: string;
    let arenaDetails: any = null;

    // Arena mode: query multiple models and synthesize
    if (useArena && models && models.length > 0) {
      const enabledModels = models.filter((m: AIModel) => m.enabled);
      
      if (enabledModels.length > 0) {
        // Query all models in parallel
        const modelResponses = await Promise.all(
          enabledModels.map((model: AIModel) => queryModel(model, userPrompt, systemPrompt, lovableApiKey))
        );

        // Synthesize responses
        const { goldResponse, consensusScore } = await synthesizeResponses(modelResponses, lovableApiKey);
        aiContent = goldResponse;
        
        arenaDetails = {
          modelResponses: modelResponses.map(r => ({
            modelId: r.modelId,
            modelName: r.modelName,
            confidence: r.confidence,
            processingTime: r.processingTime,
            error: r.error
          })),
          consensusScore
        };

        console.log('Arena synthesis complete, consensus score:', consensusScore);
      } else {
        // Fallback to single model if no arena models configured
        const fallbackConfig = getAIProviderConfig();
        const aiResponse = await fetch(fallbackConfig.baseUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${fallbackConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: fallbackConfig.flashModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
          }),
        });

      if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('AI API error:', errorText);
          if (aiResponse.status === 402) {
            return new Response(JSON.stringify({ error: 'Crédits IA insuffisants. Veuillez recharger vos crédits dans les paramètres du workspace.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          if (aiResponse.status === 429) {
            return new Response(JSON.stringify({ error: 'Trop de requêtes. Veuillez réessayer dans quelques instants.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          throw new Error('Erreur génération IA');
        }

        const aiData = await aiResponse.json();
        aiContent = aiData.choices[0].message.content;
      }
    } else {
      // Standard single model mode
      const stdConfig = getAIProviderConfig();
      const aiResponse = await fetch(stdConfig.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stdConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: stdConfig.flashModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI API error:', errorText);
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: 'Crédits IA insuffisants. Veuillez recharger vos crédits dans les paramètres du workspace.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: 'Trop de requêtes. Veuillez réessayer dans quelques instants.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        throw new Error('Erreur génération IA');
      }

      const aiData = await aiResponse.json();
      aiContent = aiData.choices[0].message.content;
    }

    console.log('AI response received');

    // Parse JSON response
    let result;
    try {
      const jsonMatch = aiContent.match(/```json\n([\s\S]*?)\n```/) || 
                       aiContent.match(/```\n([\s\S]*?)\n```/) ||
                       aiContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiContent;
      result = JSON.parse(jsonStr);
    } catch (e) {
      console.error('JSON parse error:', e);
      result = {
        title: reportTitle,
        content: aiContent.replace(/\*\*/g, ''),
        summary: '',
        keyPoints: [],
        kpis: {},
        insights: ''
      };
    }

    // Clean markdown asterisks from all text fields
    if (result.content) result.content = result.content.replace(/\*\*/g, '');
    if (result.summary) result.summary = result.summary.replace(/\*\*/g, '');
    if (result.insights) result.insights = result.insights.replace(/\*\*/g, '');

    // Create report in database
    const primaryFilePath = allDataFilePaths[0] || templateFilePath || null;
    const { data: newReport, error: insertError } = await supabase
      .from('reports')
      .insert({
        user_id: user.id,
        title: result.title || reportTitle,
        report_type: 'current',
        status: 'completed',
        file_path: primaryFilePath,
        metadata: {
          generated_from_template: true,
          template_source: templateSource,
          template_reports: selectedReportIds || [],
          data_files: allDataFilePaths,
          arena_details: arenaDetails,
        }
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Erreur création rapport: ${insertError.message}`);
    }

    console.log('Report created:', newReport.id);

    // Create analysis
    const { error: analysisError } = await supabase
      .from('report_analyses')
      .insert({
        report_id: newReport.id,
        summary: result.summary || result.content?.substring(0, 500),
        key_points: result.keyPoints || [],
        kpis: result.kpis || {},
        insights: result.insights || ''
      });

    if (analysisError) {
      console.error('Analysis insert error:', analysisError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        reportId: newReport.id,
        title: result.title,
        content: result.content 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Generate from template error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
