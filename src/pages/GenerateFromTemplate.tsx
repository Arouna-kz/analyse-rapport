import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Upload, FileText, Database, Loader2, Sparkles, Zap, Settings2, X, Plus, Download, Eye } from "lucide-react";
import { useArenaConfig } from "@/hooks/useArenaConfig";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { ReportExportButtons } from "@/components/ReportExportButtons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Report {
  id: string;
  title: string;
  report_type: string;
  created_at: string;
  status: string;
}

interface DataFile {
  file: File;
  id: string;
}

const GenerateFromTemplate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config, getEnabledModels } = useArenaConfig();
  
  const [dataFiles, setDataFiles] = useState<DataFile[]>([]);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateSource, setTemplateSource] = useState<"file" | "database">("file");
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [completedReports, setCompletedReports] = useState<Report[]>([]);
  const [reportTitle, setReportTitle] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [useArenaMode, setUseArenaMode] = useState(true);
  const [generatedResult, setGeneratedResult] = useState<{ reportId: string; title: string; content: string } | null>(null);

  useEffect(() => {
    fetchCompletedReports();
  }, []);

  const fetchCompletedReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('reports')
        .select('id, title, report_type, created_at, status')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompletedReports(data || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDataFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    
    const validFiles: DataFile[] = [];
    
    for (const file of files) {
      const isValidType = validTypes.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.csv');
      
      if (!isValidType) {
        toast({
          title: "Type de fichier non supporté",
          description: `${file.name}: seuls PDF, DOCX, TXT, CSV ou Excel sont acceptés`,
          variant: "destructive",
        });
        continue;
      }
      
      // No file size limit
      
      validFiles.push({
        file,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });
    }
    
    setDataFiles(prev => [...prev, ...validFiles]);
    e.target.value = '';
  };

  const removeDataFile = (id: string) => {
    setDataFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleTemplateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      if (!validTypes.includes(file.type) && !file.name.endsWith('.txt')) {
        toast({
          title: "Type de fichier non supporté",
          description: "Veuillez uploader un fichier PDF, DOCX ou TXT",
          variant: "destructive",
        });
        return;
      }
      setTemplateFile(file);
    }
  };

  const toggleReportSelection = (reportId: string) => {
    setSelectedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  // Validation: need template file OR existing reports (data files are optional)
  const hasValidTemplate = templateSource === "file" ? !!templateFile : selectedReports.length > 0;
  const canGenerate = hasValidTemplate && reportTitle.trim();

  const handleDownloadReport = () => {
    if (!generatedResult) return;
    const blob = new Blob([generatedResult.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedResult.title.replace(/[^a-z0-9àâéèêëïîôùûüÿçœæ]/gi, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSourceFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('reports').download(filePath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ title: "Erreur", description: "Impossible de télécharger le fichier", variant: "destructive" });
    }
  };

  const handleGenerate = async () => {
    if (!hasValidTemplate) {
      toast({
        title: "Modèle requis",
        description: templateSource === "file" 
          ? "Veuillez uploader un fichier modèle de rédaction" 
          : "Veuillez sélectionner au moins un rapport comme exemple",
        variant: "destructive",
      });
      return;
    }

    if (!reportTitle.trim()) {
      toast({
        title: "Titre requis",
        description: "Veuillez entrer un titre pour le rapport",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // Upload data files (optional - can be empty)
      const dataFilePaths: string[] = [];
      for (const dataFile of dataFiles) {
        const dataFilePath = `${user.id}/data_${Date.now()}_${dataFile.file.name}`;
        const { error: dataUploadError } = await supabase.storage
          .from('reports')
          .upload(dataFilePath, dataFile.file);

        if (dataUploadError) throw dataUploadError;
        dataFilePaths.push(dataFilePath);
      }

      // Upload template file if provided
      let templateFilePath = null;
      if (templateSource === "file" && templateFile) {
        templateFilePath = `${user.id}/template_${Date.now()}_${templateFile.name}`;
        const { error: templateUploadError } = await supabase.storage
          .from('reports')
          .upload(templateFilePath, templateFile);

        if (templateUploadError) throw templateUploadError;
      }

      // Call edge function
      const enabledModels = getEnabledModels();
      
      const response = await supabase.functions.invoke('generate-from-template', {
        body: {
          dataFilePaths, // Array of paths (can be empty)
          dataFilePath: dataFilePaths[0] || null, // Keep backward compatibility
          templateFilePath,
          templateSource,
          selectedReportIds: templateSource === "database" ? selectedReports : [],
          reportTitle,
          additionalInstructions,
          useArena: useArenaMode,
          models: useArenaMode ? enabledModels : undefined,
        },
      });

      if (response.error) {
        // Check for specific error messages from the edge function
        const errorBody = response.data;
        if (errorBody?.error) {
          throw new Error(errorBody.error);
        }
        throw response.error;
      }

      setGeneratedResult({
        reportId: response.data.reportId,
        title: response.data.title || reportTitle,
        content: response.data.content || '',
      });

      toast({
        title: useArenaMode ? "Rapport généré par Arena" : "Rapport généré avec succès",
        description: "Le rapport est prêt. Vous pouvez le télécharger ou le consulter.",
      });
    } catch (error: any) {
      console.error('Generation error:', error);
      toast({
        title: "Erreur de génération",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                Générer Rapport IA
                {useArenaMode && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    <Zap className="h-3 w-3 mr-1" />
                    Arena
                  </Badge>
                )}
              </h1>
              <p className="text-muted-foreground text-sm">
                {useArenaMode 
                  ? `Création par consensus multi-modèles (${getEnabledModels().length} modèles)`
                  : 'Créez un rapport professionnel à partir de vos données'
                }
              </p>
            </div>
          </div>
          
          {/* Arena Mode Toggle */}
          <div className="flex items-center gap-4">
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
            <Button variant="outline" size="sm" onClick={() => navigate('/arena-settings')}>
              <Settings2 className="h-4 w-4 mr-2" />
              Config
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Data File Upload - Now Optional and Multiple */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Fichier(s) de données
                <Badge variant="secondary" className="text-xs">Optionnel</Badge>
              </CardTitle>
              <CardDescription>
                Uploadez un ou plusieurs fichiers contenant les données brutes pour le rapport (optionnel)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Uploaded files list */}
                {dataFiles.length > 0 && (
                  <div className="space-y-2">
                    {dataFiles.map((dataFile) => (
                      <div
                        key={dataFile.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-primary/5 border-primary/20"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium text-sm">{dataFile.file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(dataFile.file.size / 1024 / 1024).toFixed(2)} Mo
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeDataFile(dataFile.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload zone */}
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center transition-colors border-border hover:border-primary/50 cursor-pointer"
                >
                  <input
                    type="file"
                    onChange={handleDataFilesChange}
                    className="hidden"
                    id="data-files"
                    accept=".pdf,.docx,.txt,.csv,.xls,.xlsx"
                    multiple
                  />
                  <label htmlFor="data-files" className="cursor-pointer">
                    <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-foreground font-medium">
                      {dataFiles.length > 0 ? 'Ajouter d\'autres fichiers' : 'Cliquez pour uploader'}
                    </p>
                    <p className="text-muted-foreground text-sm mt-1">PDF, DOCX, TXT, CSV, Excel</p>
                    <p className="text-muted-foreground text-xs mt-2">
                      Vous pouvez sélectionner plusieurs fichiers à la fois
                    </p>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Template Source Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Source du modèle de rédaction
                <Badge variant="default" className="text-xs">Requis</Badge>
              </CardTitle>
              <CardDescription>
                Choisissez comment l'IA doit structurer et rédiger le rapport
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={templateSource}
                onValueChange={(value) => setTemplateSource(value as "file" | "database")}
                className="space-y-4"
              >
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="file" id="template-file" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="template-file" className="font-medium cursor-pointer">
                      Uploader un fichier modèle
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      Fournissez un exemple de rapport dont l'IA suivra le style de rédaction
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="database" id="template-database" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="template-database" className="font-medium cursor-pointer">
                      Utiliser des rapports existants
                    </Label>
                    <p className="text-muted-foreground text-sm">
                      L'IA s'inspirera des rapports déjà stockés dans votre base de données
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Template File Upload */}
          {templateSource === "file" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Fichier modèle
                </CardTitle>
                <CardDescription>
                  Uploadez un exemple de rapport bien rédigé
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    templateFile ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="file"
                    onChange={handleTemplateFileChange}
                    className="hidden"
                    id="template-file-input"
                    accept=".pdf,.docx,.txt"
                  />
                  <label htmlFor="template-file-input" className="cursor-pointer">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    {templateFile ? (
                      <p className="text-foreground font-medium">{templateFile.name}</p>
                    ) : (
                      <>
                        <p className="text-foreground font-medium">Cliquez pour uploader</p>
                        <p className="text-muted-foreground text-sm mt-1">PDF, DOCX ou TXT</p>
                      </>
                    )}
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Database Reports Selection */}
          {templateSource === "database" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Sélectionner les rapports exemples
                </CardTitle>
                <CardDescription>
                  Choisissez les rapports dont l'IA doit s'inspirer pour la rédaction
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : completedReports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun rapport complété disponible</p>
                    <p className="text-sm mt-1">Uploadez d'abord des rapports pour les utiliser comme modèles</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {completedReports.map((report) => (
                      <div
                        key={report.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          selectedReports.includes(report.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => toggleReportSelection(report.id)}
                      >
                        <Checkbox
                          checked={selectedReports.includes(report.id)}
                          onCheckedChange={() => toggleReportSelection(report.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{report.title}</p>
                          <p className="text-muted-foreground text-sm">
                            {report.report_type} • {new Date(report.created_at).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedReports.length > 0 && (
                  <p className="text-sm text-primary mt-4">
                    {selectedReports.length} rapport(s) sélectionné(s)
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Report Details */}
          <Card>
            <CardHeader>
              <CardTitle>Détails du rapport</CardTitle>
              <CardDescription>
                Informations et instructions pour la génération
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report-title">Titre du rapport *</Label>
                <Input
                  id="report-title"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Ex: Rapport d'activité Q4 2024"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions supplémentaires (optionnel)</Label>
                <Textarea
                  id="instructions"
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  placeholder="Ex: Mettre l'accent sur les KPIs financiers, utiliser un ton formel..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className="w-full h-12 text-lg"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Générer le rapport
              </>
            )}
          </Button>

          {/* Validation hint */}
          {!canGenerate && !generatedResult && (
            <p className="text-center text-sm text-muted-foreground">
              {!hasValidTemplate && templateSource === "file" && "Veuillez uploader un fichier modèle"}
              {!hasValidTemplate && templateSource === "database" && "Veuillez sélectionner au moins un rapport exemple"}
              {hasValidTemplate && !reportTitle.trim() && "Veuillez entrer un titre pour le rapport"}
            </p>
          )}

          {/* Generated Result */}
          {generatedResult && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Rapport généré : {generatedResult.title}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Aperçu et export du rapport
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/report/${generatedResult.reportId}`)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Voir dans l'app
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Export buttons */}
                <ReportExportButtons title={generatedResult.title} content={generatedResult.content} />

                {/* Markdown preview with tabs */}
                <Tabs defaultValue="preview" className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="preview" className="flex-1">Aperçu</TabsTrigger>
                    <TabsTrigger value="source" className="flex-1">Source Markdown</TabsTrigger>
                  </TabsList>
                  <TabsContent value="preview" className="mt-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none max-h-[500px] overflow-y-auto rounded-lg border bg-card p-6">
                      <ReactMarkdown>{generatedResult.content}</ReactMarkdown>
                    </div>
                  </TabsContent>
                  <TabsContent value="source" className="mt-4">
                    <pre className="text-xs bg-muted rounded-lg p-4 max-h-[500px] overflow-y-auto whitespace-pre-wrap break-words font-mono">
                      {generatedResult.content}
                    </pre>
                  </TabsContent>
                </Tabs>

                {/* Source files */}
                {(dataFiles.length > 0 || templateFile || (templateSource === "database" && selectedReports.length > 0)) && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Fichiers sources</p>
                    <div className="space-y-2">
                      {templateFile && (
                        <div className="flex items-center justify-between p-2 rounded-lg border bg-card">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{templateFile.name} (modèle)</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => {
                            const url = URL.createObjectURL(templateFile);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = templateFile.name;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {dataFiles.map((df) => (
                        <div key={df.id} className="flex items-center justify-between p-2 rounded-lg border bg-card">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{df.file.name} (données)</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => {
                            const url = URL.createObjectURL(df.file);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = df.file.name;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {templateSource === "database" && completedReports.filter(r => selectedReports.includes(r.id)).map(r => (
                        <div key={r.id} className="flex items-center justify-between p-2 rounded-lg border bg-card">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{r.title}</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/report/${r.id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default GenerateFromTemplate;
