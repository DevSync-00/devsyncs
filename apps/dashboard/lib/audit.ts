import { createHash } from 'crypto';

export async function appendAuditEvent(
  admin: any,
  event: {
    projectId?: string | null;
    teamId?: string | null;
    actorId?: string | null;
    actorType: 'user' | 'github' | 'system' | 'ai';
    action: string;
    resourceType: string;
    resourceId?: string | null;
    outcome: 'success' | 'denied' | 'failed' | 'pending';
    evidence?: Record<string, unknown>;
    sourceIp?: string | null;
    userAgent?: string | null;
  },
) {
  const scopeFilter = [
      event.projectId ? `project_id.eq.${event.projectId}` : '',
      event.teamId ? `team_id.eq.${event.teamId}` : '',
    ].filter(Boolean).join(',');
  let previousQuery = admin
    .from('audit_events')
    .select('event_hash')
    .order('created_at', { ascending: false })
    .limit(1);
  if (scopeFilter) previousQuery = previousQuery.or(scopeFilter);
  const { data: previous } = await previousQuery.maybeSingle();
  const createdAt = new Date().toISOString();
  const previousHash = previous?.event_hash || null;
  const canonical = JSON.stringify({
    projectId: event.projectId || null,
    teamId: event.teamId || null,
    actorId: event.actorId || null,
    actorType: event.actorType,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId || null,
    outcome: event.outcome,
    evidence: event.evidence || {},
    previousHash,
    createdAt,
  });
  const eventHash = createHash('sha256').update(canonical).digest('hex');
  const sourceIpHash = event.sourceIp
    ? createHash('sha256').update(event.sourceIp).digest('hex')
    : null;
  return admin.from('audit_events').insert({
    project_id: event.projectId || null,
    team_id: event.teamId || null,
    actor_id: event.actorId || null,
    actor_type: event.actorType,
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId || null,
    outcome: event.outcome,
    evidence: event.evidence || {},
    source_ip_hash: sourceIpHash,
    user_agent: event.userAgent?.slice(0, 300) || null,
    previous_hash: previousHash,
    event_hash: eventHash,
    created_at: createdAt,
  });
}
