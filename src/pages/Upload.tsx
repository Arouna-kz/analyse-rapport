import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload as UploadIcon, Loader2, ArrowLeft, Cpu } from 'lucide-react';
import { useArenaConfig } from '@/hooks/useArenaConfig';

const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [reportType, setReportType] = useState<'past' | 'current' | 'future'>('current');
  const [uploading, setUploading] = useState(false);
  const [useArena, setUseArena] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getEnabledModels } = useArenaConfig();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'application/pdf', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
        'text/plain',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel' // .xls
      ];
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
      const isExcel = fileExt === 'xlsx' || fileExt === 'xls';
      
      if (!validTypes.includes(selectedFile.type) && !isExcel) {
        toast({
          title: "Format invalide",
          description: "Seuls les fichiers PDF, DOCX, TXT et Excel (XLSX, XLS) sont acceptés",
          variant: "destructive",
        });
        return;
      }
      
      if (selectedFile.size > 20 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: "La taille maximale est de 20 Mo",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.split('.')[0]);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !title) {
      toast({
        title: "Informations manquantes",
        description: "Veuillez sélectionner un fichier et saisir un titre",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('reports')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('reports')
        .insert({
          user_id: user.id,
          title,
          file_path: filePath,
          file_type: file.type,
          report_type: reportType,
          status: 'pending',
        });

      if (dbError) throw dbError;

      // Get the inserted report ID
      const { data: insertedReport } = await supabase
        .from('reports')
        .select('id')
        .eq('user_id', user.id)
        .eq('title', title)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      toast({
        title: "Rapport téléchargé !",
        description: "L'analyse commencera sous peu",
      });

      // Trigger analysis with Arena config
      if (insertedReport) {
        const enabledModels = getEnabledModels();
        supabase.functions
          .invoke('analyze-report', {
            body: { 
              reportId: insertedReport.id,
              useArena,
              models: useArena ? enabledModels.map(m => ({ id: m.id, name: m.name, baseUrl: m.baseUrl, isLovableAI: m.isLovableAI })) : undefined
            }
          })
          .then(({ error: analysisError }) => {
            if (analysisError) {
              console.error('Analysis error:', analysisError);
            }
          });
      }

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: "Erreur d'upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au tableau de bord
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-display font-bold mb-2">Nouveau rapport</h1>
            <p className="text-muted-foreground">
              Téléchargez un document pour l'analyser avec l'IA
            </p>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Informations du rapport</CardTitle>
              <CardDescription className="space-y-1">
                <span>Formats acceptés : PDF, DOCX, TXT, Excel (XLSX, XLS)</span>
                <span className="block text-xs">Taille maximale : 20 Mo</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Titre du rapport</Label>
                <Input
                  id="title"
                  placeholder="Ex: Rapport mensuel Q4 2024"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={uploading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type de rapport</Label>
                <Select
                  value={reportType}
                  onValueChange={(value: any) => setReportType(value)}
                  disabled={uploading}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="past">Rapport passé (analyse historique)</SelectItem>
                    <SelectItem value="current">Rapport actuel (analyse en cours)</SelectItem>
                    <SelectItem value="future">Rapport futur (prévisions)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Arena Mode Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Cpu className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <Label htmlFor="arena-mode" className="text-sm font-medium cursor-pointer">
                      Mode Arena (Multi-modèles)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {useArena ? `${getEnabledModels().length} modèles IA pour une analyse par consensus` : 'Analyse standard avec un seul modèle'}
                    </p>
                  </div>
                </div>
                <Switch
                  id="arena-mode"
                  checked={useArena}
                  onCheckedChange={setUseArena}
                  disabled={uploading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Fichier</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-accent transition-base cursor-pointer">
                  <input
                    id="file"
                    type="file"
                    accept=".pdf,.docx,.txt,.xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="hidden"
                  />
                  <label htmlFor="file" className="cursor-pointer">
                    {file ? (
                      <div className="space-y-2">
                        <FileText className="h-12 w-12 mx-auto text-accent" />
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} Mo
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <UploadIcon className="h-12 w-12 mx-auto text-muted-foreground" />
                        <p className="font-medium">Cliquez pour sélectionner un fichier</p>
                        <p className="text-sm text-muted-foreground">
                          ou glissez-déposez ici
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <Button
                onClick={handleUpload}
                disabled={!file || !title || uploading}
                className="w-full"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Téléchargement en cours...
                  </>
                ) : (
                  <>
                    <UploadIcon className="mr-2 h-5 w-5" />
                    Télécharger et analyser
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Upload;