import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, Users, Crown, Shield, User, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default async function TeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get teams where user is a member
  const { data: teamMemberships, error: membershipsError } = await supabase
    .from('team_members')
    .select(`
      *,
      teams (
        id,
        name,
        slug,
        created_at
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Get team member counts
  // Use admin client to bypass RLS for counting members
  const teamIds = teamMemberships?.map((tm: any) => tm.teams?.id).filter(Boolean) || [];
  let memberCounts: any[] = [];
  
  if (teamIds.length > 0) {
    try {
      const { getAdminClient } = await import('@/lib/supabase/admin');
      const adminClient = getAdminClient();
      
      const { data } = await adminClient
    .from('team_members')
    .select('team_id')
        .in('team_id', teamIds);
      
      memberCounts = data || [];
    } catch (error) {
      // If admin client fails, use own memberships as fallback
      memberCounts = teamMemberships || [];
    }
  }

  const countsByTeam = (memberCounts || []).reduce((acc: Record<string, number>, curr: any) => {
    acc[curr.team_id] = (acc[curr.team_id] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="text-muted-foreground mt-2">
            Collaborate with your team on projects and migrations
          </p>
        </div>
        <Link href="/dashboard/teams/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Team
          </Button>
        </Link>
      </div>

      {membershipsError ? (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive text-sm">
            Error loading teams: {membershipsError.message}
          </p>
        </div>
      ) : !teamMemberships || teamMemberships.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-lg bg-card">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No teams yet</h3>
          <p className="text-muted-foreground mb-6">
            Create a team to collaborate with others on projects
          </p>
          <Link href="/dashboard/teams/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Team
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teamMemberships.map((membership: any) => {
            const team = membership.teams;
            const memberCount = countsByTeam[team?.id] || 0;
            const role = membership.role;
            const roleIcons = {
              owner: Crown,
              admin: Shield,
              member: User,
            };
            const RoleIcon = roleIcons[role as keyof typeof roleIcons] || User;

            return (
              <Link
                key={team.id}
                href={`/dashboard/teams/${team.id}`}
                className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold mb-1 group-hover:text-primary transition-colors">
                      {team.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">@{team.slug}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-card border border-border rounded text-xs">
                    <RoleIcon className="w-3 h-3" />
                    <span className="capitalize">{role}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>
                      Created {formatDistanceToNow(new Date(team.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                  <span className="text-sm text-primary group-hover:underline">
                    View team →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

