import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveUser } from '@/app/api/projects/utils';
import { encryptSecret } from '@/lib/secret-vault';
import { integrationEvents, validateWebhook } from '@/lib/team-integrations';
import { withRateLimit } from '@/lib/rate-limit-middleware';

const createSchema = z.object({
  provider: z.enum(['slack', 'teams', 'generic']),
  name: z.string().trim().min(2).max(80),
  webhookUrl: z.string().url(),
  events: z.array(z.enum(integrationEvents)).min(1),
});

async function role(supabase: any, teamId: string, userId: string) {
  const { data } = await supabase.from('team_members').select('role').eq('team_id', teamId).eq('user_id', userId).maybeSingle();
  return data?.role || null;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await role(supabase, params.id, user.id)) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    const { data: integrations, error } = await supabase.from('team_integrations')
      .select('id, team_id, provider, name, events, enabled, created_at, updated_at, deliveries:integration_deliveries(id, event_type, status, response_status, error_message, attempts, delivered_at, created_at)')
      .eq('team_id', params.id).order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ integrations: integrations || [], supportedEvents: integrationEvents });
  })(request);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(await role(supabase, params.id, user.id))) return NextResponse.json({ error: 'Owner or admin permission is required.' }, { status: 403 });
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid integration' }, { status: 400 });
    let webhookUrl: string;
    try { webhookUrl = validateWebhook(parsed.data.provider, parsed.data.webhookUrl); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 422 }); }
    const { data, error } = await supabase.from('team_integrations').insert({
      team_id: params.id, provider: parsed.data.provider, name: parsed.data.name,
      encrypted_webhook_url: encryptSecret(webhookUrl), events: parsed.data.events, configured_by: user.id,
    }).select('id, team_id, provider, name, events, enabled, created_at, updated_at').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ integration: data }, { status: 201 });
  })(request);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(await role(supabase, params.id, user.id))) return NextResponse.json({ error: 'Owner or admin permission is required.' }, { status: 403 });
    const integrationId = req.nextUrl.searchParams.get('integrationId');
    if (!integrationId) return NextResponse.json({ error: 'integrationId is required' }, { status: 400 });
    const admin = getAdminClient() as any;
    const { data } = await admin.from('team_integrations').delete().eq('id', integrationId).eq('team_id', params.id).select('id').maybeSingle();
    if (!data) return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  })(request);
}
