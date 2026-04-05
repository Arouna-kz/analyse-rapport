import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, File, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

interface ReportExportButtonsProps {
  title: string;
  content: string;
  size?: 'sm' | 'default';
}

export const ReportExportButtons = ({ title, content, size = 'sm' }: ReportExportButtonsProps) => {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const { toast } = useToast();

  const sanitizedTitle = title.replace(/[^a-z0-9àâéèêëïîôùûüÿçœæ\s]/gi, '_').trim();

  const handleDownloadMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizedTitle}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    setExportingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let yPos = margin;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      const titleLines = doc.splitTextToSize(title, contentWidth);
      doc.text(titleLines, margin, yPos);
      yPos += titleLines.length * 8 + 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, margin, yPos);
      yPos += 10;
      doc.setTextColor(0, 0, 0);

      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;

      const lines = content.split('\n');
      for (const line of lines) {
        if (yPos > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }

        const trimmed = line.trim();
        if (!trimmed) {
          yPos += 4;
          continue;
        }

        if (trimmed.startsWith('# ')) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          const wrapped = doc.splitTextToSize(trimmed.replace(/^# /, ''), contentWidth);
          doc.text(wrapped, margin, yPos);
          yPos += wrapped.length * 7 + 4;
        } else if (trimmed.startsWith('## ')) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          const wrapped = doc.splitTextToSize(trimmed.replace(/^## /, ''), contentWidth);
          doc.text(wrapped, margin, yPos);
          yPos += wrapped.length * 6 + 3;
        } else if (trimmed.startsWith('### ')) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          const wrapped = doc.splitTextToSize(trimmed.replace(/^### /, ''), contentWidth);
          doc.text(wrapped, margin, yPos);
          yPos += wrapped.length * 5.5 + 3;
        } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          const text = trimmed.replace(/^[-*]\s/, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
          const wrapped = doc.splitTextToSize(`• ${text}`, contentWidth - 5);
          doc.text(wrapped, margin + 5, yPos);
          yPos += wrapped.length * 5 + 2;
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          const cleanText = trimmed.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
          const wrapped = doc.splitTextToSize(cleanText, contentWidth);
          doc.text(wrapped, margin, yPos);
          yPos += wrapped.length * 5 + 2;
        }
      }

      doc.save(`${sanitizedTitle}.pdf`);
      toast({ title: "PDF exporté", description: "Le rapport a été téléchargé en PDF" });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({ title: "Erreur", description: "Impossible d'exporter en PDF", variant: "destructive" });
    } finally {
      setExportingPdf(false);
    }
  };

  const parseMarkdownToDocxParagraphs = (text: string): Paragraph[] => {
    const paragraphs: Paragraph[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        paragraphs.push(new Paragraph({ children: [] }));
        continue;
      }

      if (trimmed.startsWith('### ')) {
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: parseInlineFormatting(trimmed.slice(4)),
        }));
      } else if (trimmed.startsWith('## ')) {
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: parseInlineFormatting(trimmed.slice(3)),
        }));
      } else if (trimmed.startsWith('# ')) {
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: parseInlineFormatting(trimmed.slice(2)),
        }));
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        paragraphs.push(new Paragraph({
          children: [
            new TextRun({ text: '• ', font: 'Calibri' }),
            ...parseInlineFormatting(trimmed.slice(2)),
          ],
          indent: { left: 720 },
          spacing: { after: 80 },
        }));
      } else {
        paragraphs.push(new Paragraph({
          children: parseInlineFormatting(trimmed),
          spacing: { after: 120 },
        }));
      }
    }

    return paragraphs;
  };

  const parseInlineFormatting = (text: string): TextRun[] => {
    const runs: TextRun[] = [];
    const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        runs.push(new TextRun({ text: text.slice(lastIndex, match.index), font: 'Calibri', size: 22 }));
      }
      if (match[1]) {
        runs.push(new TextRun({ text: match[1], bold: true, font: 'Calibri', size: 22 }));
      } else if (match[2]) {
        runs.push(new TextRun({ text: match[2], italics: true, font: 'Calibri', size: 22 }));
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      runs.push(new TextRun({ text: text.slice(lastIndex), font: 'Calibri', size: 22 }));
    }

    if (runs.length === 0) {
      runs.push(new TextRun({ text, font: 'Calibri', size: 22 }));
    }

    return runs;
  };

  const handleDownloadDocx = async () => {
    setExportingDocx(true);
    try {
      const contentParagraphs = parseMarkdownToDocxParagraphs(content);

      const doc = new Document({
        styles: {
          default: {
            document: {
              run: { font: 'Calibri', size: 22 },
            },
          },
          paragraphStyles: [
            {
              id: 'Heading1',
              name: 'Heading 1',
              basedOn: 'Normal',
              next: 'Normal',
              quickFormat: true,
              run: { size: 36, bold: true, font: 'Calibri', color: '1a1a2e' },
              paragraph: { spacing: { before: 240, after: 120 } },
            },
            {
              id: 'Heading2',
              name: 'Heading 2',
              basedOn: 'Normal',
              next: 'Normal',
              quickFormat: true,
              run: { size: 30, bold: true, font: 'Calibri', color: '374151' },
              paragraph: { spacing: { before: 200, after: 100 } },
            },
            {
              id: 'Heading3',
              name: 'Heading 3',
              basedOn: 'Normal',
              next: 'Normal',
              quickFormat: true,
              run: { size: 26, bold: true, font: 'Calibri', color: '4b5563' },
              paragraph: { spacing: { before: 160, after: 80 } },
            },
          ],
        },
        sections: [{
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: title, bold: true, font: 'Calibri', size: 40 })],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `Généré le ${new Date().toLocaleDateString('fr-FR')}`, font: 'Calibri', size: 20, color: '6b7280' })],
              spacing: { after: 300 },
            }),
            ...contentParagraphs,
          ],
        }],
      });

      const buffer = await Packer.toBlob(doc);
      saveAs(buffer, `${sanitizedTitle}.docx`);
      toast({ title: "DOCX exporté", description: "Le rapport a été téléchargé en format Word natif" });
    } catch (error) {
      console.error('DOCX export error:', error);
      toast({ title: "Erreur", description: "Impossible d'exporter en DOCX", variant: "destructive" });
    } finally {
      setExportingDocx(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button size={size} variant="outline" onClick={handleDownloadMarkdown}>
        <FileText className="h-4 w-4 mr-2" />
        Markdown
      </Button>
      <Button size={size} variant="outline" onClick={handleDownloadPdf} disabled={exportingPdf}>
        {exportingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <File className="h-4 w-4 mr-2" />}
        PDF
      </Button>
      <Button size={size} variant="outline" onClick={handleDownloadDocx} disabled={exportingDocx}>
        {exportingDocx ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
        DOCX
      </Button>
    </div>
  );
};
