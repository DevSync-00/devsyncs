'use client';

import { useEffect, useState } from 'react';
import { Clock, CheckCircle, AlertCircle, FileText, ArrowRight, RefreshCw, FileCode, Check } from 'lucide-react';
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  const copyMigrationSql = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <span className="text-xs text-muted-foreground">Loading migration history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
        <div className="font-semibold">Failed to load migration history</div>
        <div className="text-xs opacity-80 mt-1">{error}</div>
      </div>
    );
  }

  if (migrations.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border/60 rounded-xl bg-card/25">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-primary" />
        <p className="text-sm font-semibold">No migrations generated yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          Generate your first migration from a project scan report to build the timeline history.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" />
            Migration Timeline
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit log of generated SQL/Prisma migrations and live executions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMigrations} className="h-8 border-border/80">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      <div className="relative pl-6 sm:pl-8">
        {/* Timeline connecting vertical dashed line */}
        <div className="absolute left-6 sm:left-8 top-4 bottom-4 w-0.5 border-l border-dashed border-border/80 -translate-x-1/2 z-0" />

        <div className="space-y-8">
          {migrations.map((migration) => {
            const validation = migration.metadata?.validation;
            const hasIssues = validation && (validation.errorCount > 0 || validation.warningCount > 0);
            const isApplied = migration.applied;
            const date = new Date(migration.created_at);

            return (
              <div key={migration.id} className="relative flex flex-col sm:flex-row gap-6 items-start z-10">
                {/* Timeline status indicator node */}
                <div className="absolute -left-6 sm:-left-8 top-1.5 -translate-x-1/2 flex items-center justify-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center border-4 border-background shadow-md transition-transform hover:scale-110 ${
                      isApplied
                        ? 'bg-green-500 text-white'
                        : hasIssues
                        ? 'bg-yellow-500 text-white'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {isApplied ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : hasIssues ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Main Migration Card */}
                <Card className="w-full p-5 glass-strong border-border/60 shadow-elevated">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-sm sm:text-base font-bold font-mono tracking-tight text-foreground">{migration.filename || 'unnamed_migration'}</h3>
                        <span
                          className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold border ${
                            isApplied
                              ? 'bg-green-500/10 text-green-500 border-green-500/25'
                              : hasIssues
                              ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/25'
                              : 'bg-primary/10 text-primary border-primary/25'
                          }`}
                        >
                          {isApplied ? 'Applied' : hasIssues ? 'Issues Flagged' : 'Pending Review'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>•</span>
                        <span>Format: {migration.format.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Badges from Validation results */}
                  {validation && (
                    <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-muted/40 border border-border/30 rounded-xl">
                      <div className="text-center sm:text-left">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Errors</div>
                        <div
                          className={`text-base font-bold ${
                            validation.errorCount > 0 ? 'text-red-500' : 'text-muted-foreground'
                          }`}
                        >
                          {validation.errorCount}
                        </div>
                      </div>
                      <div className="text-center sm:text-left">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Warnings</div>
                        <div
                          className={`text-base font-bold ${
                            validation.warningCount > 0 ? 'text-yellow-500' : 'text-muted-foreground'
                          }`}
                        >
                          {validation.warningCount}
                        </div>
                      </div>
                      <div className="text-center sm:text-left">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Breaking</div>
                        <div
                          className={`text-base font-bold ${
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

                  {/* Code action controls */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-semibold"
                      onClick={() => copyMigrationSql(migration.content, migration.id)}
                    >
                      {copiedId === migration.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <FileText className="w-3.5 h-3.5 mr-1.5" />
                          Copy SQL
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-semibold"
                      onClick={() => {
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
                      Download
                    </Button>
                    {!isApplied && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 text-xs font-semibold ml-auto"
                        onClick={() => {
                          window.location.href = `/dashboard/projects/${projectId}/migrations/${migration.id}`;
                        }}
                      >
                        Execute
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
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
