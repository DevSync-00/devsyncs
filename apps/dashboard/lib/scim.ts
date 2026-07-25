import { getAdminClient } from './supabase/admin';
import { constantTimeHashMatch, hashToken } from './enterprise-security';
import { loadTeamEntitlements } from './entitlements';

export async function authenticateScim(request: Request) {
  const value = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!value?.startsWith('dscim_')) return null;
  const admin = getAdminClient() as any;
  const { data: candidates } = await admin.from('scim_tokens').select('*')
    .eq('token_prefix', value.slice(0, 12)).is('revoked_at', null);
  const computed = hashToken(value);
  const token = (candidates || []).find((item: any) =>
    constantTimeHashMatch(item.token_hash, computed) && (!item.expires_at || Date.parse(item.expires_at) > Date.now()),
  );
  if (!token) return null;
  const { data: security } = await admin.from('team_security_settings').select('scim_enabled').eq('team_id', token.team_id).maybeSingle();
  const entitlements = await loadTeamEntitlements(admin, token.team_id);
  if (!security?.scim_enabled || !entitlements.features.scim) return null;
  await admin.from('scim_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', token.id);
  return { admin, teamId: token.team_id };
}

export function scimUser(identity: any) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: identity.id,
    externalId: identity.external_id || undefined,
    userName: identity.email,
    active: identity.active,
    emails: [{ value: identity.email, primary: true, type: 'work' }],
    meta: { resourceType: 'User', lastModified: identity.updated_at },
  };
}

export function scimError(status: number, detail: string) {
  return Response.json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], status: String(status), detail }, { status });
}
