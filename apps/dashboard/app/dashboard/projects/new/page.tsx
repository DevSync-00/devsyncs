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
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">New Project</h1>
        <p className="text-muted-foreground mt-2">
          Create a new project to start syncing your schemas
        </p>
      </div>
      <NewProjectForm userId={user.id} teamId={teamId} />
    </div>
  );
}

