import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Trophy, 
  Brain, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react';
import { cleanMarkdown } from '@/lib/textUtils';

export interface ModelResponse {
  modelId: string;
  modelName: string;
  response: string;
  confidence: number;
  processingTime: number;
  status: 'success' | 'error' | 'pending';
  errorMessage?: string;
  highlights?: string[];
  warnings?: string[];
}

export interface ArenaResult {
  goldResponse: string;
  modelResponses: ModelResponse[];
  consensusScore: number;
  hallucinations: string[];
  synthesisNotes: string;
  processingTime: number;
}

interface ArenaResultsProps {
  result?: ArenaResult;
  showExpertMode: boolean;
  onToggleExpertMode?: () => void;
  isLoading?: boolean;
  // Inline mode props - for embedding in chat
  goldResponse?: string;
  modelResponses?: ModelResponse[];
  consensusScore?: number;
  hallucinations?: string[];
  synthesisNotes?: string;
  processingTime?: number;
  hideGoldResponse?: boolean;
}

export const ArenaResults = ({ 
  result: externalResult, 
  showExpertMode, 
  onToggleExpertMode,
  isLoading,
  goldResponse,
  modelResponses,
  consensusScore,
  hallucinations,
  synthesisNotes,
  processingTime,
  hideGoldResponse
}: ArenaResultsProps) => {
  // Build result from inline props if no result object provided
  const result: ArenaResult = externalResult || {
    goldResponse: goldResponse || '',
    modelResponses: modelResponses || [],
    consensusScore: consensusScore || 0,
    hallucinations: hallucinations || [],
    synthesisNotes: synthesisNotes || '',
    processingTime: processingTime || 0
  };
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());

  const toggleModelExpand = (modelId: string) => {
    const newExpanded = new Set(expandedModels);
    if (newExpanded.has(modelId)) {
      newExpanded.delete(modelId);
    } else {
      newExpanded.add(modelId);
    }
    setExpandedModels(newExpanded);
  };

  const successfulResponses = result.modelResponses.filter(r => r.status === 'success');
  const avgConfidence = successfulResponses.length > 0
    ? successfulResponses.reduce((sum, r) => sum + r.confidence, 0) / successfulResponses.length
    : 0;

  return (
    <div className="space-y-4">
      {/* Gold Response - Hidden in inline mode */}
      {!hideGoldResponse && (
      <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Trophy className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Réponse Gold
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    Consensus {(result.consensusScore * 100).toFixed(0)}%
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Synthèse optimale de {successfulResponses.length} modèles
                </p>
              </div>
            </div>
            {onToggleExpertMode && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onToggleExpertMode}
                className="gap-2"
              >
                {showExpertMode ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Masquer détails
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Mode expert
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap">{cleanMarkdown(result.goldResponse)}</p>
          </div>

          {/* Synthesis Notes */}
          {result.synthesisNotes && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Notes de synthèse</span>
              </div>
              <p className="text-sm text-muted-foreground">{result.synthesisNotes}</p>
            </div>
          )}

          {/* Hallucinations detected */}
          {result.hallucinations.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  Hallucinations filtrées ({result.hallucinations.length})
                </span>
              </div>
              <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                {result.hallucinations.map((h, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <XCircle className="h-3 w-3 mt-1 flex-shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stats bar */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{(result.processingTime / 1000).toFixed(1)}s</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span>Confiance moyenne: {(avgConfidence * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <span>{successfulResponses.length}/{result.modelResponses.length} modèles</span>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Expert Mode - Individual Model Responses */}
      {showExpertMode && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Réponses individuelles des modèles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="all">Tous ({result.modelResponses.length})</TabsTrigger>
                <TabsTrigger value="success">
                  Succès ({successfulResponses.length})
                </TabsTrigger>
                <TabsTrigger value="errors">
                  Erreurs ({result.modelResponses.filter(r => r.status === 'error').length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-3">
                {result.modelResponses.map((response) => (
                  <ModelResponseCard 
                    key={response.modelId}
                    response={response}
                    isExpanded={expandedModels.has(response.modelId)}
                    onToggle={() => toggleModelExpand(response.modelId)}
                  />
                ))}
              </TabsContent>

              <TabsContent value="success" className="space-y-3">
                {successfulResponses.map((response) => (
                  <ModelResponseCard 
                    key={response.modelId}
                    response={response}
                    isExpanded={expandedModels.has(response.modelId)}
                    onToggle={() => toggleModelExpand(response.modelId)}
                  />
                ))}
              </TabsContent>

              <TabsContent value="errors" className="space-y-3">
                {result.modelResponses.filter(r => r.status === 'error').map((response) => (
                  <ModelResponseCard 
                    key={response.modelId}
                    response={response}
                    isExpanded={expandedModels.has(response.modelId)}
                    onToggle={() => toggleModelExpand(response.modelId)}
                  />
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const ModelResponseCard = ({ 
  response, 
  isExpanded, 
  onToggle 
}: { 
  response: ModelResponse; 
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const statusIcon = {
    success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    error: <XCircle className="h-4 w-4 text-red-500" />,
    pending: <Clock className="h-4 w-4 text-amber-500 animate-pulse" />
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${
      response.status === 'error' ? 'border-red-500/30 bg-red-500/5' : ''
    }`}>
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {statusIcon[response.status]}
          <div className="text-left">
            <p className="font-medium text-sm">{response.modelName}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{response.processingTime}ms</span>
              {response.status === 'success' && (
                <>
                  <span>•</span>
                  <span>Confiance: {(response.confidence * 100).toFixed(0)}%</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {response.status === 'success' && (
            <Progress value={response.confidence * 100} className="w-20 h-2" />
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 border-t bg-muted/30">
          {response.status === 'success' ? (
            <>
              <ScrollArea className="max-h-48">
                <p className="text-sm whitespace-pre-wrap">{cleanMarkdown(response.response)}</p>
              </ScrollArea>

              {response.highlights && response.highlights.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium mb-1 text-green-600 dark:text-green-400">
                    Points forts identifiés:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {response.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {response.warnings && response.warnings.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium mb-1 text-amber-600 dark:text-amber-400">
                    Avertissements:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {response.warnings.map((w, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-500" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-red-600 dark:text-red-400">
              {response.errorMessage || 'Erreur inconnue'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ArenaResults;
