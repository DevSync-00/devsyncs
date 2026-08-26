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
  const clientId = getGitHubAppOAuthClientId();
  if (!slug || !clientId || !process.env.GITHUB_APP_CLIENT_SECRET?.trim()) {
    return NextResponse.json({ error: 'The GitHub App installation and OAuth flow is not configured.' }, { status: 500 });
  }

  const state = randomBytes(32).toString('hex');
  const returnToParam = request.nextUrl.searchParams.get('returnTo') || '/dashboard/projects/new';
  const returnTo = returnToParam.startsWith('/') && !returnToParam.startsWith('//')
    ? returnToParam
    : '/dashboard/projects/new';
  // Always let the user select or install exactly one GitHub account first.
  // Starting with OAuth and enumerating /user/installations silently connects
  // every installation the GitHub identity can access.
  const destination = `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${state}`;
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
