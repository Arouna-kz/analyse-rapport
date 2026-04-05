import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Loader2, Sparkles, Save, Download, History, FileSpreadsheet, Share2, BarChart3, GitCompare, Zap, Settings2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { PredictionCharts } from '@/components/PredictionCharts';
import { PredictionComparison } from '@/components/PredictionComparison';
import { AnalysisRefinement } from '@/components/AnalysisRefinement';
import { cleanMarkdown } from '@/lib/textUtils';
import { useArenaConfig } from '@/hooks/useArenaConfig';
import { ArenaStatus } from '@/components/ArenaStatus';

interface Report {
  id: string;
  title: string;
  report_type: string;
  created_at: string;
}

interface Prediction {
  id: string;
  scenario_type: string;
  title: string;
  predicted_kpis: any;
  confidence_scores: any;
  assumptions: string[];
  risk_factors: string[];
  recommendations: string[];
  probability: number;
}

const MultiScenarioPredictions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config, getEnabledModels } = useArenaConfig();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [savedPredictions, setSavedPredictions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [sharing, setSharing] = useState(false);
  const [currentPredictionId, setCurrentPredictionId] = useState<string | null>(null);
  const [showChartsView, setShowChartsView] = useState(false);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [refining, setRefining] = useState(false);
  const [useArenaMode, setUseArenaMode] = useState(true);
  const [arenaDetails, setArenaDetails] = useState<any>(null);

  const handleRefinePrediction = async (feedback: string) => {
    if (selectedReports.length === 0) return;
    setRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke('refine-analysis', {
        body: { reportId: selectedReports[0], feedback, type: 'prediction' }
      });
      if (error) throw error;
      if (data?.predictions) {
        setPredictions(data.predictions);
        toast({ title: "Prédictions améliorées", description: "Les prédictions ont été mises à jour" });
      }
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setRefining(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    const { data } = await supabase
      .from('reports')
      .select('id, title, report_type, created_at')
      .in('report_type', ['past', 'current'])
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (data) {
      setReports(data);
    }
    setLoading(false);
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('saved_prediction_scenarios')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setSavedPredictions(data);
    }
    setLoadingHistory(false);
  };

  const handleSave = async () => {
    if (!saveName.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez entrer un nom pour sauvegarder les prédictions",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { data, error } = await supabase
        .from('saved_prediction_scenarios')
        .insert({
          name: saveName,
          created_by: user.id,
          base_report_ids: selectedReports,
          predictions: predictions as any,
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentPredictionId(data.id);
      toast({
        title: "Prédictions sauvegardées",
        description: `Les scénarios ont été sauvegardés sous "${saveName}"`,
      });
      setShowSaveDialog(false);
      setSaveName('');
      fetchHistory();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!currentPredictionId) {
      toast({
        title: "Erreur",
        description: "Veuillez d'abord sauvegarder les prédictions",
        variant: "destructive",
      });
      return;
    }

    setSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const shareToken = crypto.randomUUID();
      
      const { error } = await supabase
        .from('prediction_shares')
        .insert({
          prediction_id: currentPredictionId,
          share_token: shareToken,
          created_by: user.id,
        });

      if (error) throw error;

      const link = `${window.location.origin}/shared?token=${shareToken}`;
      setShareLink(link);
      setShowShareDialog(true);
      
      toast({
        title: "Lien de partage créé",
        description: "Copiez le lien pour le partager",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast({
      title: "Lien copié",
      description: "Le lien a été copié dans le presse-papiers",
    });
  };

  const toggleCompareSelection = (id: string) => {
    setSelectedForCompare(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  };

  const getComparedPredictions = () => {
    return savedPredictions.filter(p => selectedForCompare.includes(p.id));
  };

  const handleCompare = () => {
    if (selectedForCompare.length < 2) {
      toast({
        title: "Sélection insuffisante",
        description: "Veuillez sélectionner au moins 2 prédictions à comparer",
        variant: "destructive",
      });
      return;
    }
    setShowCompareDialog(true);
  };

  const handleViewAnalytics = async () => {
    if (!currentPredictionId) {
      toast({
        title: "Erreur",
        description: "Veuillez d'abord charger une prédiction sauvegardée",
        variant: "destructive",
      });
      return;
    }

    setLoadingAnalytics(true);
    setShowAnalyticsDialog(true);

    try {
      // Get share info for this prediction
      const { data: shares } = await supabase
        .from('prediction_shares')
        .select('id')
        .eq('prediction_id', currentPredictionId);

      if (!shares || shares.length === 0) {
        setAnalyticsData([]);
        return;
      }

      // Get detailed view analytics
      const { data: views, error } = await supabase
        .from('prediction_share_views')
        .select('*')
        .in('share_id', shares.map(s => s.id))
        .order('viewed_at', { ascending: false });

      if (error) throw error;
      setAnalyticsData(views || []);
    } catch (error: any) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors du chargement des analytics",
        variant: "destructive",
      });
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleExportAnalytics = async (format: 'csv' | 'json') => {
    if (!currentPredictionId) return;

    try {
      // Get share info for this prediction
      const { data: shares } = await supabase
        .from('prediction_shares')
        .select('id')
        .eq('prediction_id', currentPredictionId);

      if (!shares || shares.length === 0) {
        toast({
          title: "Erreur",
          description: "Aucune donnée d'analytics à exporter",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('export-share-analytics', {
        body: { 
          shareId: shares[0].id,
          format 
        },
      });

      if (error) throw error;

      // Create blob and download
      const blob = new Blob([format === 'csv' ? data : JSON.stringify(data, null, 2)], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export réussi",
        description: `Analytics exportées en ${format.toUpperCase()}`,
      });
    } catch (error: any) {
      console.error('Error exporting analytics:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'export des analytics",
        variant: "destructive",
      });
    }
  };

  const loadSavedPrediction = (saved: any) => {
    setPredictions(saved.predictions);
    setSelectedReports(saved.base_report_ids);
    setCurrentPredictionId(saved.id);
    setShowHistory(false);
    toast({
      title: "Prédictions chargées",
      description: `"${saved.name}" a été chargé`,
    });
  };

  const handleExportExcel = () => {
    const name = saveName || 'predictions';
    exportToExcel(predictions, name);
    toast({
      title: "Export réussi",
      description: "Les prédictions ont été exportées en Excel",
    });
  };

  const handleExportPDF = () => {
    const name = saveName || 'predictions';
    exportToPDF(predictions, name);
  };

  const handleGenerate = async () => {
    if (selectedReports.length === 0) {
      toast({
        title: "Aucun rapport sélectionné",
        description: "Sélectionnez au moins un rapport pour générer des prédictions",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setArenaDetails(null);
    
    try {
      const enabledModels = getEnabledModels();
      
      const { data, error } = await supabase.functions.invoke('multi-scenario-predictions', {
        body: { 
          baseReportIds: selectedReports,
          useArena: useArenaMode,
          models: useArenaMode ? enabledModels : undefined
        }
      });

      if (error) throw error;

      setPredictions(data.predictions);
      
      if (data.arenaMode && data.predictions[0]?.arenaDetails) {
        setArenaDetails(data.predictions[0].arenaDetails);
      }
      
      toast({
        title: useArenaMode ? "Prédictions Arena générées" : "Prédictions générées",
        description: useArenaMode 
          ? `Consensus multi-modèles avec ${enabledModels.length} modèles`
          : "Les 3 scénarios ont été générés avec succès",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const toggleReport = (reportId: string) => {
    setSelectedReports(prev =>
      prev.includes(reportId)
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au tableau de bord
            </Button>
            <Button variant="outline" onClick={() => { setShowHistory(true); fetchHistory(); }}>
              <History className="h-4 w-4 mr-2" />
              Historique
            </Button>
            <Button
              variant="outline"
              onClick={handleViewAnalytics}
              disabled={!currentPredictionId}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            <Button variant="outline" onClick={() => navigate('/arena-settings')}>
              <Settings2 className="h-4 w-4 mr-2" />
              Config Arena
            </Button>
          </div>
          
          {/* Arena Mode Toggle */}
          <div className="flex items-center gap-3">
            <Label htmlFor="arena-mode" className="text-sm font-medium flex items-center gap-2">
              <Zap className={`h-4 w-4 ${useArenaMode ? 'text-primary' : 'text-muted-foreground'}`} />
              Mode Arena
            </Label>
            <Switch
              id="arena-mode"
              checked={useArenaMode}
              onCheckedChange={setUseArenaMode}
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold flex items-center gap-2">
                Prédictions Multi-Scénarios
                {useArenaMode && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    <Zap className="h-3 w-3 mr-1" />
                    Arena
                  </Badge>
                )}
              </h1>
              <p className="text-muted-foreground mt-1">
                {useArenaMode 
                  ? `Prévisions par consensus multi-modèles (${getEnabledModels().length} modèles actifs)`
                  : 'Générez des prévisions optimistes, réalistes et pessimistes basées sur vos rapports'
                }
              </p>
            </div>
          </div>
          
          {/* Arena Status */}
          {generating && useArenaMode && (
            <Card className="mb-4 border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary animate-pulse" />
                  Analyse Arena en cours...
                </CardTitle>
                <CardDescription>
                  Interrogation de {getEnabledModels().length} modèles en parallèle
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {getEnabledModels().map((model) => (
                    <div key={model.id} className="flex items-center justify-between text-sm">
                      <span>{model.name}</span>
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Arena Results Summary */}
          {arenaDetails && config.showExpertMode && (
            <Card className="mb-4 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Résultat Arena
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-3">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    Score de consensus: {Math.round(arenaDetails.consensusScore * 100)}%
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {arenaDetails.modelResponses?.length} modèles consultés
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {arenaDetails.modelResponses?.map((r: any) => (
                    <div key={r.modelId} className="text-sm p-2 rounded bg-muted/50">
                      <div className="font-medium truncate">{r.modelName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.error ? (
                          <span className="text-destructive">Erreur</span>
                        ) : (
                          `${r.processingTime}ms`
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Selection Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Sélectionner les rapports</CardTitle>
              <CardDescription>
                Choisissez les rapports à analyser
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3 p-3">
                      <Skeleton className="h-5 w-5 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : reports.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun rapport disponible
                </p>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-4 pr-2">
                    {reports.map((report) => (
                      <div
                        key={report.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-base cursor-pointer"
                        onClick={() => toggleReport(report.id)}
                      >
                        <Checkbox
                          checked={selectedReports.includes(report.id)}
                          onCheckedChange={() => toggleReport(report.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{report.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(report.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              <Separator className="my-6" />

              <Button
                onClick={handleGenerate}
                disabled={generating || selectedReports.length === 0}
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Générer les scénarios
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Predictions Panel */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Scénarios Prédictifs</CardTitle>
              <CardDescription>
                Comparez les différentes prévisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {predictions.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Sélectionnez des rapports et cliquez sur "Générer" pour créer les prédictions
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-4 flex-wrap">
                    <Button onClick={() => setShowSaveDialog(true)} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Sauvegarder
                    </Button>
                    <Button onClick={handleShare} variant="outline" size="sm" disabled={!currentPredictionId || sharing}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Partager
                    </Button>
                    <Button onClick={() => setShowChartsView(!showChartsView)} variant="outline" size="sm">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      {showChartsView ? 'Masquer' : 'Afficher'} Graphiques
                    </Button>
                    <Button onClick={handleExportExcel} variant="outline" size="sm">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                    <Button onClick={handleExportPDF} variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>

                  {showChartsView && (
                    <div className="mb-6">
                      <PredictionCharts predictions={predictions} />
                    </div>
                  )}
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

                  {predictions.map((prediction) => (
                    <TabsContent key={prediction.scenario_type} value={prediction.scenario_type}>
                      <div className="space-y-6 mt-6">
                        <div className={`p-4 rounded-lg border ${getScenarioColor(prediction.scenario_type)}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {getScenarioIcon(prediction.scenario_type)}
                            <h3 className="font-semibold text-lg">{prediction.title}</h3>
                          </div>
                          <p className="text-sm">
                            Probabilité: {(prediction.probability * 100).toFixed(0)}%
                          </p>
                        </div>

                        {/* KPIs */}
                        {Object.keys(prediction.predicted_kpis).length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <h4 className="font-semibold mb-3">KPIs Projetés</h4>
                              <div className="grid grid-cols-2 gap-3">
                                {Object.entries(prediction.predicted_kpis).map(([key, value]) => (
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

                        {/* Assumptions */}
                        {prediction.assumptions?.length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <h4 className="font-semibold mb-3">Hypothèses</h4>
                              <ul className="space-y-2">
                                {prediction.assumptions.map((assumption, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <Badge variant="outline" className="shrink-0 mt-0.5">
                                      {idx + 1}
                                    </Badge>
                                    <span className="text-sm">{cleanMarkdown(assumption)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </>
                        )}

                        {/* Risk Factors */}
                        {prediction.risk_factors?.length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <h4 className="font-semibold mb-3">Facteurs de Risque</h4>
                              <ul className="space-y-2">
                                {prediction.risk_factors.map((risk, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <Badge variant="destructive" className="shrink-0 mt-0.5">
                                      ⚠️
                                    </Badge>
                                    <span className="text-sm">{cleanMarkdown(risk)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </>
                        )}

                        {/* Recommendations */}
                        {prediction.recommendations?.length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <h4 className="font-semibold mb-3">Recommandations</h4>
                              <ul className="space-y-2">
                                {prediction.recommendations.map((rec, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-primary">✓</span>
                                    <span className="text-sm">{cleanMarkdown(rec)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </>
                        )}

                        {/* Refinement section for each prediction */}
                        <Separator className="my-4" />
                        <AnalysisRefinement
                          reportId={selectedReports[0] || ''}
                          onRefine={handleRefinePrediction}
                          isRefining={refining}
                          title="Améliorer cette prédiction"
                          description="Précisez ce que vous souhaitez voir dans les prédictions"
                          placeholder="Ex: Je voudrais des projections plus détaillées pour le CA, des hypothèses plus conservatrices..."
                          buttonLabel="Affiner les prédictions"
                        />
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sauvegarder les prédictions</DialogTitle>
            <DialogDescription>
              Donnez un nom à ces scénarios prédictifs pour les retrouver facilement
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nom des prédictions</Label>
              <Input
                id="name"
                placeholder="Ex: Prévisions Q1 2025"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Sauvegarder
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historique des prédictions</DialogTitle>
            <DialogDescription className="flex items-center justify-between">
              <span>Consultez et rechargez vos prédictions sauvegardées</span>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setShowCompareDialog(true);
                  setShowHistory(false);
                }}
                disabled={selectedForCompare.length < 2}
              >
                <GitCompare className="h-4 w-4 mr-2" />
                Comparer ({selectedForCompare.length})
              </Button>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {loadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 border rounded-lg">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : savedPredictions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune prédiction sauvegardée
              </div>
            ) : (
              savedPredictions.map((saved) => (
                <Card
                  key={saved.id}
                  className="hover:bg-muted/50 transition-base"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <Checkbox
                          checked={selectedForCompare.includes(saved.id)}
                          onCheckedChange={() => toggleCompareSelection(saved.id)}
                          disabled={!selectedForCompare.includes(saved.id) && selectedForCompare.length >= 3}
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold">{saved.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(saved.created_at).toLocaleDateString('fr-FR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <Badge variant="outline" className="mt-2">
                            {saved.predictions.length} scénarios
                          </Badge>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => loadSavedPrediction(saved)}
                      >
                        Charger
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partager les prédictions</DialogTitle>
            <DialogDescription>
              Partagez ce lien pour donner un accès en lecture seule aux prédictions
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Lien de partage</Label>
              <div className="flex gap-2">
                <Input value={shareLink} readOnly className="flex-1" />
                <Button onClick={copyShareLink} variant="outline">
                  Copier
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comparison Dialog */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comparaison des Prédictions</DialogTitle>
            <DialogDescription>
              Analysez côte à côte {selectedForCompare.length} scénarios sauvegardés
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <PredictionComparison predictions={getComparedPredictions()} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={showAnalyticsDialog} onOpenChange={setShowAnalyticsDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Analytics des Vues</DialogTitle>
            <DialogDescription>
              Statistiques détaillées des consultations de vos prédictions partagées
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={() => handleExportAnalytics('csv')}
                disabled={analyticsData.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Exporter CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportAnalytics('json')}
                disabled={analyticsData.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Exporter JSON
              </Button>
            </div>

            {loadingAnalytics ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : analyticsData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune vue enregistrée pour cette prédiction
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{analyticsData.length}</div>
                      <p className="text-xs text-muted-foreground">Vues totales</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {new Set(analyticsData.map(v => v.country).filter(Boolean)).size}
                      </div>
                      <p className="text-xs text-muted-foreground">Pays différents</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {new Set(analyticsData.map(v => v.ip_address).filter(Boolean)).size}
                      </div>
                      <p className="text-xs text-muted-foreground">Visiteurs uniques</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium">Date & Heure</th>
                          <th className="px-4 py-2 text-left text-xs font-medium">Localisation</th>
                          <th className="px-4 py-2 text-left text-xs font-medium">IP</th>
                          <th className="px-4 py-2 text-left text-xs font-medium">Navigateur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.map((view, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-4 py-2 text-sm">
                              {new Date(view.viewed_at).toLocaleString('fr-FR')}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              {view.city && view.country 
                                ? `${view.city}, ${view.country}`
                                : view.country || 'Non disponible'}
                            </td>
                            <td className="px-4 py-2 text-sm font-mono text-xs">
                              {view.ip_address || 'N/A'}
                            </td>
                            <td className="px-4 py-2 text-sm text-muted-foreground truncate max-w-xs">
                              {view.user_agent || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MultiScenarioPredictions;
