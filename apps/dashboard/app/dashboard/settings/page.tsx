import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import GitHubConnectionsManager from '@/components/github/GitHubConnectionsManager';
import AccountProfileForm from '@/components/settings/AccountProfileForm';

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

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <h1 className="text-3xl font-bold">Account settings</h1>
        <p className="mt-2 text-muted-foreground">Manage your account and connected services.</p>
      </div>

      <div className="grid gap-10 md:grid-cols-[180px_minmax(0,1fr)]">
        <nav className="space-y-1" aria-label="Account settings">
          <a href="#profile" className="block rounded-md bg-accent px-3 py-2 text-sm font-medium">Profile</a>
          <a href="#github" className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">GitHub</a>
        </nav>

        <div className="min-w-0 space-y-10">
          <section id="profile" className="scroll-mt-24 space-y-5 border-b pb-10">
            <div>
              <h2 className="text-xl font-semibold">Profile</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your personal details across DevSync.</p>
            </div>
            <AccountProfileForm
              userId={user.id}
              email={user.email || ''}
              initialName={initialName}
            />
          </section>

          <section id="github" className="scroll-mt-24">
            <GitHubConnectionsManager />
          </section>
        </div>
      </div>
    </div>
  );
}
