import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, AlertTriangle, ArrowLeft, Bell, CheckCircle, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Alert {
  id: string;
  report_id: string;
  alert_type: string;
  severity: string;
  message: string;
  is_acknowledged: boolean;
  created_at: string;
  detected_value: any;
  reports?: {
    title: string;
  };
}

const Alerts = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('unread');

  useEffect(() => {
    fetchAlerts();
    
    // Subscribe to real-time alerts
    const channel = supabase
      .channel('alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'report_alerts' }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from('report_alerts')
      .select('*, reports(title)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de charger les alertes",
        variant: "destructive",
      });
    } else {
      setAlerts(data || []);
    }
    setLoading(false);
  };

  const acknowledgeAlert = async (alertId: string) => {
    const { error } = await supabase
      .from('report_alerts')
      .update({ 
        is_acknowledged: true,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId);

    if (error) {
      toast({
        title: "Erreur",
        description: "Impossible de confirmer l'alerte",
        variant: "destructive",
      });
    } else {
      fetchAlerts();
      toast({
        title: "Alerte confirmée",
        description: "L'alerte a été marquée comme lue",
      });
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'high': return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'medium': return <Bell className="h-5 w-5 text-yellow-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      default: return 'default';
    }
  };

  const filteredAlerts = filter === 'all' 
    ? alerts 
    : alerts.filter(a => !a.is_acknowledged);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au tableau de bord
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">Alertes Système</h1>
              <p className="text-muted-foreground mt-1">
                Surveillance en temps réel des anomalies et événements critiques
              </p>
            </div>
          </div>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')} className="mb-6">
          <TabsList>
            <TabsTrigger value="unread">
              Non lues ({alerts.filter(a => !a.is_acknowledged).length})
            </TabsTrigger>
            <TabsTrigger value="all">Toutes ({alerts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-6">
            {loading ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  Chargement des alertes...
                </CardContent>
              </Card>
            ) : filteredAlerts.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">
                    {filter === 'all' ? 'Aucune alerte' : 'Aucune alerte non lue'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className={filteredAlerts.length > 5 ? 'max-h-[600px]' : ''}>
                <div className="space-y-4">
                  {filteredAlerts.map((alert) => (
                    <Card key={alert.id} className={alert.is_acknowledged ? 'opacity-60' : ''}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getSeverityIcon(alert.severity)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <CardTitle className="text-lg">{alert.reports?.title || 'Rapport'}</CardTitle>
                                <Badge variant={getSeverityColor(alert.severity) as any}>
                                  {alert.severity}
                                </Badge>
                                <Badge variant="outline">{alert.alert_type}</Badge>
                              </div>
                              <CardDescription className="text-base">
                                {alert.message}
                              </CardDescription>
                              {alert.detected_value && (
                                <div className="mt-2 text-sm text-muted-foreground">
                                  Détails: {JSON.stringify(alert.detected_value, null, 2)}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 ml-4">
                            <span className="text-sm text-muted-foreground">
                              {new Date(alert.created_at).toLocaleString('fr-FR')}
                            </span>
                            {!alert.is_acknowledged && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => acknowledgeAlert(alert.id)}
                              >
                                Marquer comme lue
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Alerts;
