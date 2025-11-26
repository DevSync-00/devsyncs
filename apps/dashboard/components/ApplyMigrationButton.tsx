'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2, CheckCircle, AlertCircle, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { robustFetchJSON, getErrorMessage } from '@/lib/fetch';

interface ApplyMigrationButtonProps {
  migrationId: string;
  applied: boolean;
  executionStatus?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function ApplyMigrationButton({
  migrationId,
  applied,
  executionStatus,
  onSuccess,
  onError,
}: ApplyMigrationButtonProps) {
  const [loading, setLoading] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    dryRun?: boolean;
  } | null>(null);
  const { toast } = useToast();

  const handleExecute = async (dryRun: boolean = false) => {
    const setLoadingState = dryRun ? setDryRunLoading : setLoading;
    setLoadingState(true);
    setLastResult(null);

    try {
      const data = await robustFetchJSON<{
        success: boolean;
        message?: string;
        error?: string;
      }>(`/api/migrations/${migrationId}/execute`, {
        method: 'POST',
        body: JSON.stringify({
          dryRun,
          confirm: !dryRun, // Require confirmation for actual execution
        }),
        timeout: 120000, // 2 minutes for migration execution
      });

      const resultPayload = {
        success: data.success,
        message: data.message || (dryRun ? 'Validation successful' : 'Migration applied successfully'),
        dryRun,
      };
      setLastResult(resultPayload);

      toast({
        title: dryRun ? 'Dry run successful' : 'Migration applied',
        description: resultPayload.message,
        variant: dryRun ? 'default' : 'default',
      });

      if (data.success && onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      
      // Log error for debugging
      console.error('Migration execution error:', {
        error,
        migrationId,
        dryRun,
      });
      
      setLastResult({
        success: false,
        message: errorMessage,
        dryRun,
      });

      if (onError) {
        onError(errorMessage);
      }
      toast({
        title: dryRun ? 'Dry run failed' : 'Migration failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoadingState(false);
    }
  };

  if (applied) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-500">
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Applied</span>
      </div>
    );
  }

  if (executionStatus === 'running') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm font-medium">Running...</span>
      </div>
    );
  }

  if (executionStatus === 'failed') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Failed</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExecute(true)}
          disabled={dryRunLoading || loading}
          className="flex items-center gap-2"
        >
          {dryRunLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <TestTube className="w-4 h-4" />
              Validate (Dry Run)
            </>
          )}
        </Button>
        <Button
          onClick={() => {
            if (confirm('Are you sure you want to apply this migration? This action cannot be undone.')) {
              handleExecute(false);
            }
          }}
          size="sm"
          disabled={loading || dryRunLoading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Apply Migration
            </>
          )}
        </Button>
      </div>
      {lastResult && (
        <div
          className={`px-3 py-2 rounded-md text-sm ${
            lastResult.success
              ? 'bg-green-500/10 text-green-500'
              : 'bg-red-500/10 text-red-500'
          }`}
        >
          {lastResult.dryRun && (
            <span className="font-medium">Dry Run: </span>
          )}
          {lastResult.message}
        </div>
      )}
    </div>
  );
}

