import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Activity, AlertTriangle, Check, Terminal, X } from 'lucide-react';

export const dynamic = 'force-dynamic';

function mismatchCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export default async function ScansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', user.id);

  const projectIds = projects?.map(p => p.id) || [];

  const { data: scans } = projectIds.length > 0
    ? await supabase
        .from('scan_reports')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] };

  const projectMap = new Map(projects?.map(p => [p.id, p.name]) || []);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Execution History
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Scan Audit Trail</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Real-time schema scans, dry-run evaluations, and drift checks across your codebase.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex h-11 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold">
            <Terminal className="h-4 w-4 text-primary" />
            Recent Executions ({scans?.length || 0})
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync
          </div>
        </div>

        {scans && scans.length > 0 ? (
          <div className="divide-y">
            {scans.map((scan) => {
              const count = mismatchCount(scan.mismatches);
              const failed = scan.status === 'failed';

              return (
                <Link
                  key={scan.id}
                  href={`/dashboard/projects/${scan.project_id}/scan-reports/${scan.id}`}
                  className="grid grid-cols-[140px_1fr_120px_100px] items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors font-mono text-xs"
                >
                  <div className="text-muted-foreground text-[11px]">
                    {new Date(scan.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">
                      {projectMap.get(scan.project_id) || 'Unknown Project'}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground mt-0.5">
                      Report ID: {scan.id.slice(0, 8)}...
                    </div>
                  </div>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${
                      failed ? 'border-red-500/20 bg-red-500/10 text-red-400' :
                      count > 0 ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' :
                      'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {failed ? <X className="h-3 w-3" /> : count > 0 ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                      {failed ? 'Failed' : count > 0 ? `${count} Drift` : 'Clean'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-primary hover:underline">View details →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-muted-foreground font-mono">
            No scans recorded yet. Run `npx dev-sync scan` in your local project to push your first scan.
          </div>
        )}
      </div>
    </div>
  );
}
