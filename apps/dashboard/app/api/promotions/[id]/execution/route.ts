import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveUser } from '@/app/api/projects/utils';
import { withRateLimit } from '@/lib/rate-limit-middleware';

async function accessiblePromotion(supabase: any, id: string, userId: string) {
  const { data } = await supabase.from('deployment_promotions').select('*, project:projects(id, user_id, team_id)').eq('id', id).single();
  if (!data) return null;
  if (data.project.user_id === userId) return data;
  if (data.project.team_id) {
    const { data: member } = await supabase.rpc('check_team_membership', { team_uuid: data.project.team_id });
    if (member) return data;
  }
  return null;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const promotion = await accessiblePromotion(supabase, params.id, user.id);
    if (!promotion) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    const admin = getAdminClient() as any;
    const { data: job } = promotion.execution_job_id
      ? await admin.from('background_jobs').select('id, status, progress, result, last_error, cancel_requested, attempts, started_at, completed_at').eq('id', promotion.execution_job_id).single()
      : { data: null };
    return NextResponse.json({ promotion, job });
  })(request);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const promotion = await accessiblePromotion(supabase, params.id, user.id);
    if (!promotion) return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    if (!promotion.execution_job_id || !['queued', 'deploying'].includes(promotion.status)) {
      return NextResponse.json({ error: 'No cancellable execution is active.' }, { status: 409 });
    }
    const admin = getAdminClient() as any;
    await admin.from('background_jobs').update({ cancel_requested: true }).eq('id', promotion.execution_job_id).in('status', ['queued', 'retry', 'running']);
    return NextResponse.json({ cancellationRequested: true });
  })(request);
}
