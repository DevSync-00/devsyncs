import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveUser } from '@/app/api/projects/utils';
import { executionDecision } from '@/lib/promotion-control';
import { withRateLimit } from '@/lib/rate-limit-middleware';

const bodySchema = z.object({ confirmationText: z.string().max(120) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Explicit confirmation text is required.' }, { status: 400 });

    const { data: promotion } = await supabase
      .from('deployment_promotions')
      .select('*, project:projects(id, user_id, team_id), migration:migrations(id, content), target:project_environments!deployment_promotions_target_environment_id_fkey(id, name, tier, connection_secret_id)')
      .eq('id', params.id)
      .single();
    if (!promotion) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    let canExecute = promotion.project.user_id === user.id;
    if (!canExecute && promotion.project.team_id) {
      const { data: member } = await supabase.from('team_members').select('role').eq('team_id', promotion.project.team_id).eq('user_id', user.id).in('role', ['owner', 'admin']).maybeSingle();
      canExecute = Boolean(member);
    }
    if (!canExecute) return NextResponse.json({ error: 'Owner or admin execution permission is required.' }, { status: 403 });

    const { count } = await supabase.from('promotion_approvals').select('id', { count: 'exact', head: true }).eq('promotion_id', promotion.id).eq('decision', 'approved');
    const decision = executionDecision({
      status: promotion.status,
      decision: promotion.decision,
      gates: promotion.gates || [],
      approvalCount: count || 0,
      requiredApprovals: promotion.required_approvals || 0,
      confirmationText: promotion.confirmation_text,
      suppliedConfirmation: parsed.data.confirmationText,
    });
    if (!decision.allowed) return NextResponse.json({ error: decision.reason }, { status: 409 });
    if (!promotion.target.connection_secret_id) {
      return NextResponse.json({ error: 'The target environment has no verified database connection.' }, { status: 409 });
    }
    const { data: secret } = await supabase.from('environment_secrets').select('encrypted_value, verification_status').eq('id', promotion.target.connection_secret_id).single();
    if (!secret || secret.verification_status !== 'verified') {
      return NextResponse.json({ error: 'The target database connection must be verified before execution.' }, { status: 409 });
    }

    const requestedAt = new Date().toISOString();
    const admin = getAdminClient() as any;
    const { data: job, error: jobError } = await admin.from('background_jobs').insert({
      job_type: 'promotion_execute',
      deduplication_key: `promotion:${promotion.id}`,
      project_id: promotion.project.id,
      priority: promotion.target.tier === 'production' ? 20 : 40,
      payload: { promotionId: promotion.id, actorId: user.id },
      max_attempts: 1,
    }).select().single();
    if (jobError?.code === '23505') return NextResponse.json({ error: 'This promotion is already queued or executing.' }, { status: 409 });
    if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
    const { data: queued } = await supabase.from('deployment_promotions').update({
      status: 'queued', execution_requested_by: user.id, execution_requested_at: requestedAt, execution_job_id: job.id,
    }).eq('id', promotion.id).eq('status', 'approved').select().maybeSingle();
    if (!queued) {
      await admin.from('background_jobs').update({ status: 'cancelled', cancel_requested: true, completed_at: new Date().toISOString() }).eq('id', job.id);
      return NextResponse.json({ error: 'Promotion was changed before it could be queued.' }, { status: 409 });
    }
    return NextResponse.json({ promotion: queued, job }, { status: 202 });
  })(request);
}
