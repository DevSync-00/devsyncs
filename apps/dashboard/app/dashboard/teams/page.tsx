import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, Crown, Layers3, Plus, Shield, User, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default async function TeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: teamMemberships, error: membershipsError } = await supabase
    .from('team_members')
    .select(`
      *,
      teams (id, name, slug, created_at)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const teamIds = teamMemberships?.map((membership: any) => membership.teams?.id).filter(Boolean) || [];
  let memberCounts: any[] = [];

  if (teamIds.length > 0) {
    try {
      const { getAdminClient } = await import('@/lib/supabase/admin');
      const { data } = await getAdminClient()
        .from('team_members')
        .select('team_id')
        .in('team_id', teamIds);

      memberCounts = data || [];
    } catch {
      memberCounts = teamMemberships || [];
    }
  }

  const countsByTeam = memberCounts.reduce((counts: Record<string, number>, member: any) => {
    counts[member.team_id] = (counts[member.team_id] || 0) + 1;
    return counts;
  }, {});
  const teamCount = teamMemberships?.length || 0;
  const ownedTeamCount = teamMemberships?.filter((membership: any) => membership.role === 'owner').length || 0;
  const roleIcons = { owner: Crown, admin: Shield, member: User };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Workspace &amp; Access
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage the workspaces, people, and projects you collaborate on.
          </p>
        </div>
        <Link href="/dashboard/teams/new">
          <Button size="sm" className="font-mono text-xs">
            <Plus className="mr-2 h-4 w-4" />
            Create team
          </Button>
        </Link>
      </div>

      {membershipsError ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">Error loading teams: {membershipsError.message}</p>
        </div>
      ) : teamCount === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border bg-background shadow-sm">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold">Create your first workspace</h2>
          <p className="mx-auto mb-6 mt-2 max-w-sm text-sm text-muted-foreground">
            Bring collaborators and database projects together in one shared team.
          </p>
          <Link href="/dashboard/teams/new">
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Create team</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:w-fit">
            <Metric label="Workspaces" value={teamCount} />
            <Metric label="Owned by you" value={ownedTeamCount} />
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="hidden grid-cols-[minmax(0,1fr)_140px_140px_40px] gap-4 border-b bg-muted/30 px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground md:grid">
              <span>Workspace</span><span>Your access</span><span>Members</span><span />
            </div>
            <div className="divide-y divide-border">
              {teamMemberships!.map((membership: any) => {
                const team = membership.teams;
                const memberCount = countsByTeam[team.id] || 0;
                const RoleIcon = roleIcons[membership.role as keyof typeof roleIcons] || User;

                return (
                  <Link
                    key={team.id}
                    href={`/dashboard/teams/${team.id}`}
                    className="group grid gap-4 px-5 py-4 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,1fr)_140px_140px_40px] md:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground shadow-sm transition-colors group-hover:border-primary/30 group-hover:text-primary">
                        <Layers3 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold transition-colors group-hover:text-primary">{team.name}</h2>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                          @{team.slug} · Created {formatDistanceToNow(new Date(team.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <RoleIcon className="h-3.5 w-3.5" /><span className="capitalize">{membership.role}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                    </div>
                    <ArrowUpRight className="hidden h-4 w-4 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground md:block" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-36 bg-card px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
