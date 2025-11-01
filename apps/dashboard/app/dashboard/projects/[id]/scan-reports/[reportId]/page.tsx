import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { AlertTriangle, CheckCircle, Clock, ArrowLeft, FileCode } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import MigrationPreview from '@/components/MigrationPreview';
import GenerateMigrationButton from '@/components/GenerateMigrationButton';
import AIExplanation from '@/components/AIExplanation';
import AIQuery from '@/components/AIQuery';
import MigrationHistory from '@/components/MigrationHistory';

export default async function ScanReportDetailPage({
  params,
}: {
  params: { id: string; reportId: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch scan report
  const { data: report, error } = await supabase
    .from('scan_reports')
    .select('*, projects(id, name, user_id)')
    .eq('id', params.reportId)
    .eq('project_id', params.id)
    .single();

  if (error || !report) {
    notFound();
  }

  const project = report.projects as any;

  // Check access
  if (project.user_id !== user.id) {
    redirect('/dashboard');
  }

  const mismatches = (report.mismatches as any[]) || [];
  const mismatchCount = mismatches.length;
  const isComplete = report.status === 'completed';
  const hasMismatches = mismatchCount > 0;

  // Fetch existing migrations for this scan report
  const { data: migrations } = await supabase
    .from('migrations')
    .select('*, execution_status, execution_started_at, execution_completed_at')
    .eq('scan_report_id', params.reportId)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/dashboard/projects/${params.id}`}>
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Project
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Scan Report</h1>
          <p className="text-muted-foreground mt-2">
            {new Date(report.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isComplete ? (
            hasMismatches ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 text-yellow-500">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">{mismatchCount} Mismatch{mismatchCount !== 1 ? 'es' : ''}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 text-green-500">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">In Sync</span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-500/10 text-gray-500">
              <Clock className="w-5 h-5" />
              <span className="font-semibold">{report.status}</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-6 bg-card border border-border rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Status</div>
          <div className="text-2xl font-bold capitalize">{report.status}</div>
        </div>
        <div className="p-6 bg-card border border-border rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Mismatches</div>
          <div className="text-2xl font-bold">{mismatchCount}</div>
        </div>
        <div className="p-6 bg-card border border-border rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Project</div>
          <div className="text-lg font-semibold">{project.name}</div>
        </div>
      </div>

      {/* AI Features */}
      {hasMismatches && (
        <div className="space-y-6 border-t border-border pt-8">
          <AIExplanation scanReportId={params.reportId} />
          <AIQuery scanReportId={params.reportId} />
        </div>
      )}

      {/* Migrations */}
      {hasMismatches && (
        <div id="migrations-section" className="space-y-6 border-t border-border pt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <FileCode className="w-6 h-6" />
              Migrations
            </h2>
            <GenerateMigrationButton scanReportId={params.reportId} />
          </div>
          
          {migrations && migrations.length > 0 ? (
            <div className="space-y-4">
              {migrations.map((migration: any) => (
                <MigrationPreview
                  key={migration.id}
                  migration={migration}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border border-border rounded-lg bg-card">
              <FileCode className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No migrations generated yet</h3>
              <p className="text-muted-foreground mb-4">
                Generate a migration to fix the mismatches
              </p>
              <GenerateMigrationButton scanReportId={params.reportId} />
            </div>
          )}
        </div>
      )}

      {/* Mismatches */}
      {mismatches.length > 0 ? (
        <div className="space-y-6 border-t border-border pt-8">
          <h2 className="text-2xl font-bold">Mismatches</h2>
          
          <div className="space-y-4">
            {mismatches.map((mismatch: any, index) => {
              const severity = mismatch.severity as 'error' | 'warning' | 'info';
              const severityColor = {
                error: 'border-red-500/30 bg-red-500/10',
                warning: 'border-yellow-500/30 bg-yellow-500/10',
                info: 'border-blue-500/30 bg-blue-500/10',
              }[severity];

              const severityIcon = {
                error: AlertTriangle,
                warning: AlertTriangle,
                info: Clock,
              }[severity];

              const Icon = severityIcon;

              return (
                <div
                  key={index}
                  className={`p-6 border rounded-lg ${severityColor}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <div>
                        <h3 className="font-semibold text-lg">
                          {mismatch.type.replace('_', ' ').toUpperCase()}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {mismatch.model}
                          {mismatch.field && `.${mismatch.field}`}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      severity === 'error' ? 'bg-red-500/20 text-red-500' :
                      severity === 'warning' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-blue-500/20 text-blue-500'
                    }`}>
                      {severity}
                    </span>
                  </div>

                  {(mismatch.codeValue || mismatch.dbValue) && (
                    <div className="space-y-2 mt-4">
                      {mismatch.codeValue && (
                        <div>
                          <span className="text-sm text-muted-foreground">Code:</span>
                          <div className="font-mono text-sm bg-background/50 p-2 rounded mt-1">
                            {mismatch.codeValue}
                          </div>
                        </div>
                      )}
                      {mismatch.dbValue && (
                        <div>
                          <span className="text-sm text-muted-foreground">Database:</span>
                          <div className="font-mono text-sm bg-background/50 p-2 rounded mt-1">
                            {mismatch.dbValue}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {mismatch.suggestedFix && (
                    <div className="mt-4">
                      <div className="text-sm text-muted-foreground mb-2">Suggested Fix:</div>
                      <div className="font-mono text-sm bg-background/50 p-3 rounded border border-border">
                        {mismatch.suggestedFix}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 border border-border rounded-lg bg-card">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Mismatches Found!</h3>
          <p className="text-muted-foreground">
            Your code and database are perfectly in sync.
          </p>
        </div>
      )}
    </div>
  );
}

