import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FolderKanban,
  GitBranch,
  HeartPulse,
  Radar,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Project = {
  id: string;
  name: string;
  schema_type: string;
  team_id?: string | null;
};

type Scan = {
  id: string;
  project_id: string;
  status: string;
  created_at: string;
  mismatches: unknown;
};

interface MissionControlProps {
  projects: Project[];
  scans: Scan[];
}

function mismatchCount(mismatches: unknown) {
  return Array.isArray(mismatches) ? mismatches.length : 0;
}

function timeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function MissionControl({ projects, scans }: MissionControlProps) {
  const latestByProject = new Map<string, Scan>();
  scans.forEach((scan) => {
    if (!latestByProject.has(scan.project_id)) latestByProject.set(scan.project_id, scan);
  });

  const latestScans = Array.from(latestByProject.values());
  const healthy = latestScans.filter(
    (scan) => scan.status === 'completed' && mismatchCount(scan.mismatches) === 0,
  ).length;
  const drifting = latestScans.filter((scan) => mismatchCount(scan.mismatches) > 0);
  const failed = latestScans.filter((scan) => scan.status === 'failed');
  const unscanned = Math.max(0, projects.length - latestScans.length);
  const totalMismatches = latestScans.reduce(
    (total, scan) => total + mismatchCount(scan.mismatches),
    0,
  );
  const healthScore = projects.length
    ? Math.max(0, Math.round(((healthy + unscanned * 0.35) / projects.length) * 100))
    : 100;

  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const attention = [...drifting, ...failed.filter((scan) => !drifting.includes(scan))]
    .sort((a, b) => mismatchCount(b.mismatches) - mismatchCount(a.mismatches))
    .slice(0, 4);
  const recent = [...scans]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const healthTone =
    healthScore >= 85
      ? 'text-emerald-500'
      : healthScore >= 60
        ? 'text-amber-500'
        : 'text-red-500';

  return (
    <section className="space-y-5" aria-labelledby="mission-control-title">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="relative border-b bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <Radar className="h-4 w-4" />
                Live workspace intelligence
              </div>
              <h2 id="mission-control-title" className="text-2xl font-bold tracking-tight">
                Mission Control
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                One view of schema health, active drift, and the next actions that unblock your team.
              </p>
            </div>
            <div className="flex items-center gap-4 rounded-xl border bg-background/70 px-5 py-3 backdrop-blur">
              <div className={`text-4xl font-bold tabular-nums ${healthTone}`}>{healthScore}</div>
              <div>
                <div className="text-sm font-semibold">Workspace health</div>
                <div className="text-xs text-muted-foreground">
                  {projects.length ? `${healthy} of ${projects.length} projects in sync` : 'Ready for your first project'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0">
          {[
            { label: 'Projects', value: projects.length, icon: FolderKanban, tone: 'text-blue-500' },
            { label: 'In sync', value: healthy, icon: ShieldCheck, tone: 'text-emerald-500' },
            { label: 'Need attention', value: drifting.length + failed.length, icon: AlertTriangle, tone: 'text-amber-500' },
            { label: 'Open drift', value: totalMismatches, icon: GitBranch, tone: 'text-violet-500' },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 p-5">
              <div className="rounded-lg bg-muted p-2.5">
                <stat.icon className={`h-5 w-5 ${stat.tone}`} />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <HeartPulse className="h-4 w-4 text-primary" />
                Attention queue
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">Highest-impact issues across your workspace</p>
            </div>
            <Link href="/dashboard/analytics" className="text-xs font-medium text-primary hover:underline">
              View analytics
            </Link>
          </div>

          {attention.length ? (
            <div className="space-y-2">
              {attention.map((scan) => {
                const project = projectMap.get(scan.project_id);
                const count = mismatchCount(scan.mismatches);
                return (
                  <Link
                    key={scan.id}
                    href={`/dashboard/projects/${scan.project_id}/scan-reports/${scan.id}`}
                    className="group flex items-center justify-between rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`rounded-lg p-2 ${scan.status === 'failed' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                        <AlertTriangle className={`h-4 w-4 ${scan.status === 'failed' ? 'text-red-500' : 'text-amber-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{project?.name || 'Unknown project'}</div>
                        <div className="text-xs text-muted-foreground">
                          {scan.status === 'failed' ? 'Scan failed' : `${count} schema ${count === 1 ? 'change' : 'changes'} detected`}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 text-center">
              <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
              <div className="text-sm font-medium">Your queue is clear</div>
              <div className="text-xs text-muted-foreground">No drift needs attention right now.</div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h3 className="flex items-center gap-2 font-semibold">
            <Activity className="h-4 w-4 text-accent" />
            Live activity
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Latest workspace scans</p>
          <div className="mt-5 space-y-4">
            {recent.length ? recent.map((scan) => {
              const project = projectMap.get(scan.project_id);
              const count = mismatchCount(scan.mismatches);
              return (
                <div key={scan.id} className="relative flex gap-3">
                  <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-background ${
                    scan.status === 'failed' ? 'bg-red-500' : count ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/projects/${scan.project_id}`} className="truncate text-sm font-medium hover:text-primary">
                      {project?.name || 'Project'}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {scan.status === 'failed' ? 'Scan failed' : count ? `${count} changes found` : 'Schema verified'}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-muted-foreground">{timeAgo(scan.created_at)}</span>
                </div>
              );
            }) : (
              <div className="flex min-h-36 flex-col items-center justify-center text-center">
                <Clock3 className="mb-2 h-7 w-7 text-muted-foreground" />
                <div className="text-sm font-medium">No activity yet</div>
                <div className="text-xs text-muted-foreground">Your scans will appear here.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/dashboard/projects/new" className="group rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card">
          <Sparkles className="mb-3 h-5 w-5 text-primary" />
          <div className="text-sm font-semibold">Connect a codebase</div>
          <div className="mt-1 text-xs text-muted-foreground">Start monitoring a schema in minutes.</div>
        </Link>
        <Link href="/dashboard/teams/new" className="group rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card">
          <Users className="mb-3 h-5 w-5 text-violet-500" />
          <div className="text-sm font-semibold">Create a team workspace</div>
          <div className="mt-1 text-xs text-muted-foreground">Share visibility and approval workflows.</div>
        </Link>
        <Link href="/docs" className="group rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card">
          <CircleDashed className="mb-3 h-5 w-5 text-accent" />
          <div className="text-sm font-semibold">Automate in CI</div>
          <div className="mt-1 text-xs text-muted-foreground">Catch database drift before every merge.</div>
        </Link>
      </div>
    </section>
  );
}
