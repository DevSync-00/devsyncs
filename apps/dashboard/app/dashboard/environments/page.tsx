import { createClient } from '@/lib/supabase/server';
import { Database, GitBranch, Layers, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EnvironmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, schema_type')
    .eq('user_id', user.id);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Infrastructure Topology
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Database Environments</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage target environments, deployment promotion pipelines, and migration locks.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {[
          {
            name: 'Development',
            badge: 'Local & Ephemeral',
            status: 'Synced',
            color: 'text-emerald-400',
            desc: 'Isolated branch databases generated during local development and preview PRs.',
            icon: GitBranch,
          },
          {
            name: 'Staging',
            badge: 'Pre-release Sandbox',
            status: '2 Migrations Pending',
            color: 'text-amber-400',
            desc: 'Staging ground for dry-run verification and data migration safety rehearsals.',
            icon: Layers,
          },
          {
            name: 'Production',
            badge: 'Protected Master',
            status: 'Locked & Guarded',
            color: 'text-cyan-400',
            desc: 'Production database instances bound by policy checks and approval controls.',
            icon: ShieldCheck,
          },
        ].map((env) => (
          <div key={env.name} className="rounded-lg border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <env.icon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-base">{env.name}</h3>
              </div>
              <span className="rounded border bg-muted/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {env.badge}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {env.desc}
            </p>
            <div className="pt-3 border-t flex items-center justify-between font-mono text-xs">
              <span className="text-muted-foreground">Status:</span>
              <span className={`font-medium ${env.color}`}>{env.status}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h3 className="font-mono text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" /> Connected Database Instances ({projects?.length || 0})
        </h3>
        {projects && projects.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div key={p.id} className="p-3 rounded border bg-background flex items-center justify-between font-mono text-xs">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">{p.schema_type} driver</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  active
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground font-mono">No database instances connected yet.</p>
        )}
      </div>
    </div>
  );
}
