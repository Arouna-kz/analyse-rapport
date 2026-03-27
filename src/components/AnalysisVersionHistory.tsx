import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { History, RotateCcw, Trash2, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cleanMarkdown } from '@/lib/textUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AnalysisVersion {
  id: string;
  summary: string | null;
  key_points: string[] | null;
  kpis: any | null;
  insights: string | null;
  created_at: string;
  arena_metadata: any | null;
  arena_score: number | null;
}

interface AnalysisVersionHistoryProps {
  reportId: string;
  currentAnalysisId?: string;
  onRestore: (analysis: AnalysisVersion) => void;
}

export const AnalysisVersionHistory = ({ reportId, currentAnalysisId, onRestore }: AnalysisVersionHistoryProps) => {
  const [versions, setVersions] = useState<AnalysisVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [reportId, isOpen]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('report_analyses')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error: any) {
      console.error('Error fetching analysis versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (versionId: string) => {
    try {
      const { error } = await supabase
        .from('report_analyses')
        .delete()
        .eq('id', versionId);

      if (error) throw error;

      setVersions(prev => prev.filter(v => v.id !== versionId));
      toast({ title: "Version supprimée" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleRestore = (version: AnalysisVersion) => {
    onRestore(version);
    toast({ title: "Version restaurée", description: "L'analyse affichée a été mise à jour" });
  };

  if (versions.length <= 1 && !loading && !isOpen) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5 text-blue-500" />
                Historique des analyses
                {versions.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{versions.length}</Badge>
                )}
              </CardTitle>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>
          <CardDescription>Consultez, restaurez ou supprimez les versions précédentes</CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Chargement...</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune version disponible</p>
            ) : (
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-3">
                  {versions.map((version, index) => {
                    const isCurrent = version.id === currentAnalysisId;
                    const isExpanded = expandedId === version.id;

                    return (
                      <div
                        key={version.id}
                        className={`border rounded-lg p-3 transition-colors ${
                          isCurrent ? 'border-blue-500/30 bg-blue-500/5' : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Badge variant={isCurrent ? "default" : "outline"} className="shrink-0 text-xs">
                              {isCurrent ? 'Actuelle' : `v${versions.length - index}`}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(version.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                            </span>
                            {version.arena_metadata && (
                              <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600 shrink-0">
                                Arena
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setExpandedId(isExpanded ? null : version.id)}
                              title="Aperçu"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {!isCurrent && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-blue-500 hover:text-blue-600"
                                  onClick={() => handleRestore(version)}
                                  title="Restaurer cette version"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      title="Supprimer cette version"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Supprimer cette version ?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Cette action est irréversible. La version de l'analyse sera définitivement supprimée.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(version.id)}>
                                        Supprimer
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t space-y-2">
                            {version.summary && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Résumé</p>
                                <p className="text-sm line-clamp-3">{cleanMarkdown(version.summary)}</p>
                              </div>
                            )}
                            {version.key_points && version.key_points.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Points clés ({version.key_points.length})</p>
                                <ul className="text-sm space-y-1">
                                  {version.key_points.slice(0, 3).map((point, i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                                      <span className="line-clamp-1">{cleanMarkdown(point)}</span>
                                    </li>
                                  ))}
                                  {version.key_points.length > 3 && (
                                    <li className="text-xs text-muted-foreground">+{version.key_points.length - 3} autres</li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
