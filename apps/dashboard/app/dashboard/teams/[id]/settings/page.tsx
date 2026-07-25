import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Trash2, AlertTriangle } from 'lucide-react';
import TeamSettingsForm from '@/components/teams/TeamSettingsForm';
import DeleteTeamButton from '@/components/teams/DeleteTeamButton';
import TeamIntegrations from '@/components/teams/TeamIntegrations';
import EnterpriseControlCenter from '@/components/teams/EnterpriseControlCenter';

export default async function TeamSettingsPage({
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
    notFound();
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

  // Only owners can access settings
  if (!isOwner) {
    redirect(`/dashboard/teams/${params.id}`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/dashboard/teams/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Team
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold mb-2">Team Settings</h1>
        <p className="text-muted-foreground">
          Manage your team settings and preferences
        </p>
      </div>

      {/* Team Settings Form */}
      <div className="space-y-8">
        <TeamSettingsForm team={team} />
        <EnterpriseControlCenter teamId={team.id} />
        <TeamIntegrations teamId={team.id} />

        {/* Danger Zone */}
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-xl font-semibold text-destructive">Danger Zone</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            These actions are irreversible. Please be certain before proceeding.
          </p>
          <DeleteTeamButton teamId={team.id} teamName={team.name} />
        </div>
      </div>
    </div>
  );
}

