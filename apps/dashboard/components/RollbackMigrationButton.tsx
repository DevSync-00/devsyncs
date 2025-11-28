'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { robustFetchJSON, getErrorMessage } from '@/lib/fetch';

interface RollbackMigrationButtonProps {
  migrationId: string;
  applied: boolean;
  executionStatus?: string;
  onSuccess?: () => void;
}

export default function RollbackMigrationButton({
  migrationId,
  applied,
  executionStatus,
  onSuccess,
}: RollbackMigrationButtonProps) {
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const handleRollback = async () => {
    if (!confirmOpen) {
      setConfirmOpen(true);
      return;
    }

    setLoading(true);
    try {
      await robustFetchJSON(`/api/migrations/${migrationId}/rollback`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
        timeout: 120000, // 2 minutes for rollback
      });

      setConfirmOpen(false);
      toast({
        title: 'Rollback scheduled',
        description: 'Migration rollback has been queued.',
      });
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Rollback failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      setConfirmOpen(false);
    } finally {
      setLoading(false);
    }
  };

  // Only show button if migration is applied and not currently running
  if (!applied || executionStatus === 'running') {
    if (executionStatus === 'running') {
      return (
        <Button variant="outline" disabled>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Running...
        </Button>
      );
    }
    return null;
  }

  if (!confirmOpen) {
    return (
      <Button
        variant="outline"
        onClick={handleRollback}
        disabled={loading}
        className="text-orange-600 hover:text-orange-700 border-orange-600 hover:border-orange-700"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Rollback
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
      <AlertTriangle className="w-4 h-4 text-orange-600" />
      <span className="text-sm text-orange-600 font-medium">
        Are you sure? This will undo the migration.
      </span>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleRollback}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Rolling back...
          </>
        ) : (
          <>
            <RotateCcw className="w-4 h-4 mr-2" />
            Confirm Rollback
          </>
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirmOpen(false)}
        disabled={loading}
      >
        Cancel
      </Button>
    </div>
  );
}

