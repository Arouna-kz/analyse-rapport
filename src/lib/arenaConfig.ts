// Multi-Model Arena Configuration
// Defines available AI models and their roles in the consensus system

export type ModelProvider = 'lovable' | 'openai' | 'gemini' | 'ollama' | 'custom';

export interface AIModel {
  id: string;
  name: string;
  role: string;
  description: string;
  provider: ModelProvider;
  baseUrl: string;
  apiKey?: string; // For external models with individual keys
  modelName?: string; // The actual model name to send to the API
  isLovableAI: boolean;
  enabled: boolean;
  priority: number;
  capabilities: string[];
}

export interface ArenaConfig {
  models: AIModel[];
  judgeModelId: string;
  fallbackModelId: string;
  showExpertMode: boolean;
  minConsensusModels: number;
}

// Provider base URLs
export const PROVIDER_URLS: Record<ModelProvider, string> = {
  lovable: 'https://ai.gateway.lovable.dev/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  ollama: 'http://localhost:11434/v1/chat/completions',
  custom: '',
};

// Default models configuration
export const DEFAULT_MODELS: AIModel[] = [
  // Lovable AI Models — Gemini family
  {
    id: 'lovable-gemini-pro',
    name: 'Gemini 2.5 Pro',
    role: 'Chef d\'orchestre & Raisonnement complexe',
    description: 'Modèle principal pour l\'orchestration et le raisonnement avancé',
    provider: 'lovable',
    baseUrl: PROVIDER_URLS.lovable,
    modelName: 'google/gemini-2.5-pro',
    isLovableAI: true,
    enabled: true,
    priority: 1,
    capabilities: ['reasoning', 'synthesis', 'judge']
  },
  {
    id: 'lovable-gemini-flash',
    name: 'Gemini 2.5 Flash',
    role: 'Analyse rapide & Polyvalent',
    description: 'Modèle équilibré pour analyses rapides et polyvalentes',
    provider: 'lovable',
    baseUrl: PROVIDER_URLS.lovable,
    modelName: 'google/gemini-2.5-flash',
    isLovableAI: true,
    enabled: true,
    priority: 2,
    capabilities: ['analysis', 'multilingual', 'speed']
  },
  // Lovable AI Models — OpenAI family (different architecture = meilleur consensus)
  {
    id: 'lovable-gpt5',
    name: 'GPT-5',
    role: 'Rédaction & Précision',
    description: 'Excellence en rédaction et analyse précise (architecture différente de Gemini)',
    provider: 'lovable',
    baseUrl: PROVIDER_URLS.lovable,
    modelName: 'openai/gpt-5',
    isLovableAI: true,
    enabled: true,
    priority: 3,
    capabilities: ['writing', 'precision', 'context']
  },
  {
    id: 'lovable-gpt5-mini',
    name: 'GPT-5 Mini',
    role: 'Vérification & Validation rapide',
    description: 'Vérification rapide et efficace des résultats',
    provider: 'lovable',
    baseUrl: PROVIDER_URLS.lovable,
    modelName: 'openai/gpt-5-mini',
    isLovableAI: true,
    enabled: true,
    priority: 4,
    capabilities: ['verification', 'validation', 'speed']
  },
  // Lovable AI Models — Next-gen previews
  {
    id: 'lovable-gemini-3-flash',
    name: 'Gemini 3 Flash (Preview)',
    role: 'Nouvelle génération rapide',
    description: 'Aperçu du modèle nouvelle génération Google, rapide et performant',
    provider: 'lovable',
    baseUrl: PROVIDER_URLS.lovable,
    modelName: 'google/gemini-3-flash-preview',
    isLovableAI: true,
    enabled: false,
    priority: 5,
    capabilities: ['analysis', 'speed', 'reasoning']
  },
  {
    id: 'lovable-gpt52',
    name: 'GPT-5.2',
    role: 'Raisonnement avancé dernière génération',
    description: 'Dernier modèle OpenAI avec raisonnement amélioré',
    provider: 'lovable',
    baseUrl: PROVIDER_URLS.lovable,
    modelName: 'openai/gpt-5.2',
    isLovableAI: true,
    enabled: false,
    priority: 6,
    capabilities: ['reasoning', 'precision', 'judge']
  },
  // Ollama Models (self-hosted, each with distinct model)
  {
    id: 'ollama-llama3',
    name: 'Llama 3.1 8B',
    role: 'Raisonnement général & Polyvalent',
    description: 'Modèle open source polyvalent de Meta',
    provider: 'ollama',
    baseUrl: PROVIDER_URLS.ollama,
    modelName: 'llama3.1:8b',
    isLovableAI: false,
    enabled: false,
     priority: 7,
    capabilities: ['reasoning', 'synthesis', 'judge']
  },
  {
    id: 'ollama-mistral',
    name: 'Mistral 7B',
    role: 'Analyse rapide & Efficace',
    description: 'Modèle performant pour l\'analyse rapide',
    provider: 'ollama',
    baseUrl: PROVIDER_URLS.ollama,
    modelName: 'mistral:7b',
    isLovableAI: false,
    enabled: false,
    priority: 8,
    capabilities: ['analysis', 'speed', 'multilingual']
  },
  {
    id: 'ollama-qwen',
    name: 'Qwen2.5 7B',
    role: 'Multilingue & Rédaction',
    description: 'Excellence multilingue et polyvalence',
    provider: 'ollama',
    baseUrl: PROVIDER_URLS.ollama,
    modelName: 'qwen2.5:7b',
    isLovableAI: false,
    enabled: false,
    priority: 9,
    capabilities: ['multilingual', 'writing', 'versatile']
  },
  {
    id: 'ollama-deepseek-r1',
    name: 'DeepSeek-R1 8B',
    role: 'Mathématiques & Logique stricte',
    description: 'Spécialisé en raisonnement mathématique',
    provider: 'ollama',
    baseUrl: PROVIDER_URLS.ollama,
    modelName: 'deepseek-r1:8b',
    isLovableAI: false,
    enabled: false,
    priority: 10,
    capabilities: ['math', 'logic', 'verification', 'judge']
  },
  {
    id: 'ollama-gemma2',
    name: 'Gemma 2 9B',
    role: 'Vérification & Validation',
    description: 'Modèle Google open source pour la validation',
    provider: 'ollama',
    baseUrl: PROVIDER_URLS.ollama,
    modelName: 'gemma2:9b',
    isLovableAI: false,
    enabled: false,
    priority: 11,
    capabilities: ['verification', 'validation', 'precision']
  },
  // External API Models
  {
    id: 'external-openai',
    name: 'OpenAI GPT-4o',
    role: 'Raisonnement avancé',
    description: 'Accès direct à l\'API OpenAI',
    provider: 'openai',
    baseUrl: PROVIDER_URLS.openai,
    modelName: 'gpt-4o',
    apiKey: '',
    isLovableAI: false,
    enabled: false,
    priority: 10,
    capabilities: ['reasoning', 'writing', 'judge']
  },
  {
    id: 'external-gemini',
    name: 'Google Gemini Pro',
    role: 'Analyse multimodale',
    description: 'Accès direct à l\'API Google Gemini',
    provider: 'gemini',
    baseUrl: PROVIDER_URLS.gemini,
    modelName: 'gemini-2.5-pro',
    apiKey: '',
    isLovableAI: false,
    enabled: false,
    priority: 11,
    capabilities: ['analysis', 'reasoning', 'judge']
  },
  {
    id: 'custom-endpoint',
    name: 'Endpoint personnalisé',
    role: 'Modèle personnalisé',
    description: 'Endpoint OpenAI-compatible personnalisé',
    provider: 'custom',
    baseUrl: '',
    modelName: '',
    apiKey: '',
    isLovableAI: false,
    enabled: false,
    priority: 12,
    capabilities: ['versatile']
  },
];

export const DEFAULT_ARENA_CONFIG: ArenaConfig = {
  models: DEFAULT_MODELS,
  judgeModelId: 'lovable-gemini-pro',
  fallbackModelId: 'lovable-gemini-flash',
  showExpertMode: false,
  minConsensusModels: 2
};

// Map model IDs to actual model names for API calls (backward compat)
export const MODEL_API_NAMES: Record<string, string> = {
  'lovable-gemini-pro': 'google/gemini-2.5-pro',
  'lovable-gemini-flash': 'google/gemini-2.5-flash',
  'lovable-gpt5': 'openai/gpt-5',
  'lovable-gpt5-mini': 'openai/gpt-5-mini',
  'lovable-gemini-3-flash': 'google/gemini-3-flash-preview',
  'lovable-gpt52': 'openai/gpt-5.2',
};

export const getModelApiName = (modelId: string): string => {
  return MODEL_API_NAMES[modelId] || modelId;
};

// Storage key for persisting config
export const ARENA_CONFIG_STORAGE_KEY = 'arena-config';

export const loadArenaConfig = (): ArenaConfig => {
  try {
    const stored = localStorage.getItem(ARENA_CONFIG_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_ARENA_CONFIG,
        ...parsed,
        models: DEFAULT_MODELS.map(defaultModel => {
          const storedModel = parsed.models?.find((m: AIModel) => m.id === defaultModel.id);
          return storedModel ? { ...defaultModel, ...storedModel } : defaultModel;
        })
      };
    }
  } catch (e) {
    console.error('Failed to load arena config:', e);
  }
  return DEFAULT_ARENA_CONFIG;
};

export const saveArenaConfig = (config: ArenaConfig): void => {
  try {
    localStorage.setItem(ARENA_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save arena config:', e);
  }
};
