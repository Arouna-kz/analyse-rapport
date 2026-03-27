import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MessageSquare, RefreshCw, Paperclip, Image, X, FileText } from 'lucide-react';

interface FileAttachment {
  file: File;
  preview?: string;
  type: 'image' | 'document';
}

interface AnalysisRefinementProps {
  reportId: string;
  onRefine: (feedback: string, files?: File[]) => Promise<void>;
  isRefining: boolean;
  title?: string;
  description?: string;
  placeholder?: string;
  buttonLabel?: string;
}

export const AnalysisRefinement = ({
  reportId,
  onRefine,
  isRefining,
  title = "Améliorer l'analyse",
  description = "Indiquez ce que vous souhaitez voir dans l'analyse",
  placeholder = "Ex: Je voudrais plus de détails sur les KPIs financiers, une comparaison avec les périodes précédentes...",
  buttonLabel = "Relancer l'analyse"
}: AnalysisRefinementProps) => {
  const [feedback, setFeedback] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'all' | 'image') => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (attachments.length + selectedFiles.length > 5) {
      return;
    }

    const newAttachments: FileAttachment[] = selectedFiles.map(file => {
      const isImage = file.type.startsWith('image/');
      return {
        file,
        preview: isImage ? URL.createObjectURL(file) : undefined,
        type: isImage ? 'image' : 'document'
      };
    });

    setAttachments([...attachments, ...newAttachments]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    const file = attachments[index];
    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!feedback.trim()) return;
    const files = attachments.map(a => a.file);
    await onRefine(feedback, files.length > 0 ? files : undefined);
    setFeedback('');
    attachments.forEach(a => a.preview && URL.revokeObjectURL(a.preview));
    setAttachments([]);
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={placeholder}
          rows={3}
          disabled={isRefining}
        />
        
        {/* File previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm"
              >
                {attachment.type === 'image' && attachment.preview ? (
                  <img 
                    src={attachment.preview} 
                    alt={attachment.file.name}
                    className="w-8 h-8 object-cover rounded"
                  />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="max-w-[120px] truncate">{attachment.file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => removeFile(index)}
                  disabled={isRefining}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            id={`file-input-${reportId}`}
            multiple
            accept=".pdf,.docx,.xlsx,.xls,.txt"
            onChange={(e) => handleFileSelect(e, 'all')}
            className="hidden"
            disabled={isRefining}
          />
          <input
            type="file"
            id={`image-input-${reportId}`}
            multiple
            accept="image/*"
            onChange={(e) => handleFileSelect(e, 'image')}
            className="hidden"
            disabled={isRefining}
          />
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById(`file-input-${reportId}`)?.click()}
            disabled={isRefining || attachments.length >= 5}
          >
            <Paperclip className="h-4 w-4 mr-1" />
            Fichier
          </Button>
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById(`image-input-${reportId}`)?.click()}
            disabled={isRefining || attachments.length >= 5}
          >
            <Image className="h-4 w-4 mr-1" />
            Image
          </Button>

          <div className="flex-1" />

          <Button
            onClick={handleSubmit}
            disabled={isRefining || !feedback.trim()}
            className="sm:w-auto"
          >
            {isRefining ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {buttonLabel}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
