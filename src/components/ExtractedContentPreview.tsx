import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Eye, Loader2, FileText, Maximize2 } from 'lucide-react';

interface ExtractedContentPreviewProps {
  reportId: string;
  filePath: string | null;
  fileType: string | null;
}

export const ExtractedContentPreview = ({ reportId, filePath, fileType }: ExtractedContentPreviewProps) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const { toast } = useToast();

  const handlePreview = async () => {
    if (content) {
      setShowDialog(true);
      return;
    }

    setLoading(true);
    try {
      // Call a preview function that extracts content without full analysis
      const { data, error } = await supabase.functions.invoke('preview-extracted-content', {
        body: { reportId }
      });

      if (error) throw error;
      
      setContent(data.extractedText || 'Aucun contenu textuel extrait.');
      setShowDialog(true);
    } catch (error: any) {
      console.error('Preview error:', error);
      toast({
        title: "Erreur de prévisualisation",
        description: error.message || "Impossible de prévisualiser le contenu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handlePreview}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Eye className="h-4 w-4 mr-2" />
          )}
          Prévisualiser le contenu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Contenu extrait du fichier
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
          <pre className="whitespace-pre-wrap text-sm font-mono text-foreground">
            {content || 'Chargement...'}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
