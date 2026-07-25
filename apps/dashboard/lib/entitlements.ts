export type Plan = 'free' | 'team' | 'enterprise';
export const planCatalog = {
  free: {
    features: { sso: false, scim: false, auditExport: false, managedPreviews: false, customRetention: false },
    limits: { projects: 3, members: 5, scansPerMonth: 100, managedPreviewHours: 0 },
  },
  team: {
    features: { sso: false, scim: false, auditExport: true, managedPreviews: true, customRetention: false },
    limits: { projects: 25, members: 25, scansPerMonth: 2500, managedPreviewHours: 250 },
  },
  enterprise: {
    features: { sso: true, scim: true, auditExport: true, managedPreviews: true, customRetention: true },
    limits: { projects: -1, members: -1, scansPerMonth: -1, managedPreviewHours: -1 },
  },
} satisfies Record<Plan, { features: Record<string, boolean>; limits: Record<string, number> }>;

export function effectiveEntitlements(record?: any) {
  const plan = (record?.plan || 'free') as Plan;
  const base = planCatalog[plan] || planCatalog.free;
  const active = ['active', 'trialing'].includes(record?.status || 'active');
  return {
    plan, status: record?.status || 'active', active,
    features: active ? { ...base.features, ...(record?.features || {}) } : planCatalog.free.features,
    limits: active ? { ...base.limits, ...(record?.limits || {}) } : planCatalog.free.limits,
  };
}

export function assertFeature(entitlements: ReturnType<typeof effectiveEntitlements>, feature: string) {
  if (!entitlements.features[feature]) throw new EntitlementError(`${feature} requires a higher plan.`);
}

export function assertWithinLimit(limit: number, used: number, label: string) {
  if (limit >= 0 && used >= limit) throw new EntitlementError(`${label} limit reached (${used}/${limit}).`);
}

export class EntitlementError extends Error {
  status = 402;
}

export async function loadTeamEntitlements(client: any, teamId: string) {
  const { data } = await client.from('team_entitlements').select('*').eq('team_id', teamId).maybeSingle();
  return effectiveEntitlements(data);
}

export async function recordUsage(admin: any, event: {
  teamId?: string | null; projectId?: string | null; metric: string; quantity?: number; idempotencyKey: string; metadata?: Record<string, unknown>;
}) {
  return admin.from('usage_events').insert({
    team_id: event.teamId || null, project_id: event.projectId || null, metric: event.metric,
    quantity: event.quantity || 1, idempotency_key: event.idempotencyKey, metadata: event.metadata || {},
  });
}
