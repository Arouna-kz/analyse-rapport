import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
// Pure-JS extractors — portables, sans dépendance SaaS (remplacent Cloudmersive)
import { extractText as unpdfExtractText, getDocumentProxy } from 'npm:unpdf@0.12.1';
import mammoth from 'npm:mammoth@1.8.0';
import * as XLSX from 'npm:xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let j = 0; j < buf.length; j += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(j, j + CHUNK));
  }
  return btoa(binary);
}

async function extractPdfText(fileData: Blob): Promise<string> {
  try {
    const buf = new Uint8Array(await fileData.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const { text } = await unpdfExtractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join('\n') : (text || '');
  } catch (e) {
    console.error('[unpdf] failed:', e);
    return '';
  }
}

async function extractDocxText(fileData: Blob): Promise<string> {
  try {
    const buf = await fileData.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value || '';
  } catch (e) {
    console.error('[mammoth] failed:', e);
    return '';
  }
}

async function extractXlsxText(fileData: Blob): Promise<string> {
  try {
    const buf = new Uint8Array(await fileData.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'array' });
    const parts: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName], { FS: ' | ' });
      if (csv.trim()) parts.push(`=== ${sheetName} ===\n${csv}`);
    }
    return parts.join('\n\n');
  } catch (e) {
    console.error('[xlsx] failed:', e);
    return '';
  }
}

import { logAIUsage } from '../_shared/ai-provider.ts';

// Envoie le document binaire entier à Gemini via Lovable AI (100 % LOVABLE_API_KEY)
async function visionExtractWholeDocument(
  fileData: Blob,
  mimeType: string,
  reportTitle: string,
  lovableApiKey: string,
): Promise<string> {
  const start = Date.now();
  const model = 'google/gemini-2.5-pro';
  try {
    const base64 = await blobToBase64(fileData);
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Tu es un expert en OCR. Extrais TOUT le texte visible du document (toutes pages), en préservant les tableaux avec "|", titres, listes et tous les chiffres/dates/montants.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Extrais intégralement le contenu de "${reportTitle}".` },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
            ]
          }
        ],
        temperature: 0.1,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('[VISION] Lovable AI failed:', resp.status, errText);
      logAIUsage({ functionName: 'preview-extracted-content', provider: 'lovable', model,
        status: 'error', latencyMs: Date.now() - start, errorMessage: `HTTP ${resp.status}` });
      return '';
    }
    const data = await resp.json();
    const usage = data?.usage;
    logAIUsage({ functionName: 'preview-extracted-content', provider: 'lovable', model,
      status: 'success', latencyMs: Date.now() - start,
      inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens });
    return data?.choices?.[0]?.message?.content || '';
  } catch (e) {
    console.error('[VISION] error:', e);
    logAIUsage({ functionName: 'preview-extracted-content', provider: 'lovable', model,
      status: 'error', latencyMs: Date.now() - start, errorMessage: e instanceof Error ? e.message : 'unknown' });
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId } = await req.json();
    if (!reportId) {
      return new Response(JSON.stringify({ error: 'Report ID is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: report, error: reportError } = await supabase
      .from('reports').select('*').eq('id', reportId).single();
    if (reportError || !report) throw new Error('Report not found');

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('reports').download(report.file_path);
    if (downloadError || !fileData) throw new Error('Failed to download file');

    let extractedText = '';
    const isExcel = report.file_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    report.file_type === 'application/vnd.ms-excel' ||
                    report.file_path?.endsWith('.xlsx') || report.file_path?.endsWith('.xls');
    const isImage = report.file_type?.startsWith('image/') ||
                    /\.(jpg|jpeg|png|webp|gif|bmp|tiff)$/i.test(report.file_path || '');

    if (isImage && lovableApiKey) {
      extractedText = await visionExtractWholeDocument(fileData, report.file_type || 'image/jpeg', report.title, lovableApiKey);
      if (!extractedText.trim()) {
        extractedText = `[Image]\nTitre: ${report.title}\nType: ${report.file_type}\nTaille: ${fileData.size} bytes`;
      }
    } else if (report.file_type === 'text/plain') {
      extractedText = await fileData.text();
    } else if (isExcel) {
      extractedText = await extractXlsxText(fileData);
    } else if (report.file_type === 'application/pdf') {
      extractedText = await extractPdfText(fileData);
    } else if (report.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractedText = await extractDocxText(fileData);
    }

    // Vision fallback (PDF scanné ou DOCX vide)
    const isTextTooShort = extractedText.replace(/\s+/g, '').length < 80;
    if (isTextTooShort && lovableApiKey && (report.file_type === 'application/pdf' || report.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      console.log('Text extraction insufficient — sending whole binary to Gemini Vision...');
      const ocrText = await visionExtractWholeDocument(fileData, report.file_type, report.title, lovableApiKey);
      if (ocrText.replace(/\s+/g, '').length > 80) {
        extractedText = `[Extraction par OCR IA — Gemini Vision]\n${ocrText}`;
      }
    }

    if (!extractedText) {
      extractedText = `Aucun contenu textuel n'a pu être extrait de ce fichier.\nType: ${report.file_type}\nTaille: ${fileData.size} bytes`;
    }

    return new Response(JSON.stringify({
      extractedText,
      fileType: report.file_type,
      fileName: report.title,
      fileSize: fileData.size
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
