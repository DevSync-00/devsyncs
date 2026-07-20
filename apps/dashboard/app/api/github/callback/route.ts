import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  exchangeGitHubOAuthCode,
  getGitHubAppSlug,
  getGitHubInstallationsForUser,
  getGitHubOAuthUser,
} from '@/lib/github-app';

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
  if (!expectedState || state !== expectedState) {
    return response('error', 'Invalid or expired GitHub connection request.');
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return response('error', 'Sign in to connect GitHub.');

  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    try {
      const userToken = await exchangeGitHubOAuthCode(code);
      const githubUser = await getGitHubOAuthUser(userToken);
      const installations = await getGitHubInstallationsForUser(userToken);

      if (installations.length === 0) {
        const slug = getGitHubAppSlug();
        if (!slug) return response('error', 'GitHub App slug is not configured.');
        return NextResponse.redirect(
          `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${expectedState}`
        );
      }

      const admin = getAdminClient() as any;
      const rows = installations.map((installation) => ({
        user_id: user.id,
        installation_id: installation.id,
        account_login: installation.account?.login,
        account_type: installation.account?.type || installation.target_type || 'User',
        repository_selection: installation.repository_selection || 'selected',
        github_user_id: githubUser.id,
        github_login: githubUser.login,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await admin
        .from('github_app_installations')
        .upsert(rows, { onConflict: 'user_id,installation_id' });
      if (error) throw error;
      return response('connected');
    } catch (error: any) {
      return response('error', error?.message || 'Unable to authorize GitHub.');
    }
  }

  const installationIdParam = request.nextUrl.searchParams.get('installation_id');
  if (installationIdParam) {
    const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
    if (!clientId) {
      return response('error', 'GitHub user authorization is required before connecting installations.');
    }

    return NextResponse.redirect(
      `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&state=${expectedState}`
    );
  }

  return response('error', 'Invalid or expired GitHub connection request.');
}
