import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getGitHubInstallation } from '@/lib/github-app';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const returnTo = request.cookies.get('github_app_return_to')?.value || '/dashboard/projects/new';
  const redirectUrl = new URL(returnTo, request.nextUrl.origin);
  const response = (status: 'connected' | 'error', message?: string) => {
    redirectUrl.searchParams.set('github', status);
    if (message) redirectUrl.searchParams.set('github_message', message);
    const result = NextResponse.redirect(redirectUrl);
    result.cookies.delete('github_app_state');
    result.cookies.delete('github_app_return_to');
    return result;
  };

  const expectedState = request.cookies.get('github_app_state')?.value;
  const state = request.nextUrl.searchParams.get('state');
  const installationId = Number(request.nextUrl.searchParams.get('installation_id'));
  if (!expectedState || state !== expectedState || !Number.isSafeInteger(installationId)) {
    return response('error', 'Invalid or expired GitHub installation request.');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return response('error', 'Sign in to connect GitHub.');

  try {
    const installation = await getGitHubInstallation(installationId);
    const admin = getAdminClient() as any;
    const { error } = await admin.from('github_app_installations').upsert({
      user_id: user.id,
      installation_id: installationId,
      account_login: installation.account?.login,
      account_type: installation.account?.type || 'User',
      repository_selection: installation.repository_selection || 'selected',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,installation_id' });
    if (error) throw error;
    return response('connected');
  } catch (error: any) {
    return response('error', error?.message || 'Unable to connect GitHub.');
  }
}

