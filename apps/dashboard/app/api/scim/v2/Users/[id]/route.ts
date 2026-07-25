import { authenticateScim, scimError, scimUser } from '@/lib/scim';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await authenticateScim(request);
  if (!auth) return scimError(401, 'Invalid or expired bearer token.');
  const { data } = await auth.admin.from('scim_identities').select('*').eq('id', params.id).eq('team_id', auth.teamId).maybeSingle();
  return data ? Response.json(scimUser(data)) : scimError(404, 'User not found.');
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await authenticateScim(request);
  if (!auth) return scimError(401, 'Invalid or expired bearer token.');
  const body = await request.json().catch(() => ({}));
  const { data: identity } = await auth.admin.from('scim_identities').select('*').eq('id', params.id).eq('team_id', auth.teamId).maybeSingle();
  if (!identity) return scimError(404, 'User not found.');
  let active = body.active;
  for (const operation of body.Operations || []) if (String(operation.path || '').toLowerCase() === 'active') active = operation.value;
  if (active === false) await auth.admin.from('team_members').delete().eq('team_id', auth.teamId).eq('user_id', identity.user_id);
  if (active === true) await auth.admin.from('team_members').upsert({ team_id: auth.teamId, user_id: identity.user_id, role: 'member' }, { onConflict: 'team_id,user_id' });
  const { data, error } = await auth.admin.from('scim_identities').update({
    active: active === undefined ? identity.active : Boolean(active),
    external_id: body.externalId ?? identity.external_id,
    raw_attributes: { ...(identity.raw_attributes || {}), ...body },
    updated_at: new Date().toISOString(),
  }).eq('id', identity.id).select().single();
  if (error) return scimError(500, error.message);
  return Response.json(scimUser(data));
}

export const DELETE = async (request: Request, context: { params: { id: string } }) => {
  const patched = new Request(request.url, {
    method: 'PATCH', headers: request.headers,
    body: JSON.stringify({ active: false }),
  });
  return PATCH(patched, context);
};
