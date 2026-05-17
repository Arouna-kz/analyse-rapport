import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { callAI, getAIProviderConfig, translateModel, MODEL_API_NAMES } from '../_shared/ai-provider.ts';
import { mergeAdminArenaProviders, filterCallableModels } from '../_shared/arena-providers.ts';
// Pure-JS extractors (portables — fonctionnent sur n'importe quel runtime Deno/Node, pas de SaaS tiers)
import { extractText as unpdfExtractText, getDocumentProxy } from 'npm:unpdf@0.12.1';
import mammoth from 'npm:mammoth@1.8.0';
import * as XLSX from 'npm:xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Vision provider descriptor for the OCR consensus pipeline
interface VisionProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string; // e.g. "google/gemini-2.5-pro" or "gpt-4o"
  providerType: 'lovable' | 'openai' | 'gemini' | 'custom';
}

interface PdfPageImage {
  pageNumber: number;
  base64: string;
  mimeType?: string; // defaults to 'image/png' (legacy). Use 'application/pdf' for whole-PDF Vision fallback.
}

// Universal polyvalent system prompt — works for ALL document types (text-based PDFs, scans, images, Excel, DOCX...)
const UNIVERSAL_DOCUMENT_ANALYST_PROMPT = `Tu es un expert en analyse de documents multi-formats.
- Si ce document contient une couche de texte, analyse-le normalement.
- S'il s'agit d'un SCAN (image), utilise tes capacités de vision pour transcrire visuellement les informations, en particulier les tableaux de données, les chiffres clés et les titres de section.
Ta mission est d'extraire la substance du rapport (KPIs, conclusions, données financières) quel que soit le support visuel. Ne rejette jamais un document au motif qu'il manque de texte brut : décris ce que tu vois sur les images, transcris fidèlement les tableaux avec des séparateurs "|", et conserve tous les chiffres, dates et montants.`;

const SCANNED_PDF_VISION_SYSTEM_PROMPT = UNIVERSAL_DOCUMENT_ANALYST_PROMPT;

function isExtractionFailure(text: string): boolean {
  const compactLength = (text || '').replace(/\s+/g, '').length;
  const lower = (text || '').toLowerCase();
  return compactLength < 80 ||
    lower.includes('no text found') ||
    lower.includes('aucun texte') ||
    lower.includes('aucun contenu textuel') ||
    lower.includes('extraction textuelle directe n') ||
    lower.includes('failed to extract') ||
    lower.includes('could not extract');
}

// Call one vision provider on one page, returns extracted text or ''
async function callVisionProvider(
  provider: VisionProvider,
  base64Img: string,
  pageLabel: string,
  reportTitle: string,
): Promise<string> {
  try {
    const cleanBase64 = base64Img.replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');
    const prompt = `${pageLabel} du document "${reportTitle}". Extrais intégralement le texte visible, en conservant les tableaux avec des séparateurs "|" et tous les chiffres/dates/montants.`;
    const nativeGemini = provider.providerType === 'gemini';

    if (nativeGemini) {
      const root = provider.baseUrl
        .replace(/\/+$/, '')
        .replace(/\/v1beta\/openai\/chat\/completions$/, '')
        .replace(/\/v1beta$/, '');
      const url = `${root}/v1beta/models/${provider.modelName}:generateContent?key=${provider.apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: `${SCANNED_PDF_VISION_SYSTEM_PROMPT}\n\n${prompt}` },
              { inlineData: { mimeType: 'image/png', data: cleanBase64 } },
            ],
          }],
          generationConfig: { temperature: 0.1 },
        }),
      });
      if (!resp.ok) {
        console.error(`[OCR-CONSENSUS] ${provider.name} failed: ${resp.status}`);
        return '';
      }
      const data = await resp.json();
      return (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('\n').trim();
    }

    const resp = await fetch(provider.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.modelName,
        messages: [
          {
            role: 'system',
            content: SCANNED_PDF_VISION_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${cleanBase64}` } }
            ]
          }
        ],
        temperature: 0.1,
      }),
    });
    if (!resp.ok) {
      console.error(`[OCR-CONSENSUS] ${provider.name} failed: ${resp.status}`);
      return '';
    }
    const data = await resp.json();
    return (data?.choices?.[0]?.message?.content || '').trim();
  } catch (e) {
    console.error(`[OCR-CONSENSUS] ${provider.name} error:`, e);
    return '';
  }
}

// =============================================================================
// PURE-JS EXTRACTORS (remplacent Cloudmersive — portables, sans dépendance SaaS)
// =============================================================================

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let j = 0; j < buf.length; j += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(j, j + CHUNK));
  }
  return btoa(binary);
}

// PDF → texte via unpdf (pdf.js sans canvas, fonctionne en Deno)
async function extractPdfTextWithUnpdf(fileData: Blob): Promise<string> {
  try {
    const buf = new Uint8Array(await fileData.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const { text } = await unpdfExtractText(pdf, { mergePages: true });
    const joined = Array.isArray(text) ? text.join('\n') : (text || '');
    console.log(`[unpdf] Extracted ${joined.length} chars from ${pdf.numPages} page(s)`);
    return joined;
  } catch (e) {
    console.error('[unpdf] PDF text extraction failed:', e);
    return '';
  }
}

// DOCX → texte via mammoth
async function extractDocxTextWithMammoth(fileData: Blob): Promise<string> {
  try {
    const buf = await fileData.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    console.log(`[mammoth] Extracted ${result.value.length} chars from DOCX`);
    return result.value || '';
  } catch (e) {
    console.error('[mammoth] DOCX extraction failed:', e);
    return '';
  }
}

// XLSX → texte CSV via SheetJS
async function extractXlsxTextWithSheetJS(fileData: Blob): Promise<string> {
  try {
    const buf = new Uint8Array(await fileData.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'array' });
    const parts: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ' | ' });
      if (csv.trim()) parts.push(`=== ${sheetName} ===\n${csv}`);
    }
    const out = parts.join('\n\n');
    console.log(`[xlsx] Extracted ${out.length} chars from ${wb.SheetNames.length} sheet(s)`);
    return out;
  } catch (e) {
    console.error('[xlsx] Excel extraction failed:', e);
    return '';
  }
}

// Pick the best OCR result among multiple providers (longest meaningful text)
function pickBestOcrText(results: Array<{ providerName: string; text: string }>): { text: string; chosen: string; agreement: number } {
  const valid = results.filter(r => r.text.replace(/\s+/g, '').length > 20);
  if (valid.length === 0) return { text: '', chosen: 'none', agreement: 0 };
  valid.sort((a, b) => b.text.length - a.text.length);
  const best = valid[0];
  const tokens = (s: string) => new Set((s.match(/\b\d[\d.,]*\b|\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g) || []));
  const baseTokens = tokens(best.text);
  let agreementSum = 0;
  let comparisons = 0;
  for (let i = 1; i < valid.length; i++) {
    const t = tokens(valid[i].text);
    const inter = [...baseTokens].filter(x => t.has(x)).length;
    const union = new Set([...baseTokens, ...t]).size || 1;
    agreementSum += inter / union;
    comparisons++;
  }
  return { text: best.text, chosen: best.providerName, agreement: comparisons > 0 ? agreementSum / comparisons : 1 };
}

// =============================================================================
// VISION FALLBACK : envoie le PDF/document binaire ENTIER à Gemini via Lovable AI
// Gemini accepte nativement les PDF en inlineData — 100 % via LOVABLE_API_KEY,
// pas de conversion par page nécessaire (donc pas de canvas / pas de SaaS tiers).
// =============================================================================
async function visionExtractDocumentWithGemini(
  fileData: Blob,
  mimeType: string,
  reportTitle: string,
  providers: VisionProvider[]
): Promise<string> {
  if (providers.length === 0) return '';
  const base64 = await blobToBase64(fileData);
  const prompt = `Document: "${reportTitle}".\nExtrais intégralement le contenu textuel (toutes pages incluses), en préservant la structure des tableaux avec des séparateurs "|", et en conservant tous les chiffres, montants, dates et titres. Ne résume pas.`;

  const results: Array<{ providerName: string; text: string }> = [];

  await Promise.all(providers.map(async (provider) => {
    try {
      const nativeGemini = provider.providerType === 'gemini';
      if (nativeGemini) {
        const root = provider.baseUrl
          .replace(/\/+$/, '')
          .replace(/\/v1beta\/openai\/chat\/completions$/, '')
          .replace(/\/v1beta$/, '');
        const url = `${root}/v1beta/models/${provider.modelName}:generateContent?key=${provider.apiKey}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { text: `${SCANNED_PDF_VISION_SYSTEM_PROMPT}\n\n${prompt}` },
                { inlineData: { mimeType, data: base64 } },
              ],
            }],
            generationConfig: { temperature: 0.1 },
          }),
        });
        if (!resp.ok) {
          console.error(`[VISION-DOC] ${provider.name} failed: ${resp.status} ${await resp.text().catch(() => '')}`);
          return;
        }
        const data = await resp.json();
        const text = (data?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('\n').trim();
        if (text) results.push({ providerName: provider.name, text });
        return;
      }

      // Lovable AI Gateway (OpenAI-compatible) — Gemini accepte le PDF via data URL
      const resp = await fetch(provider.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.modelName,
          messages: [
            { role: 'system', content: SCANNED_PDF_VISION_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
              ],
            },
          ],
          temperature: 0.1,
        }),
      });
      if (!resp.ok) {
        console.error(`[VISION-DOC] ${provider.name} failed: ${resp.status} ${await resp.text().catch(() => '')}`);
        return;
      }
      const data = await resp.json();
      const text = (data?.choices?.[0]?.message?.content || '').trim();
      if (text) results.push({ providerName: provider.name, text });
    } catch (e) {
      console.error(`[VISION-DOC] ${provider.name} error:`, e);
    }
  }));

  const { text, chosen, agreement } = pickBestOcrText(results);
  console.log(`[VISION-DOC] Consensus: chosen=${chosen}, agreement=${agreement.toFixed(2)}, length=${text.length}, providers=${providers.length}`);
  return text;
}

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

// =============================================================================
// POST-OCR NORMALIZATION
// Standardizes table separators, currency amounts (-> "1234.56 EUR"),
// and dates (-> "YYYY-MM-DD") so KPIs are comparable across documents.
// =============================================================================
function normalizeExtractedText(input: string): string {
  if (!input) return input;
  let text = input;

  // 1) Normalize line endings + strip non-printables (keep \n \t)
  text = text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '');

  // 2) Table separator normalization — collapse runs of TABs / 2+ spaces / ";" between cells into " | "
  text = text
    .split('\n')
    .map((line) => {
      // Skip lines already using "|" — just tidy spacing around it
      if (line.includes('|')) {
        return line.replace(/\s*\|\s*/g, ' | ').replace(/[ \t]+$/g, '');
      }
      // Heuristic: a row with 2+ tab-separated or semicolon-separated tokens becomes pipe-delimited
      if (/\t/.test(line) || /;[^;]/.test(line)) {
        return line.split(/\t+|\s*;\s*/).map(s => s.trim()).filter(Boolean).join(' | ');
      }
      // Multiple 3+ spaces likely indicate column gaps (only when at least 3 columns)
      const cols = line.split(/ {3,}/).map(s => s.trim()).filter(Boolean);
      if (cols.length >= 3) return cols.join(' | ');
      return line.replace(/[ \t]+/g, ' ').replace(/ $/, '');
    })
    .join('\n');

  // 3) Currency amount normalization → "<number> <CCY>"
  //    Handles: "1 234,56 €", "€ 1.234,56", "$1,234.56", "USD 12 000", "12.000,50 EUR", "12,000.50 USD"
  const currencyMap: Record<string, string> = {
    '€': 'EUR', 'eur': 'EUR', 'euros': 'EUR', 'euro': 'EUR',
    '$': 'USD', 'usd': 'USD', 'us$': 'USD',
    '£': 'GBP', 'gbp': 'GBP',
    'cad': 'CAD', 'c$': 'CAD',
    'chf': 'CHF',
    'cfa': 'XOF', 'xof': 'XOF', 'fcfa': 'XOF',
  };
  const normalizeAmount = (raw: string): string => {
    let s = raw.replace(/\s|\u00A0|'/g, '');
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
      // Last separator wins as decimal
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      // Decide if comma is decimal (e.g. "1234,56") or thousands (e.g. "12,000")
      const parts = s.split(',');
      if (parts.length === 2 && parts[1].length <= 2) s = parts[0] + '.' + parts[1];
      else s = s.replace(/,/g, '');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n.toString() : raw.trim();
  };
  // Pattern: optional currency before, number, optional currency after
  const cur = '(€|\\$|£|USD|EUR|GBP|CAD|CHF|XOF|FCFA|US\\$|C\\$)';
  const num = '(-?\\d{1,3}(?:[ \\u00A0\\.,\']\\d{3})*(?:[\\.,]\\d+)?|-?\\d+(?:[\\.,]\\d+)?)';
  const reAmt = new RegExp(`(?:${cur}\\s*${num}|${num}\\s*${cur})`, 'gi');
  text = text.replace(reAmt, (_m, c1, n1, n2, c2) => {
    const amount = normalizeAmount((n1 ?? n2) as string);
    const code = currencyMap[((c1 ?? c2) as string).toLowerCase()] || (c1 ?? c2);
    return `${amount} ${code}`;
  });

  // 4) Date normalization → ISO "YYYY-MM-DD"
  //    Handles DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (FR), and YYYY/MM/DD
  const pad = (n: string) => (n.length === 1 ? '0' + n : n);
  text = text.replace(
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})\b/g,
    (_m, d, mo, y) => {
      const yyyy = y.length === 2 ? (Number(y) > 50 ? '19' + y : '20' + y) : y;
      const mm = pad(mo);
      const dd = pad(d);
      if (Number(mm) > 12 || Number(dd) > 31) return _m;
      return `${yyyy}-${mm}-${dd}`;
    }
  );
  text = text.replace(
    /\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g,
    (_m, y, mo, d) => `${y}-${pad(mo)}-${pad(d)}`
  );

  // 5) Collapse 3+ blank lines
  text = text.replace(/\n{3,}/g, '\n\n');
  return text;
}

// =============================================================================
// STRICT JSON SCHEMA VALIDATION (Arena cross-model comparability)
// Required shape:
//   { summary: string, key_points: string[5], kpis: Record<string, number>, insights: string }
// Returns parsed object or { error } with an actionable, human-readable reason.
// =============================================================================
type AnalysisShape = {
  summary: string;
  key_points: string[];
  kpis: Record<string, number>;
  insights: string;
  consensus_notes?: string;
};
function validateAnalysisSchema(rawContent: string): { ok: true; data: AnalysisShape } | { ok: false; error: string } {
  if (!rawContent || typeof rawContent !== 'string') {
    return { ok: false, error: 'Réponse vide du modèle.' };
  }
  const stripped = rawContent.trim();
  // Try fenced ```json … ``` then bare object
  const fenced = stripped.match(/```json\s*([\s\S]*?)\s*```/i) || stripped.match(/```\s*([\s\S]*?)\s*```/);
  const objMatch = stripped.match(/\{[\s\S]*\}/);
  const candidate = fenced ? fenced[1] : (objMatch ? objMatch[0] : stripped);
  let parsed: any;
  try {
    parsed = JSON.parse(candidate);
  } catch (e) {
    return { ok: false, error: `JSON invalide (${(e as Error).message}). Le modèle n'a pas respecté le schéma demandé.` };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'La racine doit être un objet JSON.' };
  }
  const errs: string[] = [];
  if (typeof parsed.summary !== 'string' || parsed.summary.trim().length < 10) {
    errs.push('"summary" doit être une chaîne de ≥10 caractères');
  }
  if (!Array.isArray(parsed.key_points) || parsed.key_points.length < 1 || !parsed.key_points.every((p: any) => typeof p === 'string' && p.trim().length > 0)) {
    errs.push('"key_points" doit être un tableau de chaînes non vides');
  }
  if (!parsed.kpis || typeof parsed.kpis !== 'object' || Array.isArray(parsed.kpis)) {
    errs.push('"kpis" doit être un objet { nom: nombre }');
  } else {
    // Coerce numeric strings ("85", "12,5", "12%") into numbers; drop entries that cannot be coerced.
    const cleaned: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed.kpis)) {
      if (typeof v === 'number' && Number.isFinite(v)) { cleaned[k] = v; continue; }
      if (typeof v === 'string') {
        const m = v.replace(/\s|\u00A0/g, '').match(/-?\d+(?:[.,]\d+)?/);
        if (m) { const n = Number(m[0].replace(',', '.')); if (Number.isFinite(n)) cleaned[k] = n; }
      }
    }
    if (Object.keys(cleaned).length === 0) {
      errs.push('"kpis" doit contenir au moins une valeur numérique exploitable');
    } else {
      parsed.kpis = cleaned;
    }
  }
  if (typeof parsed.insights !== 'string' || parsed.insights.trim().length < 5) {
    errs.push('"insights" doit être une chaîne non vide');
  }
  if (errs.length > 0) {
    return { ok: false, error: `Schéma non conforme — ${errs.join(' ; ')}.` };
  }
  return { ok: true, data: parsed as AnalysisShape };
}

interface AIModel {
  id: string;
  name: string;
  baseUrl: string;
  isLovableAI: boolean;
  apiKey?: string;
  modelName?: string;
  provider?: string;
}

interface ModelResponse {
  modelId: string;
  modelName: string;
  response: string; // canonical normalized JSON string when status==='success'
  confidence: number;
  status: 'success' | 'error';
  errorMessage?: string;
  validated?: AnalysisShape;
}

async function queryModelForAnalysis(
  model: AIModel,
  prompt: string,
  lovableApiKey: string,
  images: PdfPageImage[] = [],
): Promise<ModelResponse> {
  try {
    const config = getAIProviderConfig();
    const apiKey = model.isLovableAI ? config.apiKey : (model.apiKey || (model.provider === 'ollama' ? 'ollama' : ''));
    const baseUrl = model.isLovableAI ? config.baseUrl : model.baseUrl;

    if (!apiKey || !baseUrl) {
      throw new Error('Missing API key or base URL');
    }

    const rawModelName = model.modelName || MODEL_API_NAMES[model.id] || model.id;
    const modelName = model.isLovableAI ? translateModel(rawModelName) : rawModelName;
    const nativeGemini = model.provider === 'gemini';

    // Helper: one call attempt
    const callOnce = async (extraReminder?: string) => {
      const sys = `${UNIVERSAL_DOCUMENT_ANALYST_PROMPT}\n\nRéponds TOUJOURS en JSON STRICTEMENT valide, en suivant le schéma demandé (mêmes clés, mêmes types) afin de permettre la comparaison "pomme contre pomme" entre les modèles de l'Arena. AUCUN texte hors JSON, AUCUNE balise markdown.${extraReminder ? '\n\n' + extraReminder : ''}`;
      if (nativeGemini) {
        const root = baseUrl
          .replace(/\/+$/, '')
          .replace(/\/v1beta\/openai\/chat\/completions$/, '')
          .replace(/\/v1beta$/, '');
        const resp = await fetch(`${root}/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { text: `${sys}\n\n${prompt}` },
                ...images.map(img => ({
                  inlineData: { mimeType: img.mimeType || 'image/png', data: img.base64.replace(/\s/g, '') },
                })),
              ],
            }],
            generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
          }),
        });
        if (!resp.ok) throw new Error(`API error: ${resp.status} ${await resp.text().catch(() => '')}`.slice(0, 300));
        const json = await resp.json();
        return (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('\n') as string;
      }

      const userContent = images.length > 0
        ? [
            { type: 'text', text: prompt },
            ...images.map(img => ({
              type: 'image_url',
              image_url: { url: `data:${img.mimeType || 'image/png'};base64,${img.base64.replace(/\s/g, '')}` },
            })),
          ]
        : prompt;
      const resp = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: userContent },
          ],
          temperature: 0.4,
          response_format: { type: 'json_object' },
        }),
      });
      if (!resp.ok) throw new Error(`API error: ${resp.status} ${await resp.text().catch(() => '')}`.slice(0, 300));
      const json = await resp.json();
      return (json.choices?.[0]?.message?.content || '') as string;
    };

    let content = await callOnce();
    let validation = validateAnalysisSchema(content);

    // One corrective retry if the model deviated from the schema
    if (!validation.ok) {
      console.warn(`[ARENA-VALIDATE] ${model.name}: ${validation.error} — retrying with corrective reminder`);
      const reminder = `RAPPEL CRITIQUE — la réponse précédente a été REJETÉE par le validateur de schéma : "${validation.error}". Renvoie uniquement un objet JSON conforme au schéma exact suivant : {"summary": string, "key_points": string[], "kpis": {string: number}, "insights": string}.`;
      content = await callOnce(reminder);
      validation = validateAnalysisSchema(content);
    }

    if (!validation.ok) {
      // Actionable error returned to the orchestrator — model is excluded from consensus
      return {
        modelId: model.id,
        modelName: model.name,
        response: content,
        confidence: 0,
        status: 'error',
        errorMessage: `Sortie non conforme au schéma Arena : ${validation.error}`,
      };
    }

    const canonicalJson = JSON.stringify(validation.data);
    const confidence = Math.min(0.95, 0.6 + (canonicalJson.length / 2000) * 0.25 + 0.15);
    return {
      modelId: model.id,
      modelName: model.name,
      response: canonicalJson,
      confidence,
      status: 'success',
      validated: validation.data,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error querying ${model.name}:`, msg);
    return {
      modelId: model.id,
      modelName: model.name,
      response: '',
      confidence: 0,
      status: 'error',
      errorMessage: msg,
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

  let reportIdForError: string | undefined;
  try {
    const { reportId, useArena = true, arenaModels } = await req.json();
    reportIdForError = reportId;
    
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
    // Cloudmersive supprimé — toute l'extraction passe désormais par des libs JS pures (unpdf/mammoth/xlsx) + Gemini Vision via LOVABLE_API_KEY.
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
    let isScan = false;
    let scanPageImages: PdfPageImage[] = [];
    const isExcel = report.file_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    report.file_type === 'application/vnd.ms-excel' ||
                    report.file_path?.endsWith('.xlsx') ||
                    report.file_path?.endsWith('.xls');
    const isImage = report.file_type?.startsWith('image/') ||
                    /\.(jpg|jpeg|png|webp|gif|bmp|tiff)$/i.test(report.file_path || '');
    
    console.log('File type:', report.file_type, 'Is Excel:', isExcel, 'Is Image:', isImage);

    if (isImage) {
      // Direct AI Vision extraction for images
      console.log('Processing image file with AI Vision...');
      try {
        const arrayBuffer = await fileData.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64Data = btoa(binary);
        const mimeType = report.file_type || 'image/jpeg';

        const visionConfig = getAIProviderConfig();
        const visionResponse = await fetch(visionConfig.baseUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${visionConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: visionConfig.proModel,
            messages: [
              {
                role: 'system',
                content: `Tu es un expert en OCR et extraction de données. Extrais TOUT le texte visible de l'image, en préservant la structure (tableaux, colonnes, titres, listes). Pour les tableaux financiers ou budgétaires, aligne les colonnes avec des séparateurs "|". Ne résume pas, extrais fidèlement le contenu.`
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: `Extrais intégralement le contenu textuel de cette image "${report.title}". Préserve la structure, les tableaux et les chiffres.` },
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
          console.log('Image AI Vision extraction successful, length:', extractedText.length);
        }
      } catch (e) {
        console.error('Image extraction error:', e);
      }

      if (!extractedText || extractedText.replace(/\s+/g, '').length < 20) {
        extractedText = `[Image]\nTitre: ${report.title}\nType: ${report.file_type}\nTaille: ${fileData.size} bytes\nNote: Aucun texte significatif extrait de l'image.`;
      }
    } else if (report.file_type === 'text/plain') {
      extractedText = await fileData.text();
      console.log('Text file extracted, length:', extractedText.length);
    } else if (isExcel) {
      // SheetJS (pur JS, portable) — remplace Cloudmersive XLSX→CSV
      console.log('Processing Excel file with SheetJS...');
      extractedText = await extractXlsxTextWithSheetJS(fileData);
      if (!extractedText.trim()) {
        extractedText = `[FICHIER EXCEL]\nTitre: ${report.title}\nTaille: ${fileData.size} bytes\nNote: Extraction SheetJS vide.`;
      }
    } else if (report.file_type === 'application/pdf') {
      // unpdf (pdf.js sans canvas) — remplace Cloudmersive PDF→texte
      console.log('Processing PDF with unpdf...');
      extractedText = await extractPdfTextWithUnpdf(fileData);
    } else if (report.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // mammoth — remplace Cloudmersive DOCX→texte
      console.log('Processing DOCX with mammoth...');
      extractedText = await extractDocxTextWithMammoth(fileData);
    }

    // ===== VISION FALLBACK : si le texte est vide, on envoie le document binaire entier à Gemini =====
    const extractionFailed = isExtractionFailure(extractedText);
    if (extractionFailed && (report.file_type === 'application/pdf' || report.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      const isPdf = report.file_type === 'application/pdf';
      isScan = isPdf;
      if (isPdf) {
        await supabase
          .from('reports')
          .update({ metadata: { ...(report.metadata || {}), is_scan: true, ocr_status: 'vision_required' } })
          .eq('id', reportId);
      }
      console.log(`${isPdf ? 'PDF' : 'DOCX'} text extraction empty — sending whole document to Gemini Vision (via LOVABLE_API_KEY)...`);
      const visionConfig = getAIProviderConfig();

      const visionProviders: VisionProvider[] = [
        {
          id: 'lovable-gemini-pro-vision',
          name: 'Gemini 2.5 Pro (Lovable)',
          baseUrl: visionConfig.baseUrl,
          apiKey: visionConfig.apiKey,
          modelName: visionConfig.proModel,
          providerType: 'lovable',
        },
      ];

      // Ajout des providers Arena compatibles vision (OpenAI GPT-4o family, Gemini natif)
      try {
        const arenaVisionCandidates = await mergeAdminArenaProviders((arenaModels || []) as AIModel[]);
        for (const p of arenaVisionCandidates) {
          const ptype = (p.provider as string)?.toLowerCase();
          const mname = (p.modelName || '').toLowerCase();
          const supportsVision =
            (ptype === 'openai' && (mname.includes('gpt-4o') || mname.includes('gpt-4-turbo') || mname.includes('vision') || mname.includes('gpt-4.1') || mname.includes('gpt-5'))) ||
            (ptype === 'gemini' && mname.includes('gemini')) ||
            (ptype === 'custom' && (mname.includes('vision') || mname.includes('gpt-4o') || mname.includes('gemini')));
          if (supportsVision && p.apiKey && p.baseUrl && !visionProviders.some(v => v.id === p.id)) {
            visionProviders.push({
              id: p.id,
              name: p.name,
              baseUrl: p.baseUrl,
              apiKey: p.apiKey,
              modelName: p.modelName || '',
              providerType: ptype as VisionProvider['providerType'],
            });
          }
        }
      } catch (e) {
        console.error('Failed to load admin vision providers:', e);
      }

      console.log(`[VISION-DOC] Using ${visionProviders.length} vision provider(s): ${visionProviders.map(v => v.name).join(', ')}`);
      const ocrText = await visionExtractDocumentWithGemini(fileData, report.file_type, report.title, visionProviders);
      console.log(`Envoi du document binaire (${(fileData.size / 1024).toFixed(1)} KB) à ${visionProviders.length} modèle(s) vision`);
      if (ocrText.replace(/\s+/g, '').length > 80) {
        extractedText = `[Extraction par Vision IA (${visionProviders.length} modèle(s)) — ${isPdf ? 'PDF scanné' : 'DOCX'}]\n${ocrText}`;
        // Pour l'Arena : on attache le document entier comme "image" unique pour que les modèles le revoient au moment de l'analyse JSON
        if (isPdf) {
          scanPageImages = [{ pageNumber: 1, base64: await blobToBase64(fileData), mimeType: 'application/pdf' }];
        }
        console.log('Vision extraction successful, total length:', extractedText.length);
      } else {
        console.log('Vision extraction returned insufficient content');
      }
    }

    if (isExtractionFailure(extractedText)) {
      const fileSizeMb = (fileData.size / (1024 * 1024)).toFixed(1);
      const reason = `Extraction impossible pour ce document (${fileSizeMb} MB). unpdf/mammoth n'ont retourné aucun texte exploitable et Gemini Vision n'a pas pu lire le binaire. Vérifiez que le fichier n'est pas corrompu ou protégé par mot de passe.`;
      console.error(`[EXTRACTION-FATAL] ${reason}`);
      throw new Error(reason);
    }

    console.log('Text extracted, length:', extractedText.length);

    // Post-OCR normalization — uniformizes table separators, currency amounts and dates
    // so that KPIs extracted from different documents become comparable.
    const beforeNorm = extractedText.length;
    extractedText = normalizeExtractedText(extractedText);
    console.log(`[NORMALIZE] Post-OCR normalization: ${beforeNorm} → ${extractedText.length} chars`);

    // Detect document context for intelligent analysis
    const titleLower = report.title.toLowerCase();
    const isBudget = titleLower.includes('budget') || titleLower.includes('financ') || titleLower.includes('comptab') || titleLower.includes('trésorerie');
    const isProject = titleLower.includes('projet') || titleLower.includes('plan');
    
    let contextualInstructions = '';
    if (isBudget) {
      contextualInstructions = `\n\nINSTRUCTION CONTEXTUELLE - DOCUMENT FINANCIER/BUDGÉTAIRE:
Ce document est identifié comme un document financier. Cherche proactivement ces indicateurs même si la structure est irrégulière:
- Revenus / Recettes (totaux, par catégorie)
- Dépenses / Charges (fonctionnement, investissement)
- Solde / Résultat net
- Investissements prévus
- Ratios financiers (endettement, autofinancement)
- Évolutions par rapport aux exercices précédents
Si des données chiffrées sont présentes, extrais-les en KPIs avec les unités (€, %, etc.).`;
    } else if (isProject) {
      contextualInstructions = `\n\nINSTRUCTION CONTEXTUELLE - DOCUMENT PROJET:
Cherche proactivement: objectifs, jalons, budget alloué, échéances, parties prenantes, risques identifiés, indicateurs de suivi.`;
    }

    // Generate analysis prompt
    const analysisPrompt = `Analyse le rapport suivant et fournis:
1. Un résumé concis (3-5 phrases)
2. 5 points clés principaux
3. 3-5 KPIs pertinents avec des valeurs numériques
4. Des insights et recommandations
${contextualInstructions}

Type de rapport: ${report.report_type}
Titre: ${report.title}

Contenu:
${extractedText.substring(0, 8000)}

SCHÉMA JSON OBLIGATOIRE — réponds STRICTEMENT avec cette structure (mêmes clés, mêmes types) afin que les réponses des différents modèles puissent être comparées "pomme contre pomme":
{
  "summary": "résumé du rapport (string, 3-5 phrases)",
  "key_points": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "kpis": {"NomKPI1": 85, "NomKPI2": 92, "NomKPI3": 78},
  "insights": "insights et recommandations détaillées (string)"
}
N'ajoute AUCUNE clé supplémentaire. Les valeurs de "kpis" doivent être numériques (sans unité dans la valeur). Réponds uniquement avec un objet JSON valide, sans texte avant/après ni balises markdown.`;

    let analysis;

    if (useArena) {
      // Use Arena multi-model consensus
      console.log('Using Arena multi-model analysis');

      // Default Lovable models for Arena
      const defaultModels: AIModel[] = [
        { id: 'lovable-gemini-pro', name: 'Gemini 2.5 Pro', baseUrl: '', isLovableAI: true },
        { id: 'lovable-gemini-flash', name: 'Gemini 2.5 Flash', baseUrl: '', isLovableAI: true },
      ];

      // Merge user-selected models with admin-configured providers from DB
      const merged = await mergeAdminArenaProviders((arenaModels || []) as AIModel[]);
      const callable = filterCallableModels(merged) as AIModel[];
      const models: AIModel[] = callable.length > 0 ? callable : defaultModels;

      console.log(`Arena: Querying ${models.length} models in parallel for analysis`);

      // Query all models in parallel
      const modelResponses = await Promise.all(
        models.map(model => queryModelForAnalysis(model, analysisPrompt, lovableApiKey, isScan ? scanPageImages : []))
      );

      console.log(`Arena: Received ${modelResponses.filter(r => r.status === 'success').length} successful analyses`);

      // Synthesize responses
      analysis = await synthesizeAnalyses(modelResponses, analysisPrompt, lovableApiKey);

      // Add arena metadata — includes per-model schema validation errors so the UI can surface them
      analysis.arenaMetadata = {
        modelsUsed: modelResponses.map(r => ({
          id: r.modelId,
          name: r.modelName,
          status: r.status,
          confidence: r.confidence,
          errorMessage: r.errorMessage,
          schemaValid: r.status === 'success',
        })),
        consensusAchieved: modelResponses.filter(r => r.status === 'success').length > 1,
        schemaErrors: modelResponses
          .filter(r => r.status === 'error' && r.errorMessage)
          .map(r => ({ model: r.modelName, error: r.errorMessage })),
      };

    } else {
      // Use single model analysis (original flow)
      const singleConfig = getAIProviderConfig();
      const singleUserContent = isScan && scanPageImages.length > 0
        ? [
            { type: 'text', text: analysisPrompt },
            ...scanPageImages.map(img => ({
              type: 'image_url',
              image_url: { url: `data:${img.mimeType || 'image/png'};base64,${img.base64.replace(/\s/g, '')}` },
            })),
          ]
        : analysisPrompt;
      const analysisResponse = await fetch(singleConfig.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${singleConfig.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: singleConfig.flashModel,
          messages: [
            { role: 'system', content: `${UNIVERSAL_DOCUMENT_ANALYST_PROMPT}\n\nRéponds TOUJOURS en JSON valide, en suivant strictement le schéma demandé.` },
            { role: 'user', content: singleUserContent }
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

    // ===== Alert triggers =====
    // Helper: extract a numeric value from a KPI (handles "15%", "4.5/5", "66 980 000 €", etc.)
    const parseKpiNumber = (raw: unknown): number | null => {
      if (typeof raw === 'number' && isFinite(raw)) return raw;
      if (typeof raw !== 'string') return null;
      const s = raw.trim();
      if (!s || /^(n\/?a|à définir|tbd|non disponible|en cours|inconnu)/i.test(s)) return null;
      // Capture first numeric token (with optional thousand/decimal separators)
      const m = s.replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
      if (!m) return null;
      const n = parseFloat(m[0].replace(',', '.'));
      return isFinite(n) ? n : null;
    };

    const alertsToInsert: any[] = [];

    // 1) Arena consensus alerts
    if (analysis.arenaMetadata?.modelsUsed?.length) {
      const models = analysis.arenaMetadata.modelsUsed;
      const successCount = models.filter((m: any) => m.status === 'success').length;
      const total = models.length;
      if (successCount === 0) {
        alertsToInsert.push({
          report_id: reportId,
          alert_type: 'quality_issue',
          severity: 'high',
          trigger_condition: { min_success: 1 },
          detected_value: { successCount, total, models },
          message: `Aucun modèle Arena n'a pu analyser "${report.title}" (${successCount}/${total}).`
        });
      } else if (successCount === 1 && total > 1) {
        alertsToInsert.push({
          report_id: reportId,
          alert_type: 'quality_issue',
          severity: 'medium',
          trigger_condition: { min_success_for_consensus: 2 },
          detected_value: { successCount, total, models },
          message: `Consensus Arena faible pour "${report.title}" : un seul modèle sur ${total} a répondu. Validation humaine recommandée.`
        });
      }
    }

    // 3) Anomaly detection on KPIs (normalized values)
    if (analysis.kpis && Object.keys(analysis.kpis).length > 0) {
      console.log('Detecting anomalies in KPIs');
      for (const [kpiName, kpiValue] of Object.entries(analysis.kpis)) {
        const numericValue = parseKpiNumber(kpiValue);
        if (numericValue === null) continue;
        try {
          const { data: anomalyData } = await supabase
            .rpc('detect_anomalies', {
              _report_id: reportId,
              _kpi_name: kpiName,
              _threshold: 2.0
            });

          if (anomalyData && anomalyData[0]?.anomaly_detected) {
            alertsToInsert.push({
              report_id: reportId,
              alert_type: 'anomaly_detected',
              severity: anomalyData[0].severity,
              trigger_condition: { kpi: kpiName, threshold: 2.0 },
              detected_value: { kpi: kpiName, value: numericValue, z_score: anomalyData[0].z_score },
              message: `Anomalie détectée pour ${kpiName} : valeur ${numericValue} (z-score : ${anomalyData[0].z_score.toFixed(2)})`
            });
          }
        } catch (e) {
          console.error(`Error detecting anomaly for ${kpiName}:`, e);
        }
      }
    }

    if (alertsToInsert.length > 0) {
      const { error: alertErr } = await supabase.from('report_alerts').insert(alertsToInsert);
      if (alertErr) console.error('Failed to insert alerts:', alertErr);
      else console.log(`Inserted ${alertsToInsert.length} alert(s) for report ${reportId}`);
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
      if (reportIdForError) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const errorSupabase = createClient(supabaseUrl, supabaseKey);

        await errorSupabase
          .from('reports')
          .update({ status: 'error' })
          .eq('id', reportIdForError);
      }
    } catch (e) {
      console.error('Failed to update error status:', e);
    }

    return new Response(
      JSON.stringify({
        error: 'Une erreur est survenue lors de l\'analyse',
        details: error?.message || String(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
