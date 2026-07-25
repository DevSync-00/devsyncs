import type { ManagedPreviewProvider, ManagedPreviewRequest, ManagedPreviewResource } from './types';

const BASE = 'https://console.neon.tech/api/v2';

export class NeonBranchPreviewProvider implements ManagedPreviewProvider {
  readonly id = 'neon-branch';

  async provision(request: ManagedPreviewRequest): Promise<ManagedPreviewResource> {
    const result = await neonRequest<any>(request.apiKey, `/projects/${encodeURIComponent(request.projectId)}/branches`, {
      method: 'POST',
      body: JSON.stringify({
        branch: {
          name: request.name.slice(0, 60),
          ...(request.parentBranchId ? { parent_id: request.parentBranchId } : {}),
          ...(request.expiresAt ? { expires_at: request.expiresAt } : {}),
        },
        endpoints: [{ type: 'read_write' }],
      }),
    });
    const branch = result.branch;
    const uri = result.connection_uris?.[0]?.connection_uri || result.connection_uri;
    if (!branch?.id || !uri) {
      if (branch?.id) await this.destroy({ apiKey: request.apiKey, projectId: request.projectId }, branch.id).catch(() => undefined);
      throw new Error('Neon created the branch but did not return a connection URI. Verify the project role and database configuration.');
    }
    return {
      resourceId: branch.id,
      connectionString: uri,
      status: 'ready',
      metadata: { provider: this.id, projectId: request.projectId, branchName: branch.name, endpointId: result.endpoints?.[0]?.id || null },
    };
  }

  async status(credentials: { apiKey: string; projectId: string }, resourceId: string) {
    try {
      const result = await neonRequest<any>(credentials.apiKey, `/projects/${encodeURIComponent(credentials.projectId)}/branches/${encodeURIComponent(resourceId)}`);
      return {
        status: result.branch?.current_state === 'ready' || !result.branch?.current_state ? 'ready' as const : 'provisioning' as const,
        metadata: { branchName: result.branch?.name, state: result.branch?.current_state || 'ready', updatedAt: result.branch?.updated_at },
      };
    } catch (error) {
      if (error instanceof ProviderHttpError && error.status === 404) return { status: 'deleted' as const };
      throw error;
    }
  }

  async destroy(credentials: { apiKey: string; projectId: string }, resourceId: string) {
    await neonRequest(credentials.apiKey, `/projects/${encodeURIComponent(credentials.projectId)}/branches/${encodeURIComponent(resourceId)}`, { method: 'DELETE' });
  }
}

class ProviderHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function neonRequest<T>(apiKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as any;
      throw new ProviderHttpError(response.status, body.message || body.error || `Neon API request failed (${response.status}).`);
    }
    if (response.status === 204) return {} as T;
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}
