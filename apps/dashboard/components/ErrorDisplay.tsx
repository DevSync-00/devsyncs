import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ErrorDisplayProps {
  error: string | Error | null;
  onDismiss?: () => void;
  title?: string;
  className?: string;
}

export default function ErrorDisplay({ 
  error, 
  onDismiss, 
  title = 'Error',
  className = '' 
}: ErrorDisplayProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!error || dismissed) {
    return null;
  }

  const errorMessage = error instanceof Error ? error.message : error;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className={`p-4 bg-destructive/10 border border-destructive/20 rounded-lg ${className}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-destructive mb-1">{title}</h3>
          <p className="text-sm text-destructive/90">{errorMessage}</p>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

