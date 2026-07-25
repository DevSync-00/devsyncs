import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createGitHubCheckRun, createPullRequestReviewToken } from '@/lib/github-app';
import { ensureGitClone } from '@/lib/codebase-storage';
import {
  analyzeApplicationImpact,
  compareSchemas,
  scanCodebaseSchema,
  scanDatabaseSchema,
} from '@/lib/schema-scanner';
import { evaluateChangeSafety } from '@/lib/change-intelligence';
import { evaluatePolicy, recommendedPolicyRules } from '@/lib/policy-engine';
import { appendAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supportedActions = new Set(['opened', 'synchronize', 'reopened', 'ready_for_review']);

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const deliveryId = request.headers.get('x-github-delivery') || '';
  const eventType = request.headers.get('x-github-event') || '';
  if (!verifyGitHubSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }
  if (!deliveryId) return NextResponse.json({ error: 'Missing delivery ID' }, { status: 400 });

  const admin = getAdminClient() as any;
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const deliveryRecord = {
    provider: 'github',
    delivery_id: deliveryId,
    event_type: eventType,
    action: payload.action || null,
    installation_id: payload.installation?.id || null,
    repository: payload.repository?.full_name || null,
    status: 'processing',
    metadata: { sender: payload.sender?.login || null },
  };
  const { error: deliveryError } = await admin
    .from('webhook_deliveries')
    .insert(deliveryRecord);
  if (deliveryError?.code === '23505') {
    return NextResponse.json({ accepted: true, duplicate: true });
  }
  if (deliveryError) return NextResponse.json({ error: 'Webhook storage unavailable' }, { status: 503 });

  if (eventType !== 'pull_request' || !supportedActions.has(payload.action) || payload.pull_request?.draft) {
    await finishDelivery(admin, deliveryId, 'ignored');
    return NextResponse.json({ accepted: true, ignored: true });
  }

  const repository = payload.repository.full_name;
  const pullNumber = Number(payload.pull_request.number);
  const headSha = payload.pull_request.head.sha;
  await admin
    .from('background_jobs')
    .update({ cancel_requested: true, status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('job_type', 'github_pr_review')
    .eq('payload->>repository', repository)
    .eq('payload->>pullNumber', String(pullNumber))
    .in('status', ['queued', 'retry']);
  await admin
    .from('background_jobs')
    .update({ cancel_requested: true })
    .eq('job_type', 'github_pr_review')
    .eq('payload->>repository', repository)
    .eq('payload->>pullNumber', String(pullNumber))
    .eq('status', 'running');

  const { data: job, error: jobError } = await admin
    .from('background_jobs')
    .insert({
      job_type: 'github_pr_review',
      deduplication_key: `github:${repository}:pr:${pullNumber}:${headSha}`,
      priority: 50,
      payload: { deliveryId, origin: request.nextUrl.origin, repository, pullNumber, headSha, webhook: payload },
      progress: { stage: 'queued', percent: 0 },
    })
    .select('id')
    .single();
  if (jobError) {
    await finishDelivery(admin, deliveryId, 'failed', jobError.message);
    return NextResponse.json({ error: 'Unable to enqueue review' }, { status: 503 });
  }
  return NextResponse.json({ accepted: true, queued: true, jobId: job.id }, { status: 202 });
}

export async function PUT(request: NextRequest) {
  const expected = process.env.DEVSYNC_WORKER_SECRET || process.env.CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  try {
    const result = await reviewPullRequest(getAdminClient() as any, body.webhook, body.origin);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

async function reviewPullRequest(admin: any, payload: any, origin: string) {
  const repositoryFullName = payload.repository.full_name as string;
  const [owner, repository] = repositoryFullName.split('/');
  const repositoryUrl = payload.repository.html_url as string;
  const headSha = payload.pull_request.head.sha as string;
  const baseSha = payload.pull_request.base.sha as string;
  const pullNumber = Number(payload.pull_request.number);
  const installationId = Number(payload.installation?.id);
  if (!owner || !repository || !headSha || !installationId) throw new Error('Incomplete pull request webhook payload.');

  const { data: projects, error: projectError } = await admin
    .from('projects')
    .select('*')
    .contains('config', { codebase: { url: repositoryUrl } });
  if (projectError) throw projectError;
  const project = (projects || [])[0];
  if (!project) throw new Error(`No DevSync project is connected to ${repositoryFullName}.`);
  if (!project.db_connection_string) throw new Error('The connected DevSync project has no database connection.');

  const token = await createPullRequestReviewToken(installationId, repository);
  const cloneKey = `${project.id}-pr-${pullNumber}-${headSha.slice(0, 10)}`;
  const clonePath = await ensureGitClone(cloneKey, repositoryUrl, null, token, headSha);
  const codeSchema = scanCodebaseSchema(clonePath);
  const dbSchema = await scanDatabaseSchema(project.db_connection_string);
  const mismatches = compareSchemas(codeSchema, dbSchema);
  const impact = analyzeApplicationImpact(clonePath, codeSchema, mismatches);
  const safety = evaluateChangeSafety(mismatches, dbSchema, impact);

  const { data: policies } = await admin
    .from('change_policies')
    .select('*')
    .eq('enabled', true)
    .or([
      `project_id.eq.${project.id}`,
      project.team_id ? `team_id.eq.${project.team_id}` : '',
    ].filter(Boolean).join(','));
  const effectivePolicies = policies?.length
    ? policies
    : [{ id: 'recommended', name: 'Recommended safety policy', enforcement: 'warn', rules: recommendedPolicyRules }];
  const policyResults = effectivePolicies.map((policy: any) => ({
    policyId: policy.id,
    name: policy.name,
    enforcement: policy.enforcement,
    result: evaluatePolicy(
      Array.isArray(policy.rules) ? policy.rules : recommendedPolicyRules,
      {
        riskScore: impact.summary.score,
        breakingChanges: impact.summary.breakingChanges,
        ownerCoveragePercent: impact.summary.ownerCoveragePercent,
        testEvidenceFiles: impact.summary.testCoverageFiles,
        affectedFiles: impact.summary.affectedFiles,
      },
      policy.enforcement,
    ),
  }));
  const policyBlocked = policyResults.some((item: any) => item.result.status === 'blocked');
  const conclusion = safety.decision === 'block' || policyBlocked ? 'failure' : safety.decision === 'review' ? 'action_required' : 'success';
  const reviewStatus = conclusion === 'success' ? 'passed' : 'changes_requested';

  const metadata = {
    mode: 'github-pull-request',
    github: {
      repository: repositoryFullName,
      pullRequestNumber: pullNumber,
      headSha,
      baseSha,
      url: payload.pull_request.html_url,
      author: payload.pull_request.user?.login,
    },
    counts: {
      codeTables: codeSchema.metadata.tableCount,
      dbTables: dbSchema.metadata.tableCount,
      mismatches: mismatches.length,
    },
    applicationImpact: impact,
    changeSafety: safety,
    policyResults,
  };
  const { data: scanReport, error: scanError } = await admin
    .from('scan_reports')
    .insert({
      project_id: project.id,
      status: 'completed',
      mismatches,
      code_schema: codeSchema,
      db_schema: dbSchema,
      metadata,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (scanError) throw scanError;

  await admin
    .from('pull_request_reviews')
    .update({ status: 'superseded' })
    .eq('provider', 'github')
    .eq('repository', repositoryFullName)
    .eq('pull_request_number', pullNumber)
    .neq('head_sha', headSha)
    .in('status', ['pending', 'passed', 'changes_requested']);

  const detailsUrl = `${origin}/dashboard/projects/${project.id}/scan-reports/${scanReport.id}`;
  const output = buildCheckOutput({
    projectName: project.name,
    mismatchCount: mismatches.length,
    impact,
    safety,
    policyResults,
    detailsUrl,
  });
  const checkRun = await createGitHubCheckRun({
    token,
    owner,
    repository,
    headSha,
    status: 'completed',
    conclusion,
    title: output.title,
    summary: output.summary,
    text: output.text,
    detailsUrl,
  });

  const { data: review, error: reviewError } = await admin
    .from('pull_request_reviews')
    .upsert({
      project_id: project.id,
      scan_report_id: scanReport.id,
      provider: 'github',
      repository: repositoryFullName,
      pull_request_number: pullNumber,
      head_sha: headSha,
      base_sha: baseSha,
      status: reviewStatus,
      risk_score: impact.summary.score,
      summary: {
        conclusion,
        mismatchCount: mismatches.length,
        safetyDecision: safety.decision,
        breakingChanges: impact.summary.breakingChanges,
        affectedFiles: impact.summary.affectedFiles,
        policyResults,
      },
      check_run_id: String(checkRun.id),
    }, { onConflict: 'provider,repository,pull_request_number,head_sha' })
    .select()
    .single();
  if (reviewError) throw reviewError;

  await appendAuditEvent(admin, {
    projectId: project.id,
    teamId: project.team_id,
    actorType: 'github',
    action: 'pull_request.review.completed',
    resourceType: 'pull_request_review',
    resourceId: review.id,
    outcome: conclusion === 'success' ? 'success' : 'denied',
    evidence: {
      repository: repositoryFullName,
      pullRequestNumber: pullNumber,
      headSha,
      riskScore: impact.summary.score,
      conclusion,
      checkRunId: checkRun.id,
    },
  });

  return { reviewId: review.id, conclusion };
}

function buildCheckOutput(input: {
  projectName: string;
  mismatchCount: number;
  impact: any;
  safety: any;
  policyResults: any[];
  detailsUrl: string;
}) {
  const failedPolicies = input.policyResults.flatMap((policy) =>
    policy.result.violations.map((violation: any) => `- **${policy.name}:** ${violation.message}`),
  );
  const topFindings = input.impact.findings.slice(0, 8).map((finding: any) =>
    `- \`${finding.object}\` — **${finding.risk}** (${finding.score}/100), ${finding.references.length} references`,
  );
  return {
    title: input.safety.decision === 'block'
      ? 'Database change is unsafe to merge'
      : input.safety.decision === 'review'
        ? 'Database change needs human review'
        : 'Database safety checks passed',
    summary: [
      `### DevSync review for ${input.projectName}`,
      '',
      `| Risk | Drift | Breaking | Files | Owner coverage |`,
      `|---:|---:|---:|---:|---:|`,
      `| **${input.impact.summary.score}/100** | ${input.mismatchCount} | ${input.impact.summary.breakingChanges} | ${input.impact.summary.affectedFiles} | ${input.impact.summary.ownerCoveragePercent}% |`,
      '',
      input.safety.decision === 'block' ? '⛔ **Merge blocked by deterministic safety gates.**' : 'Review the evidence before merging.',
      '',
      `[Open the full visual impact report](${input.detailsUrl})`,
    ].join('\n'),
    text: [
      '### Highest-impact database objects',
      ...(topFindings.length ? topFindings : ['- No changed database objects found.']),
      '',
      '### Policy findings',
      ...(failedPolicies.length ? failedPolicies : ['- All evaluated policies passed.']),
    ].join('\n'),
  };
}

function verifyGitHubSignature(body: string, signature: string | null) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!secret || !signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

async function finishDelivery(admin: any, deliveryId: string, status: string, errorMessage?: string) {
  await admin
    .from('webhook_deliveries')
    .update({
      status,
      error_message: errorMessage?.slice(0, 1000) || null,
      completed_at: new Date().toISOString(),
    })
    .eq('provider', 'github')
    .eq('delivery_id', deliveryId);
}
