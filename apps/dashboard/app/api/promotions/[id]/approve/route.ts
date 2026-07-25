import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '@/app/api/projects/utils';
import { withRateLimit } from '@/lib/rate-limit-middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: promotion } = await supabase
      .from('deployment_promotions')
      .select('*, project:projects(id, user_id, team_id)')
      .eq('id', params.id)
      .single();
    if (!promotion) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });

    let canApprove = promotion.project.user_id === user.id;
    if (!canApprove && promotion.project.team_id) {
      const { data: member } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', promotion.project.team_id)
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin'])
        .maybeSingle();
      canApprove = Boolean(member);
    }
    if (!canApprove) return NextResponse.json({ error: 'Owner or admin approval is required' }, { status: 403 });
    if (promotion.status !== 'awaiting_approval') {
      return NextResponse.json({ error: `Promotion cannot be approved from ${promotion.status}` }, { status: 409 });
    }
    if (promotion.separation_of_duties && promotion.requested_by === user.id) {
      return NextResponse.json({ error: 'This promotion requires an independent approver.' }, { status: 403 });
    }
    const { error: voteError } = await supabase.from('promotion_approvals').insert({
      promotion_id: promotion.id,
      approver_id: user.id,
      decision: 'approved',
    });
    if (voteError?.code === '23505') return NextResponse.json({ error: 'You already approved this promotion.' }, { status: 409 });
    if (voteError) return NextResponse.json({ error: voteError.message }, { status: 500 });
    const { count } = await supabase
      .from('promotion_approvals')
      .select('id', { count: 'exact', head: true })
      .eq('promotion_id', promotion.id)
      .eq('decision', 'approved');
    const required = Number(promotion.required_approvals || 1);
    const quorumMet = Number(count || 0) >= required;

    const gates = (promotion.gates || []).map((gate: any) =>
      gate.id === 'approval'
        ? { ...gate, status: quorumMet ? 'passed' : 'required', reason: `${count || 0} of ${required} required approvals recorded.` }
        : gate,
    );
    const unresolved = gates.some((gate: any) => gate.status !== 'passed');
    const { data, error } = await supabase
      .from('deployment_promotions')
      .update({
        status: quorumMet && !unresolved ? 'approved' : 'awaiting_approval',
        decision: quorumMet && !unresolved ? 'ready' : 'approval_required',
        approved_by: quorumMet ? user.id : null,
        approved_at: quorumMet ? new Date().toISOString() : null,
        gates,
      })
      .eq('id', params.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ promotion: data });
  })(request);
}
