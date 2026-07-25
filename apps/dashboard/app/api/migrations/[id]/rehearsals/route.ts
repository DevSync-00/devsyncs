import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '@/app/api/projects/utils';
import { analyzeMigrationRehearsal, buildDataAssertions } from '@/lib/rehearsal-engine';
import { withRateLimit } from '@/lib/rate-limit-middleware';
import { decryptSecret } from '@/lib/secret-vault';
import { getPreviewProvider } from '@/lib/preview-providers';
import { enqueueTeamEvent } from '@/lib/team-integrations';
import { getAdminClient } from '@/lib/supabase/admin';

const requestSchema = z.object({
  environmentId: z.string().uuid().nullable().optional(),
  strategy: z.enum(['schema-only', 'sampled-data', 'production-shaped']).default('schema-only'),
});

async function migrationWithAccess(supabase: any, migrationId: string, userId: string) {
  const { data: migration } = await supabase
    .from('migrations')
    .select('*, scan_report:scan_reports(project:projects(id, user_id, team_id))')
    .eq('id', migrationId)
    .single();
  const project = migration?.scan_report?.project;
  if (!migration || !project) return { migration: null, status: 404 };
  if (project.user_id === userId) return { migration, status: 200 };
  if (project.team_id) {
    const { data: isMember } = await supabase.rpc('check_team_membership', { team_uuid: project.team_id });
    if (isMember) return { migration, status: 200 };
  }
  return { migration: null, status: 403 };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const access = await migrationWithAccess(supabase, params.id, user.id);
    if (!access.migration) return NextResponse.json({ error: access.status === 404 ? 'Migration not found' : 'Access denied' }, { status: access.status });

    const { data, error } = await supabase
      .from('migration_rehearsals')
      .select('*, environment:project_environments(id, name, tier)')
      .eq('migration_id', params.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const projectId = access.migration.scan_report.project.id;
    const { data: previewEnvironments } = await supabase
      .from('project_environments')
      .select('id, name, tier, connection_secret_id, provider:environment_secrets(provider, verification_status, connection_preview)')
      .eq('project_id', projectId)
      .eq('tier', 'preview')
      .order('position');
    return NextResponse.json({
      rehearsals: data || [],
      previewEnvironments: (previewEnvironments || []).map((environment: any) => ({
        id: environment.id,
        name: environment.name,
        configured: Boolean(environment.connection_secret_id && environment.provider?.verification_status === 'verified'),
        provider: environment.provider?.provider || null,
        connectionPreview: environment.provider?.connection_preview || null,
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
    const access = await migrationWithAccess(supabase, params.id, user.id);
    if (!access.migration) return NextResponse.json({ error: access.status === 404 ? 'Migration not found' : 'Access denied' }, { status: access.status });

    const parsed = requestSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
    const now = new Date().toISOString();
    if (parsed.data.strategy !== 'schema-only') {
      if (!parsed.data.environmentId) {
        return NextResponse.json({ error: 'A preview environment is required for real rehearsal.' }, { status: 400 });
      }
      const projectId = access.migration.scan_report.project.id;
      const { data: environment } = await supabase
        .from('project_environments')
        .select('id, name, tier, project_id, connection_secret_id')
        .eq('id', parsed.data.environmentId)
        .eq('project_id', projectId)
        .single();
      if (!environment) return NextResponse.json({ error: 'Preview environment not found' }, { status: 404 });
      if (environment.tier !== 'preview') {
        return NextResponse.json({ error: 'Real rehearsals are restricted to environments with tier "preview".' }, { status: 422 });
      }
      if (!environment.connection_secret_id) {
        return NextResponse.json({ error: 'Configure and verify a preview provider first.' }, { status: 422 });
      }
      const { data: secret } = await supabase
        .from('environment_secrets')
        .select('provider, encrypted_value, verification_status')
        .eq('id', environment.connection_secret_id)
        .eq('environment_id', environment.id)
        .single();
      if (!secret || secret.verification_status !== 'verified') {
        return NextResponse.json({ error: 'Preview provider is missing or unverified.' }, { status: 422 });
      }

      const { data: baselines } = await supabase
        .from('query_baselines')
        .select('name, normalized_query, p95_ms')
        .eq('project_id', projectId)
        .or(`environment_id.eq.${environment.id},environment_id.is.null`)
        .not('normalized_query', 'is', null)
        .limit(20);
      const provider = getPreviewProvider(secret.provider);
      const queued = await supabase
        .from('migration_rehearsals')
        .insert({
          migration_id: params.id,
          environment_id: environment.id,
          requested_by: user.id,
          strategy: parsed.data.strategy,
          status: 'running',
          started_at: now,
          rollback_status: 'not_tested',
          metadata: { engineVersion: 1, provider: secret.provider, mode: 'real-preview' },
        })
        .select('id')
        .single();
      if (queued.error || !queued.data) return NextResponse.json({ error: queued.error?.message || 'Could not start rehearsal' }, { status: 500 });

      const result = await provider.rehearse({
        connectionString: decryptSecret(secret.encrypted_value),
        migrationSql: access.migration.content,
        rollbackSql: access.migration.rollback_content,
        assertions: buildDataAssertions(access.migration.content),
        queryBaselines: (baselines || []).map((baseline: any) => ({
          name: baseline.name,
          sql: baseline.normalized_query,
          maxDurationMs: baseline.p95_ms ? Math.max(50, Number(baseline.p95_ms) * 1.5) : undefined,
        })),
      });
      const { data, error } = await supabase
        .from('migration_rehearsals')
        .update({
          status: result.status,
          completed_at: new Date().toISOString(),
          execution_time_ms: result.executionTimeMs,
          rollback_status: result.rollbackStatus,
          query_results: result.queryResults,
          test_results: result.assertionResults,
          evidence: result.evidence,
          error_message: result.error || null,
          metadata: {
            engineVersion: 1,
            provider: result.provider,
            mode: 'real-preview',
            schemaBefore: result.schemaBefore,
            schemaDuring: result.schemaDuring,
            schemaAfter: result.schemaAfter,
            affectedRows: result.affectedRows,
          },
        })
        .eq('id', queued.data.id)
        .select('*, environment:project_environments(id, name, tier)')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (result.status === 'failed') {
        await enqueueTeamEvent(getAdminClient() as any, {
          projectId,
          type: 'rehearsal.failed',
          title: `Migration rehearsal failed in ${environment.name}`,
          message: result.error || result.evidence.join(' '),
          url: `${req.nextUrl.origin}/dashboard/projects/${projectId}`,
        }).catch(() => undefined);
      }
      return NextResponse.json({ rehearsal: data }, { status: 201 });
    }

    const analysis = analyzeMigrationRehearsal(access.migration.content, access.migration.rollback_content);
    const { data, error } = await supabase
      .from('migration_rehearsals')
      .insert({
        migration_id: params.id,
        environment_id: parsed.data.environmentId || null,
        requested_by: user.id,
        strategy: parsed.data.strategy,
        status: analysis.status,
        started_at: now,
        completed_at: now,
        execution_time_ms: analysis.executionTimeMs,
        rollback_status: analysis.rollbackStatus,
        lock_estimates: analysis.lockEstimates,
        test_results: analysis.checks,
        evidence: analysis.evidence,
        metadata: { engineVersion: 1, mode: 'static-preflight' },
      })
      .select('*, environment:project_environments(id, name, tier)')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ rehearsal: data }, { status: 201 });
  })(request);
}
