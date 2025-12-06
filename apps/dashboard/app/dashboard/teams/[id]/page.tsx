import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Settings, Crown, Shield, User, Plus, Mail, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import MemberActions from '@/components/teams/MemberActions';

export default async function TeamDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get team
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('id', params.id)
    .single();

  if (teamError || !team) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/dashboard/teams">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Teams
          </Button>
        </Link>
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive">Team not found</p>
        </div>
      </div>
    );
  }

  // Check user's membership and role
  const { data: membership } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    redirect('/dashboard/teams');
  }

  const userRole = membership.role;
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'admin' || isOwner;

  // Get team members
  const { data: members, error: membersError } = await supabase
    .from('team_members')
    .select(`
      *,
      users:user_id (
        id,
        email
      )
    `)
    .eq('team_id', params.id)
    .order('created_at', { ascending: false });

  // Get team projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('team_id', params.id)
    .order('created_at', { ascending: false });

  const roleIcons = {
    owner: Crown,
    admin: Shield,
    member: User,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/teams">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Teams
          </Button>
        </Link>
      </div>

      {/* Team Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">{team.name}</h1>
          <p className="text-muted-foreground">@{team.slug}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Created {formatDistanceToNow(new Date(team.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/teams/${params.id}/collaboration`}>
            <Button variant="outline">
              <Activity className="w-4 h-4 mr-2" />
              Collaboration
            </Button>
          </Link>
          {isAdmin && (
            <Link href={`/dashboard/teams/${params.id}/settings`}>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Members</span>
          </div>
          <p className="text-2xl font-bold">{members?.length || 0}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Projects</span>
          </div>
          <p className="text-2xl font-bold">{projects?.length || 0}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Your Role</span>
          </div>
          <p className="text-2xl font-bold capitalize">{userRole}</p>
        </div>
      </div>

      {/* Members Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Members</h2>
          {isAdmin && (
            <Link href={`/dashboard/teams/${params.id}/invite`}>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            </Link>
          )}
        </div>

        {membersError ? (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive text-sm">
              Error loading members: {membersError.message}
            </p>
          </div>
        ) : !members || members.length === 0 ? (
          <div className="p-8 text-center border border-border rounded-lg bg-card">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No members yet</p>
          </div>
        ) : (
          <div className="border border-border rounded-lg bg-card overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium">Member</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Role</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Joined</th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-right text-sm font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((member: any) => {
                  const RoleIcon = roleIcons[member.role as keyof typeof roleIcons] || User;
                  const memberEmail = (member.users as any)?.email || 'Unknown';
                  const isCurrentUser = member.user_id === user.id;

                  return (
                    <tr key={member.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{memberEmail}</p>
                            {isCurrentUser && (
                              <p className="text-xs text-muted-foreground">You</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <RoleIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="capitalize">{member.role}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(member.created_at), { addSuffix: true })}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          {!isCurrentUser && (
                            <MemberActions
                              memberId={member.id}
                              teamId={params.id}
                              currentRole={member.role}
                              isCurrentUser={isCurrentUser}
                              onUpdate={() => window.location.reload()}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Team Projects</h2>
          <Link href={`/dashboard/projects/new?team_id=${params.id}`}>
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>

        {!projects || projects.length === 0 ? (
          <div className="p-8 text-center border border-border rounded-lg bg-card">
            <Settings className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No projects yet</p>
            <Link href={`/dashboard/projects/new?team_id=${params.id}`}>
              <Button>Create Project</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project: any) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="block p-4 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors"
              >
                <h3 className="font-semibold mb-2">{project.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {project.schema_type || 'Unknown'} schema
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

