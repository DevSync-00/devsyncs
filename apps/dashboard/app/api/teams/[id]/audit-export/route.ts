import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveUser } from '@/app/api/projects/utils';
import { loadTeamEntitlements } from '@/lib/entitlements';

const csv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const user = await resolveUser(request, supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: member } = await supabase.from('team_members').select('role').eq('team_id', params.id).eq('user_id', user.id).maybeSingle();
  if (!['owner', 'admin'].includes(member?.role)) return NextResponse.json({ error: 'Owner or admin access required.' }, { status: 403 });
  const admin = getAdminClient() as any;
  if (!(await loadTeamEntitlements(admin, params.id)).features.auditExport) {
    return NextResponse.json({ error: 'Audit export requires Team or Enterprise.' }, { status: 402 });
  }
  const from = request.nextUrl.searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString();
  const to = request.nextUrl.searchParams.get('to') || new Date().toISOString();
  const { data, error } = await admin.from('audit_events').select('*').eq('team_id', params.id)
    .gte('created_at', from).lte('created_at', to).order('created_at', { ascending: false }).limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (request.nextUrl.searchParams.get('format') === 'json') {
    return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), from, to, events: data }, null, 2), {
      headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="devsync-audit-${params.id}.json"` },
    });
  }
  const columns = ['id', 'created_at', 'actor_id', 'actor_type', 'action', 'resource_type', 'resource_id', 'outcome', 'event_hash', 'previous_hash', 'evidence'];
  const output = [columns.join(','), ...(data || []).map((row: any) => columns.map((key) => csv(key === 'evidence' ? JSON.stringify(row[key]) : row[key])).join(','))].join('\n');
  return new NextResponse(output, { headers: { 'content-type': 'text/csv', 'content-disposition': `attachment; filename="devsync-audit-${params.id}.csv"` } });
}
