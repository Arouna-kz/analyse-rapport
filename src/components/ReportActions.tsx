import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Download, Loader2 } from 'lucide-react';
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

interface ReportActionsProps {
  reportId: string;
  reportTitle: string;
  filePath?: string | null;
  onDelete?: () => void;
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

export const ReportActions = ({
  reportId,
  reportTitle,
  filePath,
  onDelete,
  size = 'sm'
}: ReportActionsProps) => {
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Delete related data first
      await supabase.from('report_analyses').delete().eq('report_id', reportId);
      await supabase.from('report_alerts').delete().eq('report_id', reportId);
      await supabase.from('report_embeddings').delete().eq('report_id', reportId);
      await supabase.from('report_validations').delete().eq('report_id', reportId);
      await supabase.from('report_versions').delete().eq('report_id', reportId);
      
      // Delete the file from storage if exists
      if (filePath) {
        await supabase.storage.from('reports').remove([filePath]);
      }
      
      // Delete the report
      const { error } = await supabase.from('reports').delete().eq('id', reportId);
      
      if (error) throw error;
      
      toast({
        title: "Rapport supprimé",
        description: `"${reportTitle}" a été supprimé avec succès`,
      });
      
      onDelete?.();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le rapport",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!filePath) {
      toast({
        title: "Fichier non disponible",
        description: "Ce rapport n'a pas de fichier source associé",
        variant: "destructive",
      });
      return;
    }

    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('reports')
        .download(filePath);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('/').pop() || 'report';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Téléchargement réussi",
        description: "Le fichier a été téléchargé",
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de télécharger le fichier",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {filePath && (
        <Button
          variant="outline"
          size={size}
          onClick={handleDownload}
          disabled={downloading}
          title="Télécharger le fichier source"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {size !== 'icon' && <span className="ml-2 hidden sm:inline">Télécharger</span>}
        </Button>
      )}
      
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size={size}
            disabled={deleting}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            title="Supprimer le rapport"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {size !== 'icon' && <span className="ml-2 hidden sm:inline">Supprimer</span>}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce rapport ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le rapport "{reportTitle}" et toutes ses analyses associées seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
