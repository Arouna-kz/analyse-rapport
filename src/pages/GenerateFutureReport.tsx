import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FileText, Loader2, Sparkles, Eye } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import ReactMarkdown from 'react-markdown';
import { ReportExportButtons } from '@/components/ReportExportButtons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Report {
  id: string;
  title: string;
  report_type: string;
  created_at: string;
}

const GenerateFutureReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);

  useState(() => {
    fetchReports();
  });

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

  const handleGenerate = async () => {
    if (selectedReports.length === 0) {
      toast({
        title: "Aucun rapport sélectionné",
        description: "Sélectionnez au moins un rapport pour générer des prévisions",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-future-report', {
        body: {
          reportType: 'future',
          baseReportIds: selectedReports,
        }
      });

      if (error) throw error;

      setGeneratedReport(data);
      toast({
        title: "Rapport futur généré",
        description: "Le rapport prédictif a été généré avec succès",
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
            <Sparkles className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">Générer un Rapport Futur</h1>
              <p className="text-muted-foreground mt-1">
                Sélectionnez des rapports existants pour générer des prévisions basées sur l'IA
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Selection Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Sélectionner les rapports de base</CardTitle>
              <CardDescription>
                Choisissez les rapports passés et actuels à analyser
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : reports.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun rapport complété disponible
                </p>
              ) : (
                <div className="space-y-4">
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
                    Générer le rapport futur
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Generated Report Panel */}
          <Card className="lg:sticky lg:top-24 h-fit max-h-[calc(100vh-8rem)] overflow-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Rapport Généré
              </CardTitle>
              <CardDescription>
                Prévisions et recommandations basées sur l'IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!generatedReport ? (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Sélectionnez des rapports et cliquez sur "Générer" pour créer un rapport futur
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Export buttons */}
                  <ReportExportButtons 
                    title={generatedReport.title || 'Rapport Futur'} 
                    content={(() => {
                      const kpis = generatedReport.projectedKpis ? `\n\n## KPIs Projetés\n${Object.entries(generatedReport.projectedKpis).map(([k, v]) => `- **${k}**: ${v}`).join('\n')}` : '';
                      const recs = generatedReport.recommendations?.length ? `\n\n## Recommandations\n${generatedReport.recommendations.map((r: string) => `- ${r}`).join('\n')}` : '';
                      return `# ${generatedReport.title}\n\n${generatedReport.content}${kpis}${recs}`;
                    })()}
                  />

                  {/* Preview with tabs */}
                  <Tabs defaultValue="preview" className="w-full">
                    <TabsList className="w-full">
                      <TabsTrigger value="preview" className="flex-1">Aperçu</TabsTrigger>
                      <TabsTrigger value="source" className="flex-1">Source</TabsTrigger>
                    </TabsList>
                    <TabsContent value="preview" className="mt-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none max-h-[400px] overflow-y-auto rounded-lg border bg-card p-4">
                        <h2>{generatedReport.title}</h2>
                        <ReactMarkdown>{generatedReport.content}</ReactMarkdown>
                      </div>
                    </TabsContent>
                    <TabsContent value="source" className="mt-4">
                      <pre className="text-xs bg-muted rounded-lg p-4 max-h-[400px] overflow-y-auto whitespace-pre-wrap break-words font-mono">
                        {generatedReport.content}
                      </pre>
                    </TabsContent>
                  </Tabs>

                  {generatedReport.projectedKpis && Object.keys(generatedReport.projectedKpis).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold mb-3">KPIs Projetés</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.entries(generatedReport.projectedKpis).map(([key, value]) => (
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

                  {generatedReport.recommendations && generatedReport.recommendations.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold mb-3">Recommandations</h3>
                        <ul className="space-y-2">
                          {generatedReport.recommendations.map((rec: string, index: number) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default GenerateFutureReport;
