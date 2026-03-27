import { useState, useEffect, useCallback } from 'react';
import { 
  ArenaConfig, 
  AIModel, 
  loadArenaConfig, 
  saveArenaConfig, 
  DEFAULT_ARENA_CONFIG 
} from '@/lib/arenaConfig';

export const useArenaConfig = () => {
  const [config, setConfig] = useState<ArenaConfig>(DEFAULT_ARENA_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loaded = loadArenaConfig();
    setConfig(loaded);
    setIsLoaded(true);
  }, []);

  const updateConfig = useCallback((updates: Partial<ArenaConfig>) => {
    setConfig(prev => {
      const newConfig = { ...prev, ...updates };
      saveArenaConfig(newConfig);
      return newConfig;
    });
  }, []);

  const updateModel = useCallback((modelId: string, updates: Partial<AIModel>) => {
    setConfig(prev => {
      const newModels = prev.models.map(model => 
        model.id === modelId ? { ...model, ...updates } : model
      );
      const newConfig = { ...prev, models: newModels };
      saveArenaConfig(newConfig);
      return newConfig;
    });
  }, []);

  const toggleModel = useCallback((modelId: string) => {
    setConfig(prev => {
      const newModels = prev.models.map(model => 
        model.id === modelId ? { ...model, enabled: !model.enabled } : model
      );
      const newConfig = { ...prev, models: newModels };
      saveArenaConfig(newConfig);
      return newConfig;
    });
  }, []);

  const toggleExpertMode = useCallback(() => {
    setConfig(prev => {
      const newConfig = { ...prev, showExpertMode: !prev.showExpertMode };
      saveArenaConfig(newConfig);
      return newConfig;
    });
  }, []);

  const setJudgeModel = useCallback((modelId: string) => {
    updateConfig({ judgeModelId: modelId });
  }, [updateConfig]);

  const getEnabledModels = useCallback((): AIModel[] => {
    return config.models
      .filter(m => m.enabled)
      .sort((a, b) => a.priority - b.priority);
  }, [config.models]);

  const getJudgeModel = useCallback((): AIModel | undefined => {
    return config.models.find(m => m.id === config.judgeModelId);
  }, [config.models, config.judgeModelId]);

  const resetToDefaults = useCallback(() => {
    setConfig(DEFAULT_ARENA_CONFIG);
    saveArenaConfig(DEFAULT_ARENA_CONFIG);
  }, []);

  return {
    config,
    isLoaded,
    updateConfig,
    updateModel,
    toggleModel,
    toggleExpertMode,
    setJudgeModel,
    getEnabledModels,
    getJudgeModel,
    resetToDefaults
  };
};
