import { useState, ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Maximize2, X } from 'lucide-react';

interface ExpandableChartProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export const ExpandableChart = ({ title, children, className = '' }: ExpandableChartProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <div className={`relative group ${className}`}>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm hover:bg-background"
          onClick={() => setIsExpanded(true)}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        {children}
      </div>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              {title}
              <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full min-h-[70vh]">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
