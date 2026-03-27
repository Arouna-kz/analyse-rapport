import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Image, X, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FileAttachment {
  file: File;
  preview?: string;
  type: 'image' | 'document';
}

interface FileAttachmentInputProps {
  onFilesChange: (files: FileAttachment[]) => void;
  files: FileAttachment[];
  disabled?: boolean;
  maxFiles?: number;
  accept?: string;
}

export const FileAttachmentInput = ({
  onFilesChange,
  files,
  disabled = false,
  maxFiles = 5,
  accept = "image/*,.pdf,.docx,.xlsx,.xls,.txt"
}: FileAttachmentInputProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'all' | 'image') => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (files.length + selectedFiles.length > maxFiles) {
      toast({
        title: "Limite atteinte",
        description: `Vous ne pouvez ajouter que ${maxFiles} fichiers maximum`,
        variant: "destructive",
      });
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

    onFilesChange([...files, ...newAttachments]);
    
    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    const file = files[index];
    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const getFileIcon = (attachment: FileAttachment) => {
    if (attachment.type === 'image' && attachment.preview) {
      return (
        <img 
          src={attachment.preview} 
          alt={attachment.file.name}
          className="w-8 h-8 object-cover rounded"
        />
      );
    }
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-2">
      {/* File previews */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((attachment, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm"
            >
              {getFileIcon(attachment)}
              <span className="max-w-[120px] truncate">{attachment.file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => removeFile(index)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={(e) => handleFileSelect(e, 'all')}
          className="hidden"
          disabled={disabled}
        />
        <input
          ref={imageInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => handleFileSelect(e, 'image')}
          className="hidden"
          disabled={disabled}
        />
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || files.length >= maxFiles}
          className="gap-2"
        >
          <Paperclip className="h-4 w-4" />
          Fichier
        </Button>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => imageInputRef.current?.click()}
          disabled={disabled || files.length >= maxFiles}
          className="gap-2"
        >
          <Image className="h-4 w-4" />
          Image
        </Button>
      </div>
    </div>
  );
};
