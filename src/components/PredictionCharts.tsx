import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ExpandableChart } from './ExpandableChart';

interface Prediction {
  scenario_type: string;
  title: string;
  predicted_kpis: any;
  probability: number;
}

interface PredictionChartsProps {
  predictions: Prediction[];
}

export const PredictionCharts = ({ predictions }: PredictionChartsProps) => {
  const getKPIComparisonData = () => {
    if (!predictions.length) return [];

    const allKPIs = Array.from(
      new Set(predictions.flatMap(p => Object.keys(p.predicted_kpis)))
    );

    return allKPIs.map(kpi => {
      const dataPoint: any = { name: kpi };
      predictions.forEach(pred => {
        const value = pred.predicted_kpis[kpi];
        const numericValue = typeof value === 'string' 
          ? parseFloat(value.replace(/[^0-9.-]/g, '')) 
          : value;
        dataPoint[pred.scenario_type] = isNaN(numericValue) ? 0 : numericValue;
      });
      return dataPoint;
    });
  };

  const getProbabilityData = () => {
    return predictions.map(pred => ({
      scenario: pred.title,
      probability: pred.probability * 100,
    }));
  };

  const getRadarData = () => {
    if (!predictions.length) return [];
    
    const allKPIs = Array.from(
      new Set(predictions.flatMap(p => Object.keys(p.predicted_kpis)))
    );

    return allKPIs.slice(0, 6).map(kpi => {
      const dataPoint: any = { metric: kpi };
      predictions.forEach(pred => {
        const value = pred.predicted_kpis[kpi];
        const numericValue = typeof value === 'string' 
          ? parseFloat(value.replace(/[^0-9.-]/g, '')) 
          : value;
        dataPoint[pred.scenario_type] = isNaN(numericValue) ? 0 : Math.abs(numericValue);
      });
      return dataPoint;
    });
  };

  const kpiData = getKPIComparisonData();
  const probabilityData = getProbabilityData();
  const radarData = getRadarData();

  const scenarioColors = {
    optimistic: 'hsl(142 76% 36%)',
    realistic: 'hsl(221 83% 53%)',
    pessimistic: 'hsl(0 84% 60%)',
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPI Comparison Bar Chart */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">Comparaison des KPIs par Scénario</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Cliquez sur l'icône pour agrandir</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpandableChart title="Comparaison des KPIs par Scénario" className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpiData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={10} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="hsl(var(--foreground))" fontSize={10} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                {predictions.map(pred => (
                  <Bar 
                    key={pred.scenario_type}
                    dataKey={pred.scenario_type} 
                    fill={scenarioColors[pred.scenario_type as keyof typeof scenarioColors]}
                    name={pred.title}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ExpandableChart>
        </CardContent>
      </Card>

      {/* Probability Chart */}
      <Card className="border-l-4 border-l-accent">
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">Probabilités des Scénarios</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpandableChart title="Probabilités des Scénarios" className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={probabilityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--foreground))" fontSize={10} />
                <YAxis type="category" dataKey="scenario" width={100} stroke="hsl(var(--foreground))" fontSize={10} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="probability" fill="hsl(var(--primary))" name="Probabilité (%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ExpandableChart>
        </CardContent>
      </Card>

      {/* Radar Chart */}
      {radarData.length > 0 && (
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">Vue Multidimensionnelle</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpandableChart title="Vue Multidimensionnelle" className="h-72 sm:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="metric" stroke="hsl(var(--foreground))" fontSize={10} />
                  <PolarRadiusAxis stroke="hsl(var(--muted-foreground))" fontSize={8} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                  {predictions.map(pred => (
                    <Radar
                      key={pred.scenario_type}
                      name={pred.title}
                      dataKey={pred.scenario_type}
                      stroke={scenarioColors[pred.scenario_type as keyof typeof scenarioColors]}
                      fill={scenarioColors[pred.scenario_type as keyof typeof scenarioColors]}
                      fillOpacity={0.3}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </ExpandableChart>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
