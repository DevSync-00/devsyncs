import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/dashboard/teams?invite=missing', requestUrl.origin));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = getAdminClient() as any;
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const { data: invitation, error } = await admin
    .from('team_invitations')
    .select('id, team_id, email, role, accepted_at, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !invitation) {
    return NextResponse.redirect(new URL('/dashboard/teams?invite=invalid', requestUrl.origin));
  }

  if (invitation.accepted_at) {
    return NextResponse.redirect(new URL(`/dashboard/teams/${invitation.team_id}`, requestUrl.origin));
  }

  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(new URL('/dashboard/teams?invite=expired', requestUrl.origin));
  }

  if (!user) {
    const signupUrl = new URL('/auth/signup', requestUrl.origin);
    signupUrl.searchParams.set('email', invitation.email);
    signupUrl.searchParams.set('next', `/api/teams/invite/accept?token=${token}`);
    return NextResponse.redirect(signupUrl);
  }

  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return NextResponse.redirect(new URL('/dashboard/teams?invite=email_mismatch', requestUrl.origin));
  }

  const { data: existingMember } = await admin
    .from('team_members')
    .select('id')
    .eq('team_id', invitation.team_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existingMember) {
    const { error: memberError } = await admin
      .from('team_members')
      .insert({
        team_id: invitation.team_id,
        user_id: user.id,
        role: invitation.role,
      });

    if (memberError) {
      return NextResponse.redirect(new URL('/dashboard/teams?invite=failed', requestUrl.origin));
    }
  }

  await admin
    .from('team_invitations')
    .update({
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invitation.id);

  return NextResponse.redirect(new URL(`/dashboard/teams/${invitation.team_id}`, requestUrl.origin));
}
