export interface PreviewRehearsalRequest {
  connectionString: string;
  migrationSql: string;
  rollbackSql?: string | null;
  assertions?: Array<{ name: string; sql: string; expected: 'zero' | 'nonzero' }>;
  queryBaselines?: Array<{ name: string; sql: string; maxDurationMs?: number }>;
}

export interface PreviewRehearsalResult {
  provider: string;
  status: 'passed' | 'failed';
  executionTimeMs: number;
  rollbackStatus: 'passed' | 'failed';
  schemaBefore: string;
  schemaDuring?: string;
  schemaAfter: string;
  affectedRows: number;
  assertionResults: Array<{
    name: string;
    status: 'passed' | 'failed';
    value?: number;
    durationMs: number;
    error?: string;
  }>;
  queryResults: Array<{
    name: string;
    status: 'passed' | 'failed';
    durationMs: number;
    rowCount?: number;
    error?: string;
  }>;
  evidence: string[];
  error?: string;
}

export interface PreviewProvider {
  readonly id: string;
  verify(connectionString: string): Promise<{ version: string; database: string }>;
  rehearse(request: PreviewRehearsalRequest): Promise<PreviewRehearsalResult>;
}

export interface ManagedPreviewRequest {
  apiKey: string;
  projectId: string;
  name: string;
  parentBranchId?: string;
  database?: string;
  role?: string;
  expiresAt?: string;
}

export interface ManagedPreviewResource {
  resourceId: string;
  connectionString: string;
  status: 'provisioning' | 'ready';
  metadata: Record<string, unknown>;
}

export interface ManagedPreviewProvider {
  readonly id: string;
  provision(request: ManagedPreviewRequest): Promise<ManagedPreviewResource>;
  status(credentials: { apiKey: string; projectId: string }, resourceId: string): Promise<{ status: 'provisioning' | 'ready' | 'failed' | 'deleted'; metadata?: Record<string, unknown> }>;
  destroy(credentials: { apiKey: string; projectId: string }, resourceId: string): Promise<void>;
}
