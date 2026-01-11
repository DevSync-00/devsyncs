'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, CheckCircle, XCircle, AlertCircle, FileText, ArrowRight } from 'lucide-react';
import { formatErrorMessage } from '@/lib/error-utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface MigrationTimelineProps {
  projectId: string;
}

interface Migration {
  id: string;
  filename: string;
  content: string;
  format: string;
  applied: boolean;
  created_at: string;
  scan_reports?: {
    project_id: string;
    projects?: {
      id: string;
      name: string;
    };
  };
  metadata?: {
    validation?: {
      valid: boolean;
      errorCount: number;
      warningCount: number;
      breakingChangeCount: number;
    };
  };
}

export default function MigrationTimeline({ projectId }: MigrationTimelineProps) {
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMigrations();
  }, [projectId]);

  const fetchMigrations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/migrations?projectId=${projectId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch migrations');
      }

      const data = await response.json();
      setMigrations(data.migrations || []);
      setError(null);
    } catch (err: any) {
      const formatted = formatErrorMessage(err, {
        operation: 'load',
        resource: 'migration history',
      });
      setError(formatted.message);
      toast({
        title: formatted.title,
        description: formatted.actionable || formatted.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
        <div className="font-medium">Failed to load migration history</div>
        <div className="text-destructive/80 text-xs mt-1">{error}</div>
      </div>
    );
  }

  if (migrations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No migrations yet</p>
        <p className="text-sm mt-2">Generate a migration from a scan report to see it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Migration Timeline</h2>
        <Button variant="outline" size="sm" onClick={fetchMigrations}>
          Refresh
        </Button>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>

        <div className="space-y-6">
          {migrations.map((migration, index) => {
            const validation = migration.metadata?.validation;
            const hasIssues = validation && (validation.errorCount > 0 || validation.warningCount > 0);
            const isApplied = migration.applied;
            const date = new Date(migration.created_at);

            return (
              <div key={migration.id} className="relative flex gap-4">
                {/* Timeline dot */}
                <div className="relative z-10 flex-shrink-0">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center border-4 border-background ${
                      isApplied
                        ? 'bg-green-500'
                        : hasIssues
                        ? 'bg-yellow-500'
                        : 'bg-blue-500'
                    }`}
                  >
                    {isApplied ? (
                      <CheckCircle className="w-8 h-8 text-white" />
                    ) : hasIssues ? (
                      <AlertCircle className="w-8 h-8 text-white" />
                    ) : (
                      <FileText className="w-8 h-8 text-white" />
                    )}
                  </div>
                </div>

                {/* Migration card */}
                <Card className="flex-1 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{migration.filename}</h3>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            isApplied
                              ? 'bg-green-500/10 text-green-500'
                              : hasIssues
                              ? 'bg-yellow-500/10 text-yellow-500'
                              : 'bg-blue-500/10 text-blue-500'
                          }`}
                        >
                          {isApplied ? 'Applied' : hasIssues ? 'Has Issues' : 'Pending'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {date.toLocaleDateString()} {date.toLocaleTimeString()}
                        </span>
                        <span>Format: {migration.format.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  {validation && (
                    <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-muted/50 rounded-md">
                      <div>
                        <div className="text-xs text-muted-foreground">Errors</div>
                        <div
                          className={`text-lg font-semibold ${
                            validation.errorCount > 0 ? 'text-red-500' : 'text-muted-foreground'
                          }`}
                        >
                          {validation.errorCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Warnings</div>
                        <div
                          className={`text-lg font-semibold ${
                            validation.warningCount > 0 ? 'text-yellow-500' : 'text-muted-foreground'
                          }`}
                        >
                          {validation.warningCount}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Breaking</div>
                        <div
                          className={`text-lg font-semibold ${
                            validation.breakingChangeCount > 0
                              ? 'text-orange-500'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {validation.breakingChangeCount}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Download migration SQL file directly
                        const blob = new Blob([migration.content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${migration.filename || 'migration'}.sql`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View SQL
                    </Button>
                    {!isApplied && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Navigate to migration execution page
                          window.location.href = `/dashboard/projects/${projectId}/migrations/${migration.id}`;
                        }}
                      >
                        Execute
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

