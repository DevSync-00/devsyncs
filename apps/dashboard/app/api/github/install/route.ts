import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGitHubAppOAuthClientId, getGitHubAppSlug } from '@/lib/github-app';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const slug = getGitHubAppSlug();
  if (!slug) {
    return NextResponse.json({ error: 'GITHUB_APP_SLUG is not configured' }, { status: 500 });
  }

  const state = randomBytes(32).toString('hex');
  const returnToParam = request.nextUrl.searchParams.get('returnTo') || '/dashboard/projects/new';
  const returnTo = returnToParam.startsWith('/') && !returnToParam.startsWith('//')
    ? returnToParam
    : '/dashboard/projects/new';
  const clientId = getGitHubAppOAuthClientId();
  const destination = clientId
    ? `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&state=${state}`
    : `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${state}`;
  const response = NextResponse.redirect(destination);
  response.cookies.set('github_app_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/',
  });
  response.cookies.set('github_app_return_to', returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/',
  });
  return response;
}
