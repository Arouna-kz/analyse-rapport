import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, Minus, Loader2, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Prediction {
  scenario_type: string;
  title: string;
  predicted_kpis: any;
  assumptions: string[];
  risk_factors: string[];
  recommendations: string[];
  probability: number;
}

const SharedPrediction = () => {
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSharedPrediction();
  }, [shareToken]);

  const fetchSharedPrediction = async () => {
    if (!shareToken) {
      setError('Token de partage manquant');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('get-shared-prediction', {
        body: { shareToken }
      });

      if (error) throw error;

      setPrediction(data.prediction);
    } catch (err: any) {
      setError(err.message || 'Impossible de charger les prédictions partagées');
    } finally {
      setLoading(false);
    }
  };

  const getScenarioIcon = (type: string) => {
    switch (type) {
      case 'optimistic': return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'pessimistic': return <TrendingDown className="h-5 w-5 text-red-500" />;
      default: return <Minus className="h-5 w-5 text-blue-500" />;
    }
  };

  const getScenarioColor = (type: string) => {
    switch (type) {
      case 'optimistic': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'pessimistic': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !prediction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Accès refusé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error || 'Prédictions introuvables'}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const predictions = prediction.predictions as Prediction[];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">{prediction.name}</h1>
          <p className="text-muted-foreground mt-1">Prédictions partagées en lecture seule</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Scénarios Prédictifs</CardTitle>
            <CardDescription>
              Partagé le {new Date(prediction.created_at).toLocaleDateString('fr-FR')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="optimistic">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="optimistic" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Optimiste
                </TabsTrigger>
                <TabsTrigger value="realistic" className="gap-2">
                  <Minus className="h-4 w-4" />
                  Réaliste
                </TabsTrigger>
                <TabsTrigger value="pessimistic" className="gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Pessimiste
                </TabsTrigger>
              </TabsList>

              {predictions.map((pred) => (
                <TabsContent key={pred.scenario_type} value={pred.scenario_type}>
                  <div className="space-y-6 mt-6">
                    <div className={`p-4 rounded-lg border ${getScenarioColor(pred.scenario_type)}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {getScenarioIcon(pred.scenario_type)}
                        <h3 className="font-semibold text-lg">{pred.title}</h3>
                      </div>
                      <p className="text-sm">
                        Probabilité: {(pred.probability * 100).toFixed(0)}%
                      </p>
                    </div>

                    {Object.keys(pred.predicted_kpis).length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold mb-3">KPIs Projetés</h4>
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(pred.predicted_kpis).map(([key, value]) => (
                              <Card key={key} className="bg-muted/30">
                                <CardContent className="pt-4">
                                  <p className="text-sm text-muted-foreground">{key}</p>
                                  <p className="text-2xl font-bold">{value as string}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {pred.assumptions?.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold mb-3">Hypothèses</h4>
                          <ul className="space-y-2">
                            {pred.assumptions.map((assumption, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <Badge variant="outline" className="shrink-0 mt-0.5">
                                  {idx + 1}
                                </Badge>
                                <span className="text-sm">{assumption}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}

                    {pred.risk_factors?.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold mb-3">Facteurs de Risque</h4>
                          <ul className="space-y-2">
                            {pred.risk_factors.map((risk, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <Badge variant="destructive" className="shrink-0 mt-0.5">
                                  ⚠️
                                </Badge>
                                <span className="text-sm">{risk}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}

                    {pred.recommendations?.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold mb-3">Recommandations</h4>
                          <ul className="space-y-2">
                            {pred.recommendations.map((rec, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-primary">✓</span>
                                <span className="text-sm">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default SharedPrediction;
