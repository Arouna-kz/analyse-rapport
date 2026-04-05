import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to convert Excel JSON data to readable text
function formatExcelJsonToText(jsonData: any): string {
  try {
    let result = '';
    
    if (Array.isArray(jsonData)) {
      jsonData.forEach((sheet: any, sheetIndex: number) => {
        const sheetName = sheet.SheetName || `Feuille ${sheetIndex + 1}`;
        result += `\n=== ${sheetName} ===\n`;
        
        if (sheet.Rows && Array.isArray(sheet.Rows)) {
          sheet.Rows.forEach((row: any) => {
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
      result = JSON.stringify(jsonData, null, 2);
    }
    
    return result || JSON.stringify(jsonData, null, 2);
  } catch (e) {
    console.error('Error formatting Excel JSON:', e);
    return JSON.stringify(jsonData, null, 2);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId } = await req.json();
    
    if (!reportId) {
      return new Response(
        JSON.stringify({ error: 'Report ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cloudmersiveApiKey = Deno.env.get('CLOUDMERSIVE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get report details
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

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
    const isImage = report.file_type?.startsWith('image/') ||
                    /\.(jpg|jpeg|png|webp|gif|bmp|tiff)$/i.test(report.file_path || '');
    
    if (isImage) {
      // Direct AI Vision extraction for images
      console.log('Processing image file with AI Vision...');
      try {
        const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
        if (lovableApiKey) {
          const arrayBuffer = await fileData.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          const base64Data = btoa(binary);
          const mimeType = report.file_type || 'image/jpeg';

          const visionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-pro',
              messages: [
                {
                  role: 'system',
                  content: 'Tu es un expert en OCR. Extrais TOUT le texte visible de l\'image, en préservant la structure (tableaux, colonnes, titres). Pour les tableaux, utilise des séparateurs "|".'
                },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: `Extrais intégralement le contenu de cette image "${report.title}".` },
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                  ]
                }
              ],
              temperature: 0.1,
            }),
          });

          if (visionResponse.ok) {
            const visionData = await visionResponse.json();
            extractedText = visionData.choices?.[0]?.message?.content || '';
            console.log('Image Vision extraction successful, length:', extractedText.length);
          }
        }
      } catch (e) {
        console.error('Image extraction error:', e);
      }

      if (!extractedText || extractedText.replace(/\s+/g, '').length < 20) {
        extractedText = `[Image]\nTitre: ${report.title}\nType: ${report.file_type}\nTaille: ${fileData.size} bytes\nNote: Aucun texte significatif extrait de l'image.`;
      }
    } else if (report.file_type === 'text/plain') {
      extractedText = await fileData.text();
    } else if (isExcel) {
      const formData = new FormData();
      formData.append('inputFile', fileData);
      
      try {
        // Try Excel to CSV conversion
        const csvResponse = await fetch('https://api.cloudmersive.com/convert/xlsx/to/csv', {
          method: 'POST',
          headers: { 'Apikey': cloudmersiveApiKey },
          body: formData,
        });

        if (csvResponse.ok) {
          extractedText = await csvResponse.text();
        } else {
          // Fallback: try Excel to JSON
          const formData2 = new FormData();
          formData2.append('inputFile', fileData);
          
          const jsonResponse = await fetch('https://api.cloudmersive.com/convert/xlsx/to/json', {
            method: 'POST',
            headers: { 'Apikey': cloudmersiveApiKey },
            body: formData2,
          });

          if (jsonResponse.ok) {
            const jsonData = await jsonResponse.json();
            extractedText = formatExcelJsonToText(jsonData);
          } else {
            extractedText = `[Fichier Excel - Extraction non disponible]\nTitre: ${report.title}\nTaille: ${fileData.size} bytes`;
          }
        }
      } catch (e) {
        console.error('Excel extraction error:', e);
        extractedText = `[Fichier Excel]\nTitre: ${report.title}\nErreur d'extraction: ${e instanceof Error ? e.message : 'Unknown error'}`;
      }
    } else if (report.file_type === 'application/pdf' || 
               report.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const formData = new FormData();
      formData.append('inputFile', fileData);
      
      const endpoint = report.file_type === 'application/pdf' 
        ? 'https://api.cloudmersive.com/convert/pdf/to/txt'
        : 'https://api.cloudmersive.com/convert/docx/to/txt';
      
      try {
        const extractResponse = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Apikey': cloudmersiveApiKey },
          body: formData,
        });

        if (extractResponse.ok) {
          const result = await extractResponse.json();
          extractedText = result.TextResult || '';
        } else {
          extractedText = '';
        }
      } catch (e) {
        console.error('Document extraction error:', e);
        extractedText = '';
      }
    }

    // ===== HYBRID OCR FALLBACK via AI Vision =====
    const isTextTooShort = extractedText.replace(/\s+/g, '').length < 80;
    if (isTextTooShort && (report.file_type === 'application/pdf' || report.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      console.log('Text extraction insufficient, activating AI Vision OCR fallback...');
      try {
        const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
        if (lovableApiKey) {
          const arrayBuffer = await fileData.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          const base64Data = btoa(binary);
          const mimeType = report.file_type;

          const visionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-pro',
              messages: [
                {
                  role: 'system',
                  content: 'Tu es un expert en OCR. Extrais TOUT le texte visible du document, en préservant la structure (tableaux, colonnes, titres). Pour les tableaux, utilise des séparateurs "|".'
                },
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: `Extrais intégralement le contenu de ce document "${report.title}".` },
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                  ]
                }
              ],
              temperature: 0.1,
            }),
          });

          if (visionResponse.ok) {
            const visionData = await visionResponse.json();
            const visionText = visionData.choices?.[0]?.message?.content || '';
            if (visionText.replace(/\s+/g, '').length > 80) {
              extractedText = `[Extraction par OCR IA]\n${visionText}`;
              console.log('AI Vision OCR successful, length:', extractedText.length);
            }
          }
        }
      } catch (visionErr) {
        console.error('AI Vision OCR error:', visionErr);
      }
    }

    if (!extractedText) {
      extractedText = `Aucun contenu textuel n'a pu être extrait de ce fichier.\nType: ${report.file_type}\nTaille: ${fileData.size} bytes`;
    }

    return new Response(
      JSON.stringify({ 
        extractedText,
        fileType: report.file_type,
        fileName: report.title,
        fileSize: fileData.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
