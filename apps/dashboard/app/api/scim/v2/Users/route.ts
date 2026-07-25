import { authenticateScim, scimError, scimUser } from '@/lib/scim';

export async function GET(request: Request) {
  const auth = await authenticateScim(request);
  if (!auth) return scimError(401, 'Invalid or expired bearer token.');
  const url = new URL(request.url);
  const filter = url.searchParams.get('filter');
  let query = auth.admin.from('scim_identities').select('*', { count: 'exact' }).eq('team_id', auth.teamId).order('email');
  const email = filter?.match(/^userName\s+eq\s+"([^"]+)"$/i)?.[1];
  if (email) query = query.eq('email', email.toLowerCase());
  const { data, count, error } = await query.limit(Math.min(200, Number(url.searchParams.get('count') || 100)));
  if (error) return scimError(500, error.message);
  return Response.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: count || 0, startIndex: 1, itemsPerPage: data?.length || 0,
    Resources: (data || []).map(scimUser),
  });
}

export async function POST(request: Request) {
  const auth = await authenticateScim(request);
  if (!auth) return scimError(401, 'Invalid or expired bearer token.');
  const body = await request.json().catch(() => ({}));
  const email = String(body.userName || body.emails?.[0]?.value || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return scimError(400, 'A valid userName email is required.');
  const { data: existing } = await auth.admin.from('scim_identities').select('*').eq('team_id', auth.teamId).eq('email', email).maybeSingle();
  if (existing) return scimError(409, 'User already exists.');
  const { data: created, error: createError } = await auth.admin.auth.admin.createUser({
    email, email_confirm: true, user_metadata: { provisioned_by: 'scim', scim_team_id: auth.teamId },
  });
  if (createError || !created.user) return scimError(422, createError?.message || 'User could not be provisioned.');
  await auth.admin.from('team_members').upsert({ team_id: auth.teamId, user_id: created.user.id, role: 'member' }, { onConflict: 'team_id,user_id' });
  const { data: identity, error } = await auth.admin.from('scim_identities').insert({
    team_id: auth.teamId, user_id: created.user.id, external_id: body.externalId || null,
    email, active: body.active !== false, raw_attributes: body,
  }).select().single();
  if (error) return scimError(500, error.message);
  return Response.json(scimUser(identity), { status: 201 });
}
