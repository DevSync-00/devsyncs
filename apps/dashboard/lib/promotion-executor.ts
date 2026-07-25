import { Pool, PoolClient } from 'pg';
import { decryptSecret } from './secret-vault';
import { evaluateReleaseReadiness } from './release-readiness';
import { executionDecision } from './promotion-control';
import { enqueueTeamEvent } from './team-integrations';

export async function executePromotionJob(admin: any, promotionId: string, actorId: string, cancelled: () => Promise<boolean>) {
  const { data: promotion } = await admin
    .from('deployment_promotions')
    .select('*, project:projects(id), migration:migrations(id, content, scan_report:scan_reports(id, status, metadata)), target:project_environments!deployment_promotions_target_environment_id_fkey(id, name, tier, protected, requires_approval, connection_secret_id), rehearsal:migration_rehearsals(*)')
    .eq('id', promotionId)
    .single();
  if (!promotion) throw new Error('Promotion not found.');
  const { count } = await admin.from('promotion_approvals').select('id', { count: 'exact', head: true }).eq('promotion_id', promotion.id).eq('decision', 'approved');
  const readiness = evaluateReleaseReadiness({
    scanStatus: promotion.migration.scan_report?.status,
    changeSafety: promotion.migration.scan_report?.metadata?.changeSafety,
    impact: promotion.migration.scan_report?.metadata?.applicationImpact,
    rehearsal: promotion.rehearsal,
    target: promotion.target,
    approvalCount: count || 0,
  });
  const decision = executionDecision({
    status: promotion.status,
    decision: readiness.decision,
    gates: readiness.gates,
    approvalCount: count || 0,
    requiredApprovals: promotion.required_approvals || 0,
    confirmationText: promotion.confirmation_text,
    suppliedConfirmation: promotion.confirmation_text,
  });
  if (!decision.allowed) throw new Error(`Live gate revalidation failed: ${decision.reason}`);
  if (await cancelled()) throw new Error('Promotion execution was cancelled before database connection.');
  const { data: secret } = await admin.from('environment_secrets').select('encrypted_value, verification_status').eq('id', promotion.target.connection_secret_id).single();
  if (!secret || secret.verification_status !== 'verified') throw new Error('Target database connection is not verified.');

  const started = Date.now();
  await admin.from('deployment_promotions').update({ status: 'deploying', gates: readiness.gates, readiness_score: readiness.score, execution_requested_by: actorId }).eq('id', promotion.id).eq('status', 'queued');
  const pool = new Pool({ connectionString: decryptSecret(secret.encrypted_value), max: 1, connectionTimeoutMillis: 15_000 });
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const timeoutMs = Math.max(5_000, Number(process.env.PROMOTION_STATEMENT_TIMEOUT_MS || 120_000));
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = ${Math.floor(timeoutMs)}`);
    await client.query(`SET LOCAL lock_timeout = ${Math.min(15_000, Math.floor(timeoutMs / 4))}`);
    if (await cancelled()) throw new Error('Promotion execution was cancelled before SQL execution.');
    const result = await client.query(promotion.migration.content);
    await client.query('COMMIT');
    const metrics = { durationMs: Date.now() - started, rowCount: result.rowCount || 0, command: result.command || 'MULTI', completedAt: new Date().toISOString() };
    await admin.from('deployment_promotions').update({ status: 'deployed', deployed_at: metrics.completedAt, execution_metrics: metrics }).eq('id', promotion.id);
    await admin.from('project_environments').update({ status: 'healthy' }).eq('id', promotion.target.id);
    await enqueueTeamEvent(admin, {
      projectId: promotion.project.id,
      type: 'promotion.deployed',
      title: `Promotion deployed to ${promotion.target.name}`,
      message: `Migration completed in ${metrics.durationMs} ms with ${metrics.rowCount} affected rows.`,
      facts: metrics,
    });
    return { promotionId, readiness, metrics };
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => undefined);
    const message = error instanceof Error ? error.message : String(error);
    await admin.from('deployment_promotions').update({
      status: message.includes('cancelled') ? 'cancelled' : 'failed',
      execution_metrics: { durationMs: Date.now() - started, failedAt: new Date().toISOString(), error: message.slice(0, 1000) },
    }).eq('id', promotion.id);
    await enqueueTeamEvent(admin, {
      projectId: promotion.project.id,
      type: 'promotion.failed',
      title: `Promotion failed for ${promotion.target.name}`,
      message,
    }).catch(() => undefined);
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}
