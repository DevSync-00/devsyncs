import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NewProjectForm from '@/components/NewProjectForm';

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: { team_id?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Validate team access if team_id is provided
  // Use RPC function to avoid RLS recursion issues
  let teamId = searchParams.team_id;
  if (teamId) {
    const { data: isMember, error: rpcError } = await supabase
      .rpc('check_team_membership', { team_uuid: teamId });

    if (rpcError || !isMember) {
      // User doesn't have access to this team, clear team_id
      teamId = undefined;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Guided setup · about 3 minutes</div>
        <h1 className="mt-2 text-3xl font-bold">Run your first safe schema scan</h1>
        <p className="text-muted-foreground mt-2">
          Connect one repository and a verified read-only database. DevSync will guide you to the first actionable issue.
        </p>
      </div>
      <NewProjectForm userId={user.id} teamId={teamId} />
    </div>
  );
}

