import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CircleDot,
  Copy,
  Database,
  GitBranch,
  Play,
  Terminal,
  X,
} from 'lucide-react';

type Project = { id: string; name: string; schema_type: string; team_id?: string | null };
type Scan = { id: string; project_id: string; status: string; created_at: string; mismatches: unknown };

interface MissionControlProps {
  projects: Project[];
  scans: Scan[];
}

function mismatchCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function timeAgo(value: string) {
  return value.replace('T', ' ').slice(5, 16);
}

export default function MissionControl({ projects, scans }: MissionControlProps) {
  const latestByProject = new Map<string, Scan>();
  scans.forEach((scan) => {
    if (!latestByProject.has(scan.project_id)) latestByProject.set(scan.project_id, scan);
  });

  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const latest = Array.from(latestByProject.values());
  const healthy = latest.filter((scan) => scan.status === 'completed' && mismatchCount(scan.mismatches) === 0).length;
  const failed = latest.filter((scan) => scan.status === 'failed').length;
  const drift = latest.reduce((total, scan) => total + mismatchCount(scan.mismatches), 0);
  const attention = latest
    .filter((scan) => scan.status === 'failed' || mismatchCount(scan.mismatches) > 0)
    .sort((a, b) => mismatchCount(b.mismatches) - mismatchCount(a.mismatches))
    .slice(0, 5);
  const recent = [...scans]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);
  const status = failed ? 'degraded' : drift ? 'drift detected' : 'operational';

  return (
    <section className="space-y-4" aria-label="Workspace status">
      <div className="grid overflow-hidden rounded-lg border bg-card xl:grid-cols-[1fr_220px_220px_220px]">
        <div className="flex min-h-28 items-center gap-4 p-5">
          <div className={`flex h-10 w-10 items-center justify-center rounded-md border ${
            failed ? 'border-red-500/30 bg-red-500/10 text-red-400' : drift ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          }`}>
            {failed ? <X className="h-5 w-5" /> : drift ? <AlertTriangle className="h-5 w-5" /> : <Check className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-base font-semibold">Workspace {status}</h2>
              <span className="rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">live</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {drift ? `${drift} schema ${drift === 1 ? 'change requires' : 'changes require'} review.` : 'All monitored schemas match their expected state.'}
            </p>
          </div>
        </div>
        {[
          { label: 'in sync', value: healthy, detail: `${projects.length} total projects`, icon: Check, tone: 'text-emerald-400' },
          { label: 'open drift', value: drift, detail: `${attention.length} affected`, icon: GitBranch, tone: drift ? 'text-amber-400' : 'text-muted-foreground' },
          { label: 'failed scans', value: failed, detail: `${scans.length} recent runs`, icon: Terminal, tone: failed ? 'text-red-400' : 'text-muted-foreground' },
        ].map((item) => (
          <div key={item.label} className="border-t p-5 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {item.label}
              <item.icon className={`h-3.5 w-3.5 ${item.tone}`} />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{item.value}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{item.detail}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,.75fr)]">
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="flex h-11 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <CircleDot className="h-3.5 w-3.5 text-amber-400" />
              <h3 className="font-mono text-xs font-semibold">Issues</h3>
              <span className="font-mono text-[10px] text-muted-foreground">{attention.length}</span>
            </div>
            <Link href="/dashboard/analytics" className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          {attention.length ? (
            <div className="divide-y">
              {attention.map((scan) => {
                const count = mismatchCount(scan.mismatches);
                const failedScan = scan.status === 'failed';
                return (
                  <Link
                    key={scan.id}
                    href={`/dashboard/projects/${scan.project_id}/scan-reports/${scan.id}`}
                    className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-muted/30"
                  >
                    <AlertTriangle className={`h-3.5 w-3.5 ${failedScan ? 'text-red-400' : 'text-amber-400'}`} />
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs">
                        {failedScan ? 'SCAN_FAILED' : 'SCHEMA_DRIFT'} <span className="text-muted-foreground">in</span> {projectMap.get(scan.project_id)?.name || 'unknown'}
                      </div>
                      <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                        {failedScan ? 'Scanner exited before schema comparison completed' : `${count} database object${count === 1 ? '' : 's'} differ from source`}
                      </div>
                    </div>
                    <span className="rounded border px-2 py-1 font-mono text-[10px] text-muted-foreground">View diff</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-44 flex-col items-center justify-center text-center">
              <Check className="mb-2 h-5 w-5 text-emerald-400" />
              <div className="font-mono text-xs">No issues found</div>
              <div className="mt-1 text-[11px] text-muted-foreground">Your schema state is clean.</div>
            </div>
          )}
        </div>

        <div id="activity" className="overflow-hidden rounded-lg border bg-[#080c12] text-slate-300">
          <div className="flex h-11 items-center justify-between border-b border-white/10 px-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-cyan-400" />
              <h3 className="font-mono text-xs font-semibold">Activity log</h3>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> STREAMING
            </div>
          </div>
          <div className="min-h-44 divide-y divide-white/5">
            {recent.length ? recent.map((scan) => {
              const count = mismatchCount(scan.mismatches);
              return (
                <Link key={scan.id} href={`/dashboard/projects/${scan.project_id}/scan-reports/${scan.id}`} className="grid grid-cols-[42px_60px_minmax(0,1fr)] gap-2 px-4 py-2.5 font-mono text-[10px] hover:bg-white/[0.03]">
                  <span className="text-slate-600">{timeAgo(scan.created_at)}</span>
                  <span className={scan.status === 'failed' ? 'text-red-400' : count ? 'text-amber-400' : 'text-emerald-400'}>
                    {scan.status === 'failed' ? 'ERROR' : count ? 'WARN' : 'PASS'}
                  </span>
                  <span className="truncate">
                    scan <span className="text-cyan-300">{projectMap.get(scan.project_id)?.name || 'project'}</span>
                    <span className="text-slate-500"> — {scan.status === 'failed' ? 'execution failed' : count ? `${count} changes found` : 'schema verified'}</span>
                  </span>
                </Link>
              );
            }) : (
              <div className="p-4 font-mono text-[10px] text-slate-500">$ waiting for first scan...</div>
            )}
          </div>
        </div>
      </div>

      <div id="environments" className="grid gap-3 md:grid-cols-3">
        {[
          { icon: Play, label: 'Run scan', command: 'npx dev-sync scan', href: '/docs' },
          { icon: Database, label: 'Connect database', command: 'dev-sync projects add', href: '/dashboard/projects/new' },
          { icon: Copy, label: 'Add to CI', command: 'dev-sync scan --check', href: '/docs' },
        ].map((action) => (
          <Link key={action.label} href={action.href} className="group flex items-center gap-3 rounded-lg border bg-card p-3 hover:border-primary/40 hover:bg-muted/20">
            <div className="rounded-md border bg-background p-2"><action.icon className="h-4 w-4 text-primary" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">{action.label}</div>
              <code className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">$ {action.command}</code>
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </section>
  );
}
