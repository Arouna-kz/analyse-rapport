import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SavedPrediction {
  id: string;
  name: string;
  created_at: string;
  predictions: any[];
}

interface PredictionComparisonProps {
  predictions: SavedPrediction[];
}

export const PredictionComparison = ({ predictions }: PredictionComparisonProps) => {
  const getScenarioIcon = (type: string) => {
    switch (type) {
      case 'optimistic': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'pessimistic': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAllKPIs = () => {
    const kpiSet = new Set<string>();
    predictions.forEach(pred => {
      pred.predictions.forEach((scenario: any) => {
        Object.keys(scenario.predicted_kpis || {}).forEach(kpi => kpiSet.add(kpi));
      });
    });
    return Array.from(kpiSet);
  };

  const allKPIs = getAllKPIs();
  const scenarioTypes = ['optimistic', 'realistic', 'pessimistic'];

  return (
    <div className="space-y-6">
      {/* Header comparison */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${predictions.length}, 1fr)` }}>
        {predictions.map((pred) => (
          <Card key={pred.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{pred.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {new Date(pred.created_at).toLocaleDateString('fr-FR')}
              </p>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Scenario by scenario comparison */}
      {scenarioTypes.map((scenarioType) => {
        const scenarioLabel = scenarioType === 'optimistic' ? 'Optimiste' : 
                            scenarioType === 'pessimistic' ? 'Pessimiste' : 'Réaliste';
        
        return (
          <div key={scenarioType}>
            <div className="flex items-center gap-2 mb-4">
              {getScenarioIcon(scenarioType)}
              <h3 className="text-lg font-semibold">{scenarioLabel}</h3>
            </div>
            
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${predictions.length}, 1fr)` }}>
              {predictions.map((pred) => {
                const scenario = pred.predictions.find((s: any) => s.scenario_type === scenarioType);
                
                return (
                  <Card key={`${pred.id}-${scenarioType}`}>
                    <CardContent className="pt-6">
                      {scenario ? (
                        <>
                          <div className="mb-4">
                            <Badge variant="outline">
                              {(scenario.probability * 100).toFixed(0)}% probabilité
                            </Badge>
                          </div>

                          <Separator className="my-4" />

                          <div>
                            <h4 className="font-semibold text-sm mb-3">KPIs</h4>
                            <div className="space-y-2">
                              {allKPIs.slice(0, 5).map(kpi => {
                                const value = scenario.predicted_kpis?.[kpi];
                                return (
                                  <div key={kpi} className="flex justify-between text-sm">
                                    <span className="text-muted-foreground truncate">{kpi}</span>
                                    <span className="font-medium ml-2">{value || 'N/A'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {scenario.assumptions?.length > 0 && (
                            <>
                              <Separator className="my-4" />
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Hypothèses</h4>
                                <p className="text-xs text-muted-foreground">
                                  {scenario.assumptions.length} hypothèse(s)
                                </p>
                              </div>
                            </>
                          )}

                          {scenario.risk_factors?.length > 0 && (
                            <>
                              <Separator className="my-4" />
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Risques</h4>
                                <p className="text-xs text-muted-foreground">
                                  {scenario.risk_factors.length} facteur(s) de risque
                                </p>
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Scénario non disponible
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
