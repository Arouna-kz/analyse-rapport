/**
 * AI Provider Abstraction Layer
 * 
 * Supports: lovable (default), openai, gemini, ollama, custom
 * 
 * Configure via environment variable AI_PROVIDER:
 *   - "lovable"  → Lovable AI Gateway (default, requires LOVABLE_API_KEY)
 *   - "openai"   → OpenAI direct (requires OPENAI_API_KEY)
 *   - "gemini"   → Google Gemini direct (requires GOOGLE_AI_API_KEY)
 *   - "ollama"   → Local Ollama (requires OLLAMA_BASE_URL, default http://localhost:11434)
 *   - "custom"   → Custom OpenAI-compatible endpoint (requires CUSTOM_AI_BASE_URL + CUSTOM_AI_API_KEY)
 */

export interface AIProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  proModel: string;   // For synthesis/judge tasks
  flashModel: string; // For fast tasks
}

// Model mapping from Lovable AI model IDs to provider-specific names
const LOVABLE_TO_OPENAI: Record<string, string> = {
  'google/gemini-2.5-pro': 'gpt-4o',
  'google/gemini-2.5-flash': 'gpt-4o-mini',
  'google/gemini-2.5-flash-lite': 'gpt-4o-mini',
  'openai/gpt-5': 'gpt-4o',
  'openai/gpt-5-mini': 'gpt-4o-mini',
};

const LOVABLE_TO_GEMINI: Record<string, string> = {
  'google/gemini-2.5-pro': 'gemini-2.5-pro',
  'google/gemini-2.5-flash': 'gemini-2.5-flash',
  'google/gemini-2.5-flash-lite': 'gemini-2.5-flash',
  'openai/gpt-5': 'gemini-2.5-pro',
  'openai/gpt-5-mini': 'gemini-2.5-flash',
};

const LOVABLE_TO_OLLAMA: Record<string, string> = {
  'google/gemini-2.5-pro': 'llama3.1:8b',
  'google/gemini-2.5-flash': 'llama3.1:8b',
  'openai/gpt-5': 'llama3.1:8b',
  'openai/gpt-5-mini': 'llama3.1:8b',
};

// Cache for dynamic config loaded from DB
let _dynamicConfig: Record<string, string> | null = null;
let _dynamicConfigTs = 0;
const CONFIG_TTL = 60_000; // 1 minute cache

async function loadDynamicConfig(): Promise<Record<string, string>> {
  if (_dynamicConfig && Date.now() - _dynamicConfigTs < CONFIG_TTL) {
    return _dynamicConfig;
  }
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data } = await supabase.from('ai_config').select('config_key, config_value');
    const config: Record<string, string> = {};
    (data || []).forEach((r: { config_key: string; config_value: string }) => {
      if (r.config_value) config[r.config_key] = r.config_value;
    });
    _dynamicConfig = config;
    _dynamicConfigTs = Date.now();
    return config;
  } catch {
    return {};
  }
}

function env(key: string, fallback = ''): string {
  return Deno.env.get(key) || fallback;
}

export function getAIProviderConfig(dynamicCfg?: Record<string, string>): AIProviderConfig {
  const dc = dynamicCfg || {};
  const provider = (dc['AI_PROVIDER'] || env('AI_PROVIDER', 'lovable')).toLowerCase();

  switch (provider) {
    case 'openai':
      return {
        baseUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: dc['OPENAI_API_KEY'] || env('OPENAI_API_KEY'),
        defaultModel: 'gpt-4o-mini',
        proModel: 'gpt-4o',
        flashModel: 'gpt-4o-mini',
      };

    case 'gemini':
      return {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        apiKey: dc['GOOGLE_AI_API_KEY'] || env('GOOGLE_AI_API_KEY'),
        defaultModel: 'gemini-2.5-flash',
        proModel: 'gemini-2.5-pro',
        flashModel: 'gemini-2.5-flash',
      };

    case 'ollama':
      return {
        baseUrl: (dc['OLLAMA_BASE_URL'] || env('OLLAMA_BASE_URL', 'http://localhost:11434')) + '/v1/chat/completions',
        apiKey: 'ollama',
        defaultModel: dc['OLLAMA_MODEL'] || env('OLLAMA_MODEL', 'llama3.1:8b'),
        proModel: dc['OLLAMA_MODEL'] || env('OLLAMA_MODEL', 'llama3.1:8b'),
        flashModel: dc['OLLAMA_MODEL'] || env('OLLAMA_MODEL', 'llama3.1:8b'),
      };

    case 'custom':
      return {
        baseUrl: dc['CUSTOM_AI_BASE_URL'] || env('CUSTOM_AI_BASE_URL'),
        apiKey: dc['CUSTOM_AI_API_KEY'] || env('CUSTOM_AI_API_KEY'),
        defaultModel: dc['CUSTOM_AI_MODEL'] || env('CUSTOM_AI_MODEL', 'default'),
        proModel: dc['CUSTOM_AI_MODEL'] || env('CUSTOM_AI_MODEL', 'default'),
        flashModel: dc['CUSTOM_AI_MODEL'] || env('CUSTOM_AI_MODEL', 'default'),
      };

    case 'lovable':
    default:
      return {
        baseUrl: 'https://ai.gateway.lovable.dev/v1/chat/completions',
        apiKey: env('LOVABLE_API_KEY'),
        defaultModel: 'google/gemini-2.5-flash',
        proModel: 'google/gemini-2.5-pro',
        flashModel: 'google/gemini-2.5-flash',
      };
  }
}

/**
 * Translate a Lovable AI model name to the current provider's equivalent
 */
export function translateModel(lovableModelName: string, dynamicCfg?: Record<string, string>): string {
  const dc = dynamicCfg || {};
  const provider = (dc['AI_PROVIDER'] || env('AI_PROVIDER', 'lovable')).toLowerCase();

  switch (provider) {
    case 'openai':
      return LOVABLE_TO_OPENAI[lovableModelName] || 'gpt-4o-mini';
    case 'gemini':
      return LOVABLE_TO_GEMINI[lovableModelName] || 'gemini-2.5-flash';
    case 'ollama':
      return LOVABLE_TO_OLLAMA[lovableModelName] || dc['OLLAMA_MODEL'] || env('OLLAMA_MODEL', 'llama3.1:8b');
    case 'custom':
      return dc['CUSTOM_AI_MODEL'] || env('CUSTOM_AI_MODEL', 'default');
    case 'lovable':
    default:
      return lovableModelName;
  }
}

// Lovable model ID mapping (used by Arena)
export const MODEL_API_NAMES: Record<string, string> = {
  'lovable-gemini-pro': 'google/gemini-2.5-pro',
  'lovable-gemini-flash': 'google/gemini-2.5-flash',
  'lovable-gpt5': 'openai/gpt-5',
  'lovable-gpt5-mini': 'openai/gpt-5-mini',
};

/**
 * Log AI usage to the ai_usage_logs table (fire-and-forget)
 */
async function logAIUsage(params: {
  functionName: string;
  provider: string;
  model: string;
  status: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
  userId?: string;
}) {
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await sb.from('ai_usage_logs').insert({
      function_name: params.functionName,
      provider: params.provider,
      model: params.model,
      status: params.status,
      latency_ms: params.latencyMs,
      input_tokens: params.inputTokens ?? null,
      output_tokens: params.outputTokens ?? null,
      total_tokens: params.totalTokens ?? null,
      error_message: params.errorMessage ?? null,
      user_id: params.userId ?? null,
    });
  } catch (e) {
    console.error('Failed to log AI usage:', e);
  }
}

// Extract caller function name from stack trace
function getCallerFunction(): string {
  try {
    const stack = new Error().stack || '';
    const lines = stack.split('\n').filter(l => l.includes('at '));
    // Skip logAIUsage, callAI, find first external caller
    for (const line of lines) {
      if (!line.includes('ai-provider') && !line.includes('logAIUsage') && !line.includes('callAI')) {
        const match = line.match(/at\s+(\S+)/);
        if (match) return match[1];
      }
    }
    return 'unknown';
  } catch { return 'unknown'; }
}

/**
 * Call the AI API with automatic provider selection.
 * Reads dynamic config from DB (cached 1 min), falls back to env vars.
 */
export async function callAI(options: {
  messages: Array<{ role: string; content: any }>;
  model?: string;
  temperature?: number;
  stream?: boolean;
  functionName?: string;
  userId?: string;
}): Promise<Response> {
  const dc = await loadDynamicConfig();
  const config = getAIProviderConfig(dc);
  const provider = (dc['AI_PROVIDER'] || env('AI_PROVIDER', 'lovable')).toLowerCase();
  const model = options.model ? translateModel(options.model, dc) : config.defaultModel;
  const funcName = options.functionName || getCallerFunction();

  if (!config.apiKey) {
    throw new Error(`AI API key not configured for provider: ${provider}`);
  }

  const start = Date.now();
  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      ...(options.stream ? { stream: true } : {}),
    }),
  });
  const latencyMs = Date.now() - start;

  // Fire-and-forget logging (don't block response)
  if (!options.stream) {
    // Clone response to read usage without consuming body
    const cloned = response.clone();
    cloned.json().then((data: any) => {
      const usage = data?.usage;
      logAIUsage({
        functionName: funcName,
        provider,
        model,
        status: response.ok ? 'success' : 'error',
        latencyMs,
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
        errorMessage: response.ok ? undefined : `HTTP ${response.status}`,
        userId: options.userId,
      });
    }).catch(() => {
      logAIUsage({
        functionName: funcName, provider, model,
        status: response.ok ? 'success' : 'error',
        latencyMs,
        userId: options.userId,
      });
    });
  } else {
    logAIUsage({
      functionName: funcName, provider, model,
      status: response.ok ? 'success' : 'error',
      latencyMs,
      userId: options.userId,
    });
  }

  return response;
}

/**
 * Call AI and parse the JSON response (non-streaming)
 */
export async function callAIJson<T = any>(options: {
  messages: Array<{ role: string; content: any }>;
  model?: string;
  temperature?: number;
}): Promise<{ data: T; raw: string }> {
  const response = await callAI(options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new AIError(
      response.status === 429
        ? 'Limite de requêtes atteinte, veuillez réessayer plus tard.'
        : response.status === 402
        ? 'Crédits insuffisants, veuillez ajouter des fonds.'
        : `Erreur IA (${response.status}): ${errorText}`,
      response.status
    );
  }

  const aiData = await response.json();
  const content = aiData.choices?.[0]?.message?.content || '';

  // Parse JSON from response
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
                    content.match(/```\n([\s\S]*?)\n```/) ||
                    content.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

  try {
    return { data: JSON.parse(jsonStr), raw: content };
  } catch {
    throw new Error('Failed to parse AI JSON response');
  }
}

export class AIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Handle AI errors and return appropriate HTTP response
 */
export function handleAIError(error: any, corsHeaders: Record<string, string>): Response {
  if (error instanceof AIError) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  console.error('AI error:', error);
  return new Response(
    JSON.stringify({ error: error?.message || 'Erreur IA interne' }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
