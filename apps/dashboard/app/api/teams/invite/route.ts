import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { optionalEnv, requiredEnv } from '@/lib/env';
import { isValidEmail } from '@/lib/api-validation';
import { createHash, randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

const INVITE_FROM = 'DevSync <devsync@bitlabsbuild.com>';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { teamId, email, role } = await request.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!teamId || !normalizedEmail || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: teamId, email, role' },
        { status: 400 }
      );
    }

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Enter a valid email address' },
        { status: 400 }
      );
    }

    if (!['member', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be member or admin' },
        { status: 400 }
      );
    }

    // Check if user is admin or owner of the team
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('role, teams(name, slug)')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Team not found or you do not have access' },
        { status: 403 }
      );
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only owners and admins can invite members' },
        { status: 403 }
      );
    }

    const admin = getAdminClient() as any;
    const team = Array.isArray((membership as any).teams)
      ? (membership as any).teams[0]
      : (membership as any).teams;

    const { data: existingProfileData } = await admin
      .from('profiles')
      .select('id, email')
      .ilike('email', normalizedEmail)
      .maybeSingle();
    const existingProfile = existingProfileData as { id: string; email: string | null } | null;

    if (existingProfile?.id) {
      const { data: existingMember } = await admin
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', existingProfile.id)
        .maybeSingle();

      if (existingMember) {
        return NextResponse.json(
          { error: 'User is already a member of this team' },
          { status: 409 }
        );
      }
    }

    const inviteToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(inviteToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: invitationError } = await admin
      .from('team_invitations')
      .upsert({
        team_id: teamId,
        email: normalizedEmail,
        role,
        token_hash: tokenHash,
        invited_by: user.id,
        // An invitation is pending regardless of whether the email already has
        // a DevSync account. Membership is created only by the accept endpoint.
        accepted_by: null,
        accepted_at: null,
        expires_at: expiresAt,
      }, {
        onConflict: 'team_id,email',
      });

    if (invitationError) {
      throw invitationError;
    }

    const appUrl = optionalEnv('NEXT_PUBLIC_APP_URL', ['SITE_URL', 'VERCEL_PROJECT_PRODUCTION_URL'])
      || request.nextUrl.origin;
    const inviteUrl = new URL('/api/teams/invite/accept', appUrl.startsWith('http') ? appUrl : `https://${appUrl}`);
    inviteUrl.searchParams.set('token', inviteToken);

    await sendInviteEmail({
      to: normalizedEmail,
      teamName: team?.name || 'DevSync team',
      inviterEmail: user.email || 'A teammate',
      inviteUrl: inviteUrl.toString(),
      role,
    });

    return NextResponse.json(
      {
        ok: true,
        message: `Invitation sent to ${normalizedEmail}`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Team invitation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

async function sendInviteEmail({
  to,
  teamName,
  inviterEmail,
  inviteUrl,
  role,
}: {
  to: string;
  teamName: string;
  inviterEmail: string;
  inviteUrl: string;
  role: string;
}) {
  const apiKey = requiredEnv('RESEND_API_KEY');
  const subject = `You're invited to join ${teamName} on DevSync`;
  const text = [
    `${inviterEmail} invited you to join ${teamName} as a ${role}.`,
    '',
    `Accept the invitation: ${inviteUrl}`,
    '',
    'This invite expires in 7 days.',
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: INVITE_FROM,
      to,
      subject,
      text,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h1 style="font-size:20px;margin:0 0 12px">Join ${escapeHtml(teamName)} on DevSync</h1>
          <p>${escapeHtml(inviterEmail)} invited you to join as a <strong>${escapeHtml(role)}</strong>.</p>
          <p><a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#2563eb;color:white;padding:10px 14px;border-radius:6px;text-decoration:none">Accept invitation</a></p>
          <p style="color:#64748b;font-size:13px">This invite expires in 7 days.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send invite email: ${body}`);
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

