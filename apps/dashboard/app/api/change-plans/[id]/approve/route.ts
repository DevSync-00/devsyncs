import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '@/app/api/projects/utils';
import { withRateLimit } from '@/lib/rate-limit-middleware';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: version } = await supabase
      .from('ai_change_plan_versions')
      .select('*, plan:ai_change_plans(*, project:projects(id, user_id, team_id))')
      .eq('id', params.id)
      .single();
    if (!version) return NextResponse.json({ error: 'Plan version not found' }, { status: 404 });
    const project = version.plan.project;
    let canApprove = project.user_id === user.id;
    if (!canApprove && project.team_id) {
      const { data: member } = await supabase.from('team_members').select('role').eq('team_id', project.team_id).eq('user_id', user.id).in('role', ['owner', 'admin']).maybeSingle();
      canApprove = Boolean(member);
    }
    if (!canApprove) return NextResponse.json({ error: 'Owner or admin approval is required' }, { status: 403 });
    if (version.status !== 'proposed') return NextResponse.json({ error: `Version is already ${version.status}` }, { status: 409 });
    if (version.risk_score >= 70 && version.plan.requested_by === user.id) {
      return NextResponse.json({ error: 'High-risk plans require approval from a different owner or administrator.' }, { status: 403 });
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('ai_change_plan_versions').update({
      status: 'approved', approved_by: user.id, approved_at: now,
    }).eq('id', params.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase.from('ai_change_plans').update({ status: 'approved', approved_by: user.id, approved_at: now }).eq('id', version.plan_id);
    return NextResponse.json({ version: data });
  })(request);
}
