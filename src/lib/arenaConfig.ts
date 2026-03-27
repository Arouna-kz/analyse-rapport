// Multi-Model Arena Configuration
// Defines available AI models and their roles in the consensus system

export interface AIModel {
  id: string;
  name: string;
  role: string;
  description: string;
  baseUrl: string;
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

// Default models configuration - Lovable AI models available by default
export const DEFAULT_MODELS: AIModel[] = [
  {
    id: 'lovable-gemini-pro',
    name: 'Gemini 2.5 Pro',
    role: 'Chef d\'orchestre & Raisonnement complexe',
    description: 'Modèle principal pour l\'orchestration et le raisonnement avancé',
    baseUrl: 'https://ai.gateway.lovable.dev/v1/chat/completions',
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
    baseUrl: 'https://ai.gateway.lovable.dev/v1/chat/completions',
    isLovableAI: true,
    enabled: true,
    priority: 2,
    capabilities: ['analysis', 'multilingual', 'speed']
  },
  {
    id: 'lovable-gpt5',
    name: 'GPT-5',
    role: 'Rédaction & Précision',
    description: 'Excellence en rédaction et analyse précise',
    baseUrl: 'https://ai.gateway.lovable.dev/v1/chat/completions',
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
    baseUrl: 'https://ai.gateway.lovable.dev/v1/chat/completions',
    isLovableAI: true,
    enabled: true,
    priority: 4,
    capabilities: ['verification', 'validation', 'speed']
  },
  // External models - configurable by user
  {
    id: 'external-gpt-oss-120b',
    name: 'GPT-OSS-120B',
    role: 'Chef d\'orchestre & Raisonnement complexe',
    description: 'Modèle Open Source pour orchestration (vLLM/Ollama)',
    baseUrl: '',
    isLovableAI: false,
    enabled: false,
    priority: 5,
    capabilities: ['reasoning', 'synthesis', 'judge']
  },
  {
    id: 'external-glm-4.6',
    name: 'GLM 4.6',
    role: 'Analyse contextuelle massive & Long documents',
    description: 'Spécialisé dans l\'analyse de documents longs',
    baseUrl: '',
    isLovableAI: false,
    enabled: false,
    priority: 6,
    capabilities: ['long-context', 'analysis']
  },
  {
    id: 'external-qwen3-235b',
    name: 'Qwen3-235B-Instruct',
    role: 'Polyvalent & Multilingue',
    description: 'Excellence multilingue et polyvalence',
    baseUrl: '',
    isLovableAI: false,
    enabled: false,
    priority: 7,
    capabilities: ['multilingual', 'versatile']
  },
  {
    id: 'external-deepseek-r1',
    name: 'DeepSeek-R1-0528',
    role: 'Mathématiques, Logique stricte & Vérification',
    description: 'Spécialisé en raisonnement mathématique et logique',
    baseUrl: '',
    isLovableAI: false,
    enabled: false,
    priority: 8,
    capabilities: ['math', 'logic', 'verification', 'judge']
  },
  {
    id: 'external-llama-nemotron',
    name: 'Llama-3.3-Nemotron-Super-49B',
    role: 'Rédaction & Utilisation d\'outils RAG',
    description: 'Excellence en rédaction avec capacités RAG',
    baseUrl: '',
    isLovableAI: false,
    enabled: false,
    priority: 9,
    capabilities: ['writing', 'rag', 'tools']
  }
];

export const DEFAULT_ARENA_CONFIG: ArenaConfig = {
  models: DEFAULT_MODELS,
  judgeModelId: 'lovable-gemini-pro',
  fallbackModelId: 'lovable-gemini-flash',
  showExpertMode: false,
  minConsensusModels: 2
};

// Map model IDs to actual model names for API calls
export const MODEL_API_NAMES: Record<string, string> = {
  'lovable-gemini-pro': 'google/gemini-2.5-pro',
  'lovable-gemini-flash': 'google/gemini-2.5-flash',
  'lovable-gpt5': 'openai/gpt-5',
  'lovable-gpt5-mini': 'openai/gpt-5-mini',
  // External models use their configured names
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
      // Merge with defaults to ensure new models are included
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
