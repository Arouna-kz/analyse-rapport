import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Brain, 
  Sparkles, 
  CheckCircle2, 
  XCircle,
  Zap,
  Timer
} from 'lucide-react';
import { AIModel } from '@/lib/arenaConfig';

export interface ModelStatus {
  modelId: string;
  modelName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  progress?: number;
}

interface ArenaStatusProps {
  models: AIModel[];
  modelStatuses: ModelStatus[];
  phase: 'parallel' | 'aggregation' | 'synthesis' | 'complete';
  elapsedTime: number;
}

export const ArenaStatus = ({ 
  models, 
  modelStatuses, 
  phase, 
  elapsedTime 
}: ArenaStatusProps) => {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (phase !== 'complete') {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 500);
      return () => clearInterval(interval);
    }
  }, [phase]);

  const phaseLabels = {
    parallel: 'Analyse parallèle en cours',
    aggregation: 'Agrégation des résultats',
    synthesis: 'Synthèse & Production de la Réponse Gold',
    complete: 'Analyse terminée'
  };

  const completedCount = modelStatuses.filter(s => s.status === 'success').length;
  const errorCount = modelStatuses.filter(s => s.status === 'error').length;
  const processingCount = modelStatuses.filter(s => s.status === 'processing').length;

  const overallProgress = phase === 'complete' 
    ? 100 
    : phase === 'synthesis' 
      ? 80 + (20 * (completedCount / modelStatuses.length))
      : phase === 'aggregation'
        ? 60 + (20 * (completedCount / modelStatuses.length))
        : (completedCount / modelStatuses.length) * 60;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardContent className="py-6">
        {/* Phase indicator */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {phase !== 'complete' ? (
              <div className="relative">
                <div className="p-2 rounded-lg bg-primary/20 animate-pulse">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-background">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                </div>
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            )}
            <div>
              <p className="font-semibold">
                {phaseLabels[phase]}{phase !== 'complete' && dots}
              </p>
              <p className="text-sm text-muted-foreground">
                {phase === 'parallel' && `${completedCount}/${modelStatuses.length} modèles terminés`}
                {phase === 'aggregation' && 'Comparaison des réponses...'}
                {phase === 'synthesis' && 'Le modèle juge génère la synthèse...'}
                {phase === 'complete' && `${completedCount} réponses analysées`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            <span>{(elapsedTime / 1000).toFixed(1)}s</span>
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={overallProgress} className="h-2 mb-4" />

        {/* Model status grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {modelStatuses.map((status) => (
            <div 
              key={status.modelId}
              className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition-all ${
                status.status === 'success' 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : status.status === 'error'
                    ? 'bg-red-500/10 border-red-500/30'
                    : status.status === 'processing'
                      ? 'bg-primary/10 border-primary/30 animate-pulse'
                      : 'bg-muted/50'
              }`}
            >
              {status.status === 'processing' ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              ) : status.status === 'success' ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : status.status === 'error' ? (
                <XCircle className="h-3 w-3 text-red-500" />
              ) : (
                <Brain className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="truncate text-xs">{status.modelName}</span>
            </div>
          ))}
        </div>

        {/* Summary badges */}
        <div className="flex gap-2 mt-4">
          {processingCount > 0 && (
            <Badge variant="secondary" className="bg-primary/20">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              {processingCount} en cours
            </Badge>
          )}
          {completedCount > 0 && (
            <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {completedCount} terminés
            </Badge>
          )}
          {errorCount > 0 && (
            <Badge variant="secondary" className="bg-red-500/20 text-red-700 dark:text-red-300">
              <XCircle className="h-3 w-3 mr-1" />
              {errorCount} erreurs
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ArenaStatus;
