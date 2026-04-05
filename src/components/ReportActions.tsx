import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Download, Loader2, Pencil, Check, X } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
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
  onRename?: (newTitle: string) => void;
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

export const ReportActions = ({
  reportId,
  reportTitle,
  filePath,
  onDelete,
  onRename,
  size = 'sm'
}: ReportActionsProps) => {
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(reportTitle);
  const { toast } = useToast();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase.from('report_analyses').delete().eq('report_id', reportId);
      await supabase.from('report_alerts').delete().eq('report_id', reportId);
      await supabase.from('report_embeddings').delete().eq('report_id', reportId);
      await supabase.from('report_validations').delete().eq('report_id', reportId);
      await supabase.from('report_versions').delete().eq('report_id', reportId);
      
      if (filePath) {
        await supabase.storage.from('reports').remove([filePath]);
      }
      
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

  const convertMarkdownToDocx = async (mdContent: string, fileName: string) => {
    const lines = mdContent.split('\n');
    const paragraphs: Paragraph[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        paragraphs.push(new Paragraph({ children: [] }));
        continue;
      }
      if (trimmed.startsWith('### ')) {
        paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: trimmed.slice(4), bold: true, font: 'Calibri', size: 26 })] }));
      } else if (trimmed.startsWith('## ')) {
        paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: trimmed.slice(3), bold: true, font: 'Calibri', size: 30 })] }));
      } else if (trimmed.startsWith('# ')) {
        paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: trimmed.slice(2), bold: true, font: 'Calibri', size: 36 })] }));
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const text = trimmed.slice(2).replace(/\*\*([^*]+)\*\*/g, '$1');
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: `• ${text}`, font: 'Calibri', size: 22 })], indent: { left: 720 } }));
      } else {
        const cleanText = trimmed.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: cleanText, font: 'Calibri', size: 22 })], spacing: { after: 120 } }));
      }
    }

    const doc = new Document({
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: paragraphs }],
    });

    const buffer = await Packer.toBlob(doc);
    saveAs(buffer, fileName.replace(/\.md$/, '.docx'));
  };

  const handleDownload = async () => {
    if (!filePath) {
      toast({ title: "Fichier non disponible", description: "Ce rapport n'a pas de fichier source associé", variant: "destructive" });
      return;
    }

    setDownloading(true);
    try {
      const { data, error } = await supabase.storage.from('reports').download(filePath);
      if (error) throw error;

      const originalName = filePath.split('/').pop() || 'report';

      if (originalName.endsWith('.md')) {
        const textContent = await data.text();
        await convertMarkdownToDocx(textContent, originalName);
      } else {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({ title: "Téléchargement réussi", description: "Le fichier a été téléchargé" });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({ title: "Erreur", description: error.message || "Impossible de télécharger le fichier", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleRename = async () => {
    if (!newTitle.trim() || newTitle === reportTitle) {
      setRenaming(false);
      setNewTitle(reportTitle);
      return;
    }

    try {
      const { error } = await supabase
        .from('reports')
        .update({ title: newTitle.trim() })
        .eq('id', reportId);

      if (error) throw error;

      toast({
        title: "Rapport renommé",
        description: `Le rapport a été renommé en "${newTitle.trim()}"`,
      });

      onRename?.(newTitle.trim());
      setRenaming(false);
    } catch (error: any) {
      console.error('Rename error:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de renommer le rapport",
        variant: "destructive",
      });
    }
  };

  if (renaming) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="h-7 text-sm w-48"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRename();
            if (e.key === 'Escape') { setRenaming(false); setNewTitle(reportTitle); }
          }}
        />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRename}>
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setRenaming(false); setNewTitle(reportTitle); }}>
          <X className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={(e) => { e.stopPropagation(); setRenaming(true); }}
        title="Renommer"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      {filePath && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          disabled={downloading}
          title="Télécharger"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={deleting}
            title="Supprimer"
            onClick={(e) => e.stopPropagation()}
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
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
