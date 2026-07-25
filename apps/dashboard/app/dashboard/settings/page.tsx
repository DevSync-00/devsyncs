import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SettingsControlPlane from '@/components/settings/SettingsControlPlane';
import { getNotificationPreferences } from '@/lib/notifications';

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();
  const initialName = profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || '';
  const [notificationPreferences, projectsResult, membershipsResult] = await Promise.all([
    getNotificationPreferences(supabase, user.id).catch(() => ({
      emailEnabled: true,
      inAppEnabled: true,
      teamDigestEnabled: false,
    })),
    supabase.from('projects').select('id, name, schema_type').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('team_members').select('role, teams(id, name)').eq('user_id', user.id),
  ]);

  const teams = (membershipsResult.data || []).flatMap((membership: any) => {
    const team = Array.isArray(membership.teams) ? membership.teams[0] : membership.teams;
    return team ? [{ id: team.id, name: team.name, role: membership.role }] : [];
  });

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Control plane</div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-xs text-muted-foreground">Account, developer workflow, integrations, policies, security, and billing.</p>
      </div>
      <SettingsControlPlane
        userId={user.id}
        email={user.email || ''}
        initialName={initialName}
        createdAt={user.created_at}
        lastSignInAt={user.last_sign_in_at}
        notificationPreferences={notificationPreferences}
        projects={projectsResult.data || []}
        teams={teams}
      />
    </div>
  );
}
