import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { PUT as processPullRequestReview } from '@/app/api/github/webhook/route';
import { retryDelaySeconds } from '@/lib/job-queue';
import { executePromotionJob } from '@/lib/promotion-executor';
import { deliverIntegration } from '@/lib/team-integrations';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const expected = process.env.DEVSYNC_WORKER_SECRET || process.env.CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = getAdminClient() as any;
  const workerName = `web-${randomUUID()}`;
  const { data: claimed, error } = await admin.rpc('claim_background_job', {
    worker_name: workerName,
    lease_seconds: 240,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const job = claimed?.[0];
  if (!job) return NextResponse.json({ processed: false, reason: 'queue-empty' });

  try {
    await setProgress(admin, job.id, 'scanning', 15);
    const { data: state } = await admin.from('background_jobs').select('cancel_requested').eq('id', job.id).single();
    if (state?.cancel_requested) {
      await admin.from('background_jobs').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', job.id);
      if (job.job_type === 'promotion_execute') await admin.from('deployment_promotions').update({ status: 'cancelled' }).eq('id', job.payload.promotionId).eq('status', 'queued');
      return NextResponse.json({ processed: true, jobId: job.id, status: 'cancelled' });
    }

    let result: any;
    if (job.job_type === 'integration_delivery') {
      await setProgress(admin, job.id, 'delivering-webhook', 40);
      result = await deliverIntegration(admin, job.payload.deliveryId);
    } else if (job.job_type === 'promotion_execute') {
      await setProgress(admin, job.id, 'revalidating-live-gates', 20);
      result = await executePromotionJob(
        admin,
        job.payload.promotionId,
        job.payload.actorId,
        async () => {
          const { data } = await admin.from('background_jobs').select('cancel_requested').eq('id', job.id).single();
          return Boolean(data?.cancel_requested);
        },
      );
    } else {
      const internalRequest = new NextRequest('http://internal/api/github/webhook', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: request.headers.get('authorization') || '',
        },
        body: JSON.stringify({ webhook: job.payload.webhook, origin: job.payload.origin }),
      });
      const reviewResponse = await processPullRequestReview(internalRequest);
      result = await reviewResponse.json();
      if (!reviewResponse.ok) throw new Error(result.error || 'Pull request review failed');
    }
    await admin.from('background_jobs').update({
      status: 'completed',
      result,
      progress: { stage: 'completed', percent: 100 },
      completed_at: new Date().toISOString(),
      lease_owner: null,
      lease_expires_at: null,
    }).eq('id', job.id);
    if (job.job_type === 'github_pr_review') await finishDelivery(admin, job.payload.deliveryId, 'completed');
    return NextResponse.json({ processed: true, jobId: job.id, status: 'completed', result });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    const dead = job.attempts >= job.max_attempts;
    const delaySeconds = retryDelaySeconds(job.attempts);
    await admin.from('background_jobs').update({
      status: dead ? 'dead' : 'retry',
      last_error: message.slice(0, 4000),
      progress: { stage: dead ? 'dead-letter' : 'retry-scheduled', percent: 0 },
      available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      completed_at: dead ? new Date().toISOString() : null,
      lease_owner: null,
      lease_expires_at: null,
    }).eq('id', job.id);
    if (job.job_type === 'promotion_execute') {
      await admin.from('deployment_promotions').update({
        status: message.includes('cancelled') ? 'cancelled' : 'failed',
        execution_metrics: { failedAt: new Date().toISOString(), error: message.slice(0, 1000), stage: 'live-revalidation-or-execution' },
      }).eq('id', job.payload.promotionId).in('status', ['queued', 'deploying']);
    }
    if (dead && job.job_type === 'github_pr_review') await finishDelivery(admin, job.payload.deliveryId, 'failed', message);
    return NextResponse.json(
      { processed: true, jobId: job.id, status: dead ? 'dead' : 'retry', error: message },
      { status: dead ? 500 : 202 },
    );
  }
}

export const GET = POST;

async function setProgress(admin: any, jobId: string, stage: string, percent: number) {
  await admin.from('background_jobs').update({
    progress: { stage, percent, updatedAt: new Date().toISOString() },
    lease_expires_at: new Date(Date.now() + 240_000).toISOString(),
  }).eq('id', jobId);
}

async function finishDelivery(admin: any, deliveryId: string, status: string, errorMessage?: string) {
  await admin.from('webhook_deliveries').update({
    status,
    error_message: errorMessage?.slice(0, 1000) || null,
    completed_at: new Date().toISOString(),
  }).eq('provider', 'github').eq('delivery_id', deliveryId);
}
