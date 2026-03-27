import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useArenaConfig } from '@/hooks/useArenaConfig';
import { ArenaResult, ModelResponse } from '@/components/ArenaResults';
import { ModelStatus } from '@/components/ArenaStatus';
import { useToast } from '@/hooks/use-toast';

interface UseArenaOptions {
  systemPrompt?: string;
  context?: string;
}

export const useArena = (options: UseArenaOptions = {}) => {
  const { config, getEnabledModels, getJudgeModel } = useArenaConfig();
  const { toast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [phase, setPhase] = useState<'parallel' | 'aggregation' | 'synthesis' | 'complete'>('parallel');
  const [modelStatuses, setModelStatuses] = useState<ModelStatus[]>([]);
  const [result, setResult] = useState<ArenaResult | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const runArena = useCallback(async (prompt: string): Promise<ArenaResult | null> => {
    const enabledModels = getEnabledModels();
    
    if (enabledModels.length === 0) {
      toast({
        title: "Configuration requise",
        description: "Veuillez activer au moins un modèle dans la configuration Arena",
        variant: "destructive",
      });
      return null;
    }

    setIsProcessing(true);
    setPhase('parallel');
    setResult(null);
    
    // Initialize model statuses
    const initialStatuses: ModelStatus[] = enabledModels.map(m => ({
      modelId: m.id,
      modelName: m.name,
      status: 'processing'
    }));
    setModelStatuses(initialStatuses);

    const startTime = Date.now();
    const updateTimer = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);

    try {
      // Prepare models for the edge function
      const modelsPayload = enabledModels.map(m => ({
        id: m.id,
        name: m.name,
        baseUrl: m.baseUrl,
        isLovableAI: m.isLovableAI
      }));

      const judgeModel = getJudgeModel();

      // Simulate phase transitions for better UX
      setTimeout(() => setPhase('aggregation'), 2000);
      setTimeout(() => setPhase('synthesis'), 4000);

      const { data, error } = await supabase.functions.invoke('arena', {
        body: {
          prompt,
          systemPrompt: options.systemPrompt || 'Tu es un assistant IA expert en analyse de rapports et prédictions.',
          models: modelsPayload,
          judgeModelId: judgeModel?.id,
          context: options.context
        }
      });

      if (error) throw error;

      // Update model statuses based on results
      const updatedStatuses: ModelStatus[] = (data.modelResponses || []).map((r: ModelResponse) => ({
        modelId: r.modelId,
        modelName: r.modelName,
        status: r.status === 'success' ? 'success' : 'error'
      }));
      setModelStatuses(updatedStatuses);

      const arenaResult: ArenaResult = {
        goldResponse: data.goldResponse,
        modelResponses: data.modelResponses || [],
        consensusScore: data.consensusScore || 0.75,
        hallucinations: data.hallucinations || [],
        synthesisNotes: data.synthesisNotes || '',
        processingTime: data.processingTime || (Date.now() - startTime)
      };

      setResult(arenaResult);
      setPhase('complete');
      
      return arenaResult;

    } catch (error: any) {
      console.error('Arena error:', error);
      toast({
        title: "Erreur Arena",
        description: error.message || "Une erreur est survenue lors de l'analyse multi-modèles",
        variant: "destructive",
      });
      
      // Mark all models as error
      setModelStatuses(prev => prev.map(s => ({ ...s, status: 'error' as const })));
      return null;
      
    } finally {
      clearInterval(updateTimer);
      setElapsedTime(Date.now() - startTime);
      setIsProcessing(false);
    }
  }, [getEnabledModels, getJudgeModel, options.systemPrompt, options.context, toast]);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setPhase('parallel');
    setModelStatuses([]);
    setResult(null);
    setElapsedTime(0);
  }, []);

  return {
    runArena,
    reset,
    isProcessing,
    phase,
    modelStatuses,
    result,
    elapsedTime,
    showExpertMode: config.showExpertMode,
    enabledModelsCount: getEnabledModels().length
  };
};
