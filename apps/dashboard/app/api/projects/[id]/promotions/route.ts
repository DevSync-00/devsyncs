import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '@/app/api/projects/utils';
import { evaluateReleaseReadiness } from '@/lib/release-readiness';
import { withRateLimit } from '@/lib/rate-limit-middleware';
import { approvalRequirement } from '@/lib/promotion-control';
import { enqueueTeamEvent } from '@/lib/team-integrations';
import { getAdminClient } from '@/lib/supabase/admin';

const promotionSchema = z.object({
  targetEnvironmentId: z.string().uuid(),
  migrationId: z.string().uuid().optional(),
  sourceEnvironmentId: z.string().uuid().nullable().optional(),
});

async function projectAccess(supabase: any, projectId: string, userId: string) {
  const { data: project } = await supabase
    .from('projects')
    .select('id, user_id, team_id')
    .eq('id', projectId)
    .single();
  if (!project) return { project: null, status: 404 };
  if (project.user_id === userId) return { project, status: 200 };
  if (project.team_id) {
    const { data: isMember } = await supabase.rpc('check_team_membership', { team_uuid: project.team_id });
    if (isMember) return { project, status: 200 };
  }
  return { project: null, status: 403 };
}

async function latestMigration(supabase: any, projectId: string, migrationId?: string) {
  let query = supabase
    .from('migrations')
    .select('id, filename, name, created_at, execution_status, scan_report:scan_reports!inner(id, project_id, status, metadata)')
    .eq('scan_report.project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (migrationId) query = query.eq('id', migrationId);
  const { data } = await query.maybeSingle();
  return data || null;
}

async function latestRehearsal(supabase: any, migrationId: string) {
  const { data } = await supabase
    .from('migration_rehearsals')
    .select('*')
    .eq('migration_id', migrationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

function readinessFor(environment: any, migration: any, rehearsal: any, approvalCount = 0) {
  const metadata = migration?.scan_report?.metadata || {};
  return evaluateReleaseReadiness({
    scanStatus: migration?.scan_report?.status,
    changeSafety: metadata.changeSafety,
    impact: metadata.applicationImpact,
    rehearsal,
    target: {
      id: environment.id,
      name: environment.name,
      tier: environment.tier,
      protected: environment.protected,
      requires_approval: environment.requires_approval,
    },
    approvalCount,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const access = await projectAccess(supabase, params.id, user.id);
    if (!access.project) return NextResponse.json({ error: access.status === 404 ? 'Project not found' : 'Access denied' }, { status: access.status });

    const migration = await latestMigration(supabase, params.id, req.nextUrl.searchParams.get('migrationId') || undefined);
    const { data: environments, error } = await supabase
      .from('project_environments')
      .select('*')
      .eq('project_id', params.id)
      .order('position');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rehearsal = migration ? await latestRehearsal(supabase, migration.id) : null;

    const { data: activePromotions } = await supabase
      .from('deployment_promotions')
      .select('*, approvals:promotion_approvals(id)')
      .eq('project_id', params.id)
      .in('status', ['draft', 'awaiting_approval', 'approved', 'deploying']);
    const activeByTarget = new Map((activePromotions || []).map((promotion: any) => [promotion.target_environment_id, promotion]));

    return NextResponse.json({
      migration,
      rehearsal,
      targets: (environments || []).map((environment: any) => ({
        environment,
        readiness: readinessFor(
          environment,
          migration,
          rehearsal,
          activeByTarget.get(environment.id)?.approvals?.length || 0,
        ),
        promotion: activeByTarget.get(environment.id) || null,
      })),
    });
  })(request);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const access = await projectAccess(supabase, params.id, user.id);
    if (!access.project) return NextResponse.json({ error: access.status === 404 ? 'Project not found' : 'Access denied' }, { status: access.status });

    const parsed = promotionSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid promotion' }, { status: 400 });
    const { data: environment } = await supabase
      .from('project_environments')
      .select('*')
      .eq('id', parsed.data.targetEnvironmentId)
      .eq('project_id', params.id)
      .single();
    if (!environment) return NextResponse.json({ error: 'Target environment not found' }, { status: 404 });

    const migration = await latestMigration(supabase, params.id, parsed.data.migrationId);
    if (!migration) return NextResponse.json({ error: 'No migration is available to promote' }, { status: 404 });
    const rehearsal = await latestRehearsal(supabase, migration.id);
    const riskScore = Number(migration.scan_report?.metadata?.applicationImpact?.summary?.score || 0);
    const controls = approvalRequirement({ riskScore, protected: environment.protected, tier: environment.tier });
    const readiness = readinessFor(environment, migration, rehearsal, 0);
    const status = readiness.decision === 'blocked'
      ? 'blocked'
      : readiness.decision === 'approval_required'
        ? 'awaiting_approval'
        : 'approved';

    const record = {
      project_id: params.id,
      migration_id: migration.id,
      source_environment_id: parsed.data.sourceEnvironmentId || null,
      target_environment_id: environment.id,
      rehearsal_id: rehearsal?.id || null,
      requested_by: user.id,
      status,
      readiness_score: readiness.score,
      decision: readiness.decision,
      gates: readiness.gates,
      evidence: readiness.gates.flatMap((gate) => gate.evidence || []),
      execution_plan: {
        mode: 'explicit',
        target: environment.slug,
        steps: ['revalidate-gates', 'acquire-deployment-lock', 'execute-migration', 'verify-schema', 'record-audit-event'],
      },
      required_approvals: controls.requiredApprovals,
      separation_of_duties: controls.separationOfDuties,
      confirmation_text: controls.confirmationText,
    };
    const { data: existing } = await supabase
      .from('deployment_promotions')
      .select('id')
      .eq('migration_id', migration.id)
      .eq('target_environment_id', environment.id)
      .in('status', ['draft', 'blocked', 'awaiting_approval', 'approved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const mutation = existing
      ? supabase.from('deployment_promotions').update(record).eq('id', existing.id)
      : supabase.from('deployment_promotions').insert(record);
    const { data, error } = await mutation.select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data.status === 'awaiting_approval') {
      await enqueueTeamEvent(getAdminClient() as any, {
        projectId: params.id,
        type: 'approval.requested',
        title: `Approval requested for ${environment.name}`,
        message: `${controls.requiredApprovals} approval${controls.requiredApprovals === 1 ? '' : 's'} required for migration ${migration.filename || migration.name || migration.id}.`,
        url: `${req.nextUrl.origin}/dashboard/projects/${params.id}`,
      }).catch(() => undefined);
    }
    return NextResponse.json({ promotion: data, readiness }, { status: 201 });
  })(request);
}
