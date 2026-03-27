import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FileText, Clock, CheckCircle, AlertCircle, TrendingUp, BarChart3, Download, FileSpreadsheet, Share2, Copy, Cpu, FileDown } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from 'recharts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ExpandableChart } from '@/components/ExpandableChart';
import { AnalysisRefinement } from '@/components/AnalysisRefinement';
import { ReportActions } from '@/components/ReportActions';
import { AnalysisVersionHistory } from '@/components/AnalysisVersionHistory';
import { FileTypeIndicator } from '@/components/FileTypeIndicator';
import { ExtractedContentPreview } from '@/components/ExtractedContentPreview';
import { cleanMarkdown } from '@/lib/textUtils';
import { useArenaConfig } from '@/hooks/useArenaConfig';
import * as XLSX from 'xlsx';

interface Report {
  id: string;
  title: string;
  report_type: 'past' | 'current' | 'future';
  status: 'pending' | 'processing' | 'completed' | 'error';
  created_at: string;
  file_type: string;
  file_path: string | null;
}

interface ArenaMetadata {
  modelsUsed: { id: string; name: string; status: string; confidence: number }[];
  consensusAchieved: boolean;
}

interface Analysis {
  id: string;
  summary: string | null;
  key_points: string[] | null;
  kpis: any | null;
  insights: string | null;
  arena_metadata?: ArenaMetadata | null;
  arena_score?: number | null;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(185 80% 50%)', 'hsl(280 70% 60%)', 'hsl(45 90% 55%)', 'hsl(340 75% 55%)'];

const ReportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [report, setReport] = useState<Report | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [sharing, setSharing] = useState(false);
  const [refining, setRefining] = useState(false);

  const handleRefineAnalysis = async (feedback: string) => {
    if (!id) return;
    setRefining(true);
    try {
      const { error } = await supabase.functions.invoke('refine-analysis', {
        body: { reportId: id, feedback, type: 'analysis' }
      });
      if (error) throw error;
      toast({ title: "Analyse améliorée", description: "L'analyse a été mise à jour" });
      fetchReportAndAnalysis();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setRefining(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    fetchReportAndAnalysis();

    const channel = supabase
      .channel('report-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reports',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const updatedReport = payload.new as Report;
          setReport(updatedReport);
          
          if (updatedReport.status === 'processing') {
            setProgress(50);
          } else if (updatedReport.status === 'completed') {
            setProgress(100);
            fetchReportAndAnalysis();
          } else if (updatedReport.status === 'error') {
            setProgress(0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchReportAndAnalysis = async () => {
    if (!id) return;

    setLoading(true);
    
    const { data: reportData, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();

    if (reportError) {
      toast({
        title: "Erreur",
        description: "Impossible de charger le rapport",
        variant: "destructive",
      });
      navigate('/dashboard');
      return;
    }

    setReport(reportData);

    if (reportData.status === 'pending') setProgress(0);
    else if (reportData.status === 'processing') setProgress(50);
    else if (reportData.status === 'completed') setProgress(100);

    if (reportData.status === 'completed') {
      const { data: analysisData } = await supabase
        .from('report_analyses')
        .select('*')
        .eq('report_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (analysisData) {
        setAnalysis({
          id: analysisData.id,
          ...analysisData,
          arena_metadata: analysisData.arena_metadata as unknown as ArenaMetadata | null,
          arena_score: analysisData.arena_score as number | null,
        });
      }
    }

    setLoading(false);
  };

  const handleExportExcel = () => {
    if (!report || !analysis) return;

    const workbook = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
      ['Titre du Rapport', report.title],
      ['Type', report.report_type],
      ['Créé le', new Date(report.created_at).toLocaleDateString('fr-FR')],
      [],
      ['Résumé'],
      [analysis.summary || ''],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Résumé');

    // KPIs sheet
    if (analysis.kpis) {
      const kpiData = [['KPI', 'Valeur'], ...Object.entries(analysis.kpis)];
      const kpiSheet = XLSX.utils.aoa_to_sheet(kpiData);
      XLSX.utils.book_append_sheet(workbook, kpiSheet, 'KPIs');
    }

    // Key points sheet
    if (analysis.key_points?.length) {
      const keyPointsData = [['Points Clés'], ...analysis.key_points.map(p => [p])];
      const keyPointsSheet = XLSX.utils.aoa_to_sheet(keyPointsData);
      XLSX.utils.book_append_sheet(workbook, keyPointsSheet, 'Points Clés');
    }

    XLSX.writeFile(workbook, `${report.title.replace(/[^a-z0-9]/gi, '_')}_analysis.xlsx`);
    
    toast({
      title: "Export réussi",
      description: "L'analyse a été exportée en Excel",
    });
  };

  const handleExportWord = () => {
    if (!report || !analysis) return;

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${report.title}</title>
      <style>
        body { font-family: Calibri, sans-serif; padding: 20px; line-height: 1.6; }
        h1 { color: #1e3a5f; border-bottom: 2px solid #22d3ee; padding-bottom: 10px; }
        h2 { color: #334155; margin-top: 25px; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        td, th { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #f1f5f9; font-weight: bold; }
        ul { margin: 10px 0; }
        li { margin: 8px 0; }
        .insights { background: #fffbeb; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0; }
      </style></head>
      <body>
        <h1>${report.title}</h1>
        <p><strong>Type:</strong> ${report.report_type === 'past' ? 'Passé' : report.report_type === 'current' ? 'Actuel' : 'Futur'} | <strong>Date:</strong> ${new Date(report.created_at).toLocaleDateString('fr-FR')}</p>
        ${analysis.summary ? `<h2>Résumé</h2><p>${analysis.summary}</p>` : ''}
        ${analysis.kpis && Object.keys(analysis.kpis).length > 0 ? `
          <h2>Indicateurs Clés (KPIs)</h2>
          <table><tr><th>Indicateur</th><th>Valeur</th></tr>
          ${Object.entries(analysis.kpis).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
          </table>` : ''}
        ${analysis.key_points?.length ? `
          <h2>Points Clés</h2><ul>${analysis.key_points.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
        ${analysis.insights ? `<h2>Insights et Recommandations</h2><div class="insights">${analysis.insights.replace(/\n/g, '<br>')}</div>` : ''}
      </body></html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/[^a-z0-9]/gi, '_')}_analysis.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: "Export réussi", description: "L'analyse a été exportée en Word" });
  };

  const handleExportPDF = () => {
    if (!report || !analysis) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${report.title} - Analyse</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; line-height: 1.6; }
            h1 { color: #1e3a5f; border-bottom: 3px solid #22d3ee; padding-bottom: 15px; }
            h2 { color: #334155; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
            .meta { color: #64748b; margin-bottom: 30px; display: flex; gap: 20px; }
            .meta span { background: #f1f5f9; padding: 6px 12px; border-radius: 6px; }
            .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
            .kpi-card { padding: 20px; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; }
            .kpi-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
            .kpi-value { font-size: 28px; font-weight: bold; color: #0f172a; margin-top: 5px; }
            ul { margin: 15px 0; padding-left: 0; list-style: none; }
            li { margin: 12px 0; padding: 12px 15px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #22d3ee; }
            .insights { background: #fefce8; padding: 20px; border-radius: 12px; border: 1px solid #fde047; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>${report.title}</h1>
          <div class="meta">
            <span>Type: ${report.report_type === 'past' ? 'Passé' : report.report_type === 'current' ? 'Actuel' : 'Futur'}</span>
            <span>Date: ${new Date(report.created_at).toLocaleDateString('fr-FR')}</span>
          </div>
          
          ${analysis.summary ? `<h2>📋 Résumé</h2><p>${analysis.summary}</p>` : ''}
          
          ${analysis.kpis && Object.keys(analysis.kpis).length > 0 ? `
            <h2>📊 Indicateurs Clés (KPIs)</h2>
            <div class="kpis">
              ${Object.entries(analysis.kpis).map(([key, value]) => `
                <div class="kpi-card">
                  <div class="kpi-label">${key}</div>
                  <div class="kpi-value">${value}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          ${analysis.key_points?.length ? `
            <h2>✅ Points Clés</h2>
            <ul>
              ${analysis.key_points.map(point => `<li>${point}</li>`).join('')}
            </ul>
          ` : ''}
          
          ${analysis.insights ? `
            <h2>💡 Insights et Recommandations</h2>
            <div class="insights">${analysis.insights.replace(/\n/g, '<br>')}</div>
          ` : ''}
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  const handleShare = async () => {
    if (!id) return;
    
    setSharing(true);
    try {
      const link = `${window.location.origin}/report/${id}`;
      setShareLink(link);
      setShowShareDialog(true);
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

  const getStatusIcon = () => {
    if (!report) return null;
    
    switch (report.status) {
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-emerald-500" />;
      case 'processing':
        return <Clock className="h-6 w-6 text-primary animate-pulse" />;
      case 'error':
        return <AlertCircle className="h-6 w-6 text-destructive" />;
      default:
        return <Clock className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getProgressLabel = () => {
    if (!report) return '';
    
    switch (report.status) {
      case 'pending':
        return 'En attente...';
      case 'processing':
        return 'Analyse en cours...';
      case 'completed':
        return 'Analyse terminée';
      case 'error':
        return 'Erreur lors de l\'analyse';
      default:
        return '';
    }
  };

  const prepareKPIChartData = () => {
    if (!analysis?.kpis) return [];
    
    return Object.entries(analysis.kpis).map(([key, value]) => ({
      name: key,
      value: typeof value === 'number' ? value : parseFloat(value as string) || 0,
    }));
  };

  const prepareLineChartData = () => {
    const kpiData = prepareKPIChartData();
    return kpiData.map((item, index) => ({
      ...item,
      trend: item.value * (1 + (Math.random() - 0.5) * 0.3),
      index,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto text-primary animate-pulse mb-4" />
          <p className="text-muted-foreground">Chargement du rapport...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const kpiData = prepareKPIChartData();
  const lineChartData = prepareLineChartData();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-sm sm:text-base">
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Retour au tableau de bord</span>
            <span className="sm:hidden">Retour</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 mb-4">
            <div className="flex items-start gap-3 flex-1">
              {getStatusIcon()}
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold mb-2 break-words">{report.title}</h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                  <span>
                    Créé le {new Date(report.created_at).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <FileTypeIndicator fileType={report.file_type} filePath={report.file_path} size="sm" />
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    {report.report_type === 'past' && 'Passé'}
                    {report.report_type === 'current' && 'Actuel'}
                    {report.report_type === 'future' && 'Futur'}
                  </Badge>
                </div>
              </div>
            </div>
            
            {/* Export Buttons */}
            {report.status === 'completed' && analysis && (
              <div className="flex flex-wrap gap-2">
                <ExtractedContentPreview 
                  reportId={id || ''} 
                  filePath={report.file_path} 
                  fileType={report.file_type} 
                />
                <Button onClick={handleExportExcel} variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <FileSpreadsheet className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Excel</span>
                </Button>
                <Button onClick={handleExportWord} variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <FileDown className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Word</span>
                </Button>
                <Button onClick={handleExportPDF} variant="outline" size="sm" className="flex-1 sm:flex-none">
                  <Download className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
                <Button onClick={handleShare} variant="outline" size="sm" disabled={sharing} className="flex-1 sm:flex-none">
                  <Share2 className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Partager</span>
                </Button>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {report.status !== 'completed' && (
            <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{getProgressLabel()}</p>
                    <span className="text-sm text-muted-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Analysis Content */}
        {report.status === 'completed' && analysis && (
          <div className="space-y-4 sm:space-y-6">
            {/* Arena Metadata */}
            {analysis.arena_metadata && (
              <Card className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-500/5 to-pink-500/5">
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Cpu className="h-5 w-5 text-purple-500" />
                    Analyse Multi-Modèles (Arena)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Consensus:</span>
                        <Badge variant={analysis.arena_metadata.consensusAchieved ? "default" : "secondary"} className="bg-purple-500/20 text-purple-600 border-purple-500/30">
                          {analysis.arena_metadata.consensusAchieved ? '✓ Atteint' : 'Non atteint'}
                        </Badge>
                      </div>
                      {analysis.arena_score && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Score:</span>
                          <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                            {(analysis.arena_score * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Modèles utilisés:</p>
                      <div className="flex flex-wrap gap-2">
                        {analysis.arena_metadata.modelsUsed?.map((model, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className={model.status === 'success' ? 'border-emerald-500/30 text-emerald-600' : 'border-destructive/30 text-destructive'}
                          >
                            {model.name} ({model.status === 'success' ? `${(model.confidence * 100).toFixed(0)}%` : 'Erreur'})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Summary */}
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <FileText className="h-5 w-5 text-primary" />
                  Résumé
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed text-sm sm:text-base">{cleanMarkdown(analysis.summary || '')}</p>
              </CardContent>
            </Card>

            {/* Key Points */}
            {analysis.key_points && analysis.key_points.length > 0 && (
              <Card className="border-l-4 border-l-emerald-500">
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                    Points clés
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className={analysis.key_points.length > 8 ? 'max-h-[400px]' : ''}>
                    <ul className="space-y-2 sm:space-y-3">
                      {analysis.key_points.map((point, index) => (
                        <li key={index} className="flex items-start gap-3 p-2 sm:p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                          <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
                          <span className="text-foreground text-sm sm:text-base">{cleanMarkdown(point)}</span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* KPIs Visualization */}
            {kpiData.length > 0 && (
              <Card className="border-l-4 border-l-accent">
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <BarChart3 className="h-5 w-5 text-accent" />
                    Indicateurs clés (KPIs)
                  </CardTitle>
                  <CardDescription>Cliquez sur l'icône pour agrandir un graphique</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Charts Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Bar Chart */}
                    <ExpandableChart title="Indicateurs par catégorie" className="h-64 sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={kpiData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="name" 
                            stroke="hsl(var(--foreground))"
                            fontSize={10}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
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
                          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ExpandableChart>

                    {/* Pie Chart */}
                    <ExpandableChart title="Répartition des KPIs" className="h-64 sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={kpiData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={kpiData.length <= 4 ? ({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%` : false}
                            outerRadius="70%"
                            fill="hsl(var(--primary))"
                            dataKey="value"
                          >
                            {kpiData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
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
                        </PieChart>
                      </ResponsiveContainer>
                    </ExpandableChart>

                    {/* Area Chart */}
                    <ExpandableChart title="Evolution des tendances" className="h-64 sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={lineChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={10} />
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
                          <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} name="Valeur" />
                          <Area type="monotone" dataKey="trend" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.3} name="Tendance" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ExpandableChart>

                    {/* Line Chart */}
                    <ExpandableChart title="Progression des indicateurs" className="h-64 sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lineChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={10} />
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
                          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} name="Valeur actuelle" />
                          <Line type="monotone" dataKey="trend" stroke="hsl(var(--accent))" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: 'hsl(var(--accent))' }} name="Tendance" />
                        </LineChart>
                      </ResponsiveContainer>
                    </ExpandableChart>
                  </div>

                  <Separator className="my-4 sm:my-6" />

                  {/* KPI Cards */}
                  <ScrollArea className={kpiData.length > 12 ? 'max-h-[400px]' : ''}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                      {kpiData.map((kpi, index) => (
                        <Card key={index} className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10 hover:shadow-md transition-shadow">
                          <CardContent className="pt-4 sm:pt-6 text-center">
                            <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">{kpi.name}</p>
                            <p className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{kpi.value}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Insights */}
            {analysis.insights && (
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <TrendingUp className="h-5 w-5 text-amber-500" />
                    Insights et Recommandations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-3 sm:p-4 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap text-sm sm:text-base">
                      {analysis.insights}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Error State */}
        {report.status === 'error' && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                <p className="text-lg font-semibold mb-2">Erreur lors de l'analyse</p>
                <p className="text-muted-foreground">
                  Une erreur s'est produite lors de l'analyse de ce rapport.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analysis Version History */}
        {report.status === 'completed' && (
          <AnalysisVersionHistory
            reportId={id || ''}
            currentAnalysisId={analysis?.id}
            onRestore={(version) => {
              setAnalysis({
                id: version.id,
                summary: version.summary,
                key_points: version.key_points,
                kpis: version.kpis,
                insights: version.insights,
                arena_metadata: version.arena_metadata as unknown as ArenaMetadata | null,
                arena_score: version.arena_score as number | null,
              });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* Interactive Refinement */}
        {report.status === 'completed' && (
          <AnalysisRefinement
            reportId={id || ''}
            onRefine={handleRefineAnalysis}
            isRefining={refining}
          />
        )}
      </main>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partager le rapport</DialogTitle>
            <DialogDescription>
              Partagez ce lien pour donner accès à l'analyse du rapport
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Lien de partage</Label>
              <div className="flex gap-2">
                <Input value={shareLink} readOnly className="flex-1" />
                <Button onClick={copyShareLink} variant="outline">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportDetail;
