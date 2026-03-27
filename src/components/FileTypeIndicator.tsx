import { FileText, FileSpreadsheet, File, FileImage, FileArchive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FileTypeIndicatorProps {
  fileType?: string | null;
  filePath?: string | null;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const getFileTypeInfo = (fileType?: string | null, filePath?: string | null) => {
  const extension = filePath?.split('.').pop()?.toLowerCase();
  
  // Check by extension first (more reliable)
  if (extension === 'xlsx' || extension === 'xls') {
    return { icon: FileSpreadsheet, label: 'Excel', color: 'bg-green-500/10 text-green-600 border-green-500/20' };
  }
  if (extension === 'pdf') {
    return { icon: File, label: 'PDF', color: 'bg-red-500/10 text-red-600 border-red-500/20' };
  }
  if (extension === 'docx' || extension === 'doc') {
    return { icon: FileText, label: 'Word', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
  }
  if (extension === 'txt') {
    return { icon: FileText, label: 'Texte', color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' };
  }
  
  // Fallback to MIME type
  if (fileType?.includes('spreadsheet') || fileType?.includes('excel')) {
    return { icon: FileSpreadsheet, label: 'Excel', color: 'bg-green-500/10 text-green-600 border-green-500/20' };
  }
  if (fileType?.includes('pdf')) {
    return { icon: File, label: 'PDF', color: 'bg-red-500/10 text-red-600 border-red-500/20' };
  }
  if (fileType?.includes('word') || fileType?.includes('document')) {
    return { icon: FileText, label: 'Word', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
  }
  if (fileType?.includes('text/plain')) {
    return { icon: FileText, label: 'Texte', color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' };
  }
  if (fileType?.includes('image')) {
    return { icon: FileImage, label: 'Image', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' };
  }
  
  return { icon: FileArchive, label: 'Fichier', color: 'bg-muted text-muted-foreground border-border' };
};

const sizeClasses = {
  sm: { icon: 'h-4 w-4', badge: 'text-xs px-2 py-0.5' },
  md: { icon: 'h-5 w-5', badge: 'text-sm px-2.5 py-1' },
  lg: { icon: 'h-6 w-6', badge: 'text-base px-3 py-1.5' },
};

export const FileTypeIndicator = ({ fileType, filePath, showLabel = true, size = 'md' }: FileTypeIndicatorProps) => {
  const { icon: Icon, label, color } = getFileTypeInfo(fileType, filePath);
  const sizes = sizeClasses[size];
  
  return (
    <Badge variant="outline" className={`${color} ${sizes.badge} gap-1.5 font-medium`}>
      <Icon className={sizes.icon} />
      {showLabel && <span>{label}</span>}
    </Badge>
  );
};
