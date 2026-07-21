import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import GitHubConnectionsManager from '@/components/github/GitHubConnectionsManager';

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Account settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your account and connected services.</p>
      </div>

      <section className="space-y-2 border-b pb-8">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div>
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="font-medium">{user.email}</p>
        </div>
      </section>

      <section>
        <GitHubConnectionsManager />
      </section>
    </div>
  );
}
