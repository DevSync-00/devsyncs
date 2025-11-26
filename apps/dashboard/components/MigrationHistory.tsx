'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, CheckCircle, XCircle, Loader2, TestTube, Play } from 'lucide-react';
import { useRealtimeTable } from '@/hooks/use-realtime';

interface MigrationHistoryProps {
  migrationId: string;
}

interface HistoryEntry {
  id: string;
  execution_type: 'apply' | 'rollback' | 'dry-run';
  status: 'running' | 'success' | 'failed' | 'cancelled';
  sql_executed?: string;
  error_message?: string;
  execution_time_ms?: number;
  affected_rows?: number;
  started_at: string;
  completed_at?: string;
  executed_by?: {
    email?: string;
  };
}

export default function MigrationHistory({ migrationId }: MigrationHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('migration_history')
        .select(`
          *,
          executed_by:auth.users(email)
        `)
        .eq('migration_id', migrationId)
        .order('started_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setHistory((data as any[]) || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load migration history');
    } finally {
      setLoading(false);
    }
  }, [migrationId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useRealtimeTable({
    table: 'migration_history',
    filter: `migration_id=eq.${migrationId}`,
    enabled: Boolean(migrationId),
    onPayload: fetchHistory,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 rounded-md bg-red-500/10 text-red-500 text-sm">
        {error}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No execution history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Execution History</h3>
      <div className="space-y-3">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="border border-border rounded-lg p-4 bg-card"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {entry.status === 'running' ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                ) : entry.status === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : entry.status === 'failed' ? (
                  <XCircle className="w-5 h-5 text-red-500" />
                ) : (
                  <Clock className="w-5 h-5 text-muted-foreground" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {entry.execution_type === 'dry-run' ? (
                        <span className="flex items-center gap-1">
                          <TestTube className="w-4 h-4" />
                          Validation (Dry Run)
                        </span>
                      ) : entry.execution_type === 'apply' ? (
                        <span className="flex items-center gap-1">
                          <Play className="w-4 h-4" />
                          Apply Migration
                        </span>
                      ) : (
                        'Rollback'
                      )}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        entry.status === 'success'
                          ? 'bg-green-500/10 text-green-500'
                          : entry.status === 'failed'
                          ? 'bg-red-500/10 text-red-500'
                          : entry.status === 'running'
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(entry.started_at).toLocaleString()}
                    </span>
                    {entry.execution_time_ms && (
                      <span>{entry.execution_time_ms}ms</span>
                    )}
                    {entry.affected_rows !== undefined && entry.affected_rows !== null && (
                      <span>{entry.affected_rows} rows affected</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {entry.error_message && (
              <div className="mt-3 px-3 py-2 rounded-md bg-red-500/10 text-red-500 text-sm font-mono">
                {entry.error_message}
              </div>
            )}

            {entry.completed_at && entry.status === 'success' && (
              <div className="mt-2 text-xs text-muted-foreground">
                Completed: {new Date(entry.completed_at).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

