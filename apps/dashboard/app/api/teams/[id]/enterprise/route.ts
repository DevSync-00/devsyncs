import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveUser } from '@/app/api/projects/utils';
import { createScimToken, normalizeDomains, validateIpAllowlist } from '@/lib/enterprise-security';
import { loadTeamEntitlements } from '@/lib/entitlements';
import { withRateLimit } from '@/lib/rate-limit-middleware';

const updateSchema = z.object({
  ssoRequired: z.boolean().optional(), ssoProviderId: z.string().trim().max(100).nullable().optional(),
  verifiedDomains: z.array(z.string()).max(20).optional(), scimEnabled: z.boolean().optional(),
  sessionMaxHours: z.number().int().min(1).max(720).optional(),
  auditRetentionDays: z.number().int().min(30).max(2555).optional(),
  ipAllowlist: z.array(z.string()).max(100).optional(), requireMfa: z.boolean().optional(),
});

async function owner(supabase: any, teamId: string, userId: string) {
  const { data } = await supabase.from('team_members').select('role').eq('team_id', teamId).eq('user_id', userId).maybeSingle();
  return data?.role === 'owner';
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await owner(supabase, params.id, user.id)) return NextResponse.json({ error: 'Team owner access required.' }, { status: 403 });
    const admin = getAdminClient() as any;
    const [entitlements, security, tokens, usage] = await Promise.all([
      loadTeamEntitlements(admin, params.id),
      admin.from('team_security_settings').select('*').eq('team_id', params.id).maybeSingle(),
      admin.from('scim_tokens').select('id, name, token_prefix, last_used_at, expires_at, revoked_at, created_at').eq('team_id', params.id).order('created_at', { ascending: false }),
      admin.from('usage_events').select('metric, quantity').eq('team_id', params.id).gte('occurred_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);
    const usageSummary = (usage.data || []).reduce((result: any, item: any) => ({ ...result, [item.metric]: (result[item.metric] || 0) + item.quantity }), {});
    return NextResponse.json({ entitlements, security: security.data || null, scimTokens: tokens.data || [], usage: usageSummary });
  })(request);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await owner(supabase, params.id, user.id)) return NextResponse.json({ error: 'Team owner access required.' }, { status: 403 });
    const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid security settings.' }, { status: 400 });
    const admin = getAdminClient() as any;
    const entitlements = await loadTeamEntitlements(admin, params.id);
    if ((parsed.data.ssoRequired || parsed.data.ssoProviderId || parsed.data.verifiedDomains?.length) && !entitlements.features.sso) return NextResponse.json({ error: 'SSO requires the enterprise plan.' }, { status: 402 });
    if (parsed.data.scimEnabled && !entitlements.features.scim) return NextResponse.json({ error: 'SCIM requires the enterprise plan.' }, { status: 402 });
    if (parsed.data.auditRetentionDays && parsed.data.auditRetentionDays !== 90 && !entitlements.features.customRetention) return NextResponse.json({ error: 'Custom retention requires the enterprise plan.' }, { status: 402 });
    let ipAllowlist: string[] | undefined;
    try { ipAllowlist = parsed.data.ipAllowlist ? validateIpAllowlist(parsed.data.ipAllowlist) : undefined; }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 422 }); }
    const record = {
      team_id: params.id,
      ...(parsed.data.ssoRequired !== undefined ? { sso_required: parsed.data.ssoRequired } : {}),
      ...(parsed.data.ssoProviderId !== undefined ? { sso_provider_id: parsed.data.ssoProviderId } : {}),
      ...(parsed.data.verifiedDomains ? { verified_domains: normalizeDomains(parsed.data.verifiedDomains) } : {}),
      ...(parsed.data.scimEnabled !== undefined ? { scim_enabled: parsed.data.scimEnabled } : {}),
      ...(parsed.data.sessionMaxHours ? { session_max_hours: parsed.data.sessionMaxHours } : {}),
      ...(parsed.data.auditRetentionDays ? { audit_retention_days: parsed.data.auditRetentionDays } : {}),
      ...(ipAllowlist ? { ip_allowlist: ipAllowlist } : {}),
      ...(parsed.data.requireMfa !== undefined ? { require_mfa: parsed.data.requireMfa } : {}),
      updated_by: user.id,
    };
    const { data, error } = await admin.from('team_security_settings').upsert(record, { onConflict: 'team_id' }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ security: data });
  })(request);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await owner(supabase, params.id, user.id)) return NextResponse.json({ error: 'Team owner access required.' }, { status: 403 });
    const admin = getAdminClient() as any;
    if (!(await loadTeamEntitlements(admin, params.id)).features.scim) return NextResponse.json({ error: 'SCIM requires the enterprise plan.' }, { status: 402 });
    const body = await req.json().catch(() => ({}));
    if (body.action === 'revoke-token') {
      await admin.from('scim_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', body.tokenId).eq('team_id', params.id);
      return NextResponse.json({ revoked: true });
    }
    const token = createScimToken();
    const expiresAt = body.expiresInDays ? new Date(Date.now() + Math.min(365, Number(body.expiresInDays)) * 86400000).toISOString() : null;
    const { data, error } = await admin.from('scim_tokens').insert({
      team_id: params.id, name: String(body.name || 'SCIM token').slice(0, 80),
      token_prefix: token.prefix, token_hash: token.hash, created_by: user.id, expires_at: expiresAt,
    }).select('id, name, token_prefix, expires_at, created_at').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ token: { ...data, value: token.value } }, { status: 201 });
  })(request);
}
