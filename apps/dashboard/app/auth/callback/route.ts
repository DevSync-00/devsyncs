import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const requestedNext = requestUrl.searchParams.get('next') || '/dashboard';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//')
    ? requestedNext
    : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email_confirmed_at) {
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }

      await supabase.auth.signOut();
    }

    const loginUrl = new URL('/auth/login', requestUrl.origin);
    loginUrl.searchParams.set('error', 'oauth_callback_failed');
    loginUrl.searchParams.set(
      'message',
      error?.message || 'The OAuth provider did not return a valid confirmed account.'
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(
    new URL('/auth/login?error=oauth_code_missing', requestUrl.origin)
  );
}
