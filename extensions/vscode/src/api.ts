import { requestJson } from './lib/http';
import { ScannedSchema, SchemaValue } from './types/schema';
import type { IConfigurationManager } from './interfaces';

/**
 * Represents a scan report containing schema comparison results.
 * 
 * A scan report is generated when comparing a Prisma schema with an actual database.
 * It contains all detected mismatches and the schemas used for comparison.
 * 
 * @example
 * ```typescript
 * const report: ScanReport = {
 *   id: 'scan-123',
 *   projectId: 'proj-456',
 *   status: 'completed',
 *   mismatches: [
 *     { type: 'missing_field', model: 'User', field: 'email', severity: 'error' }
 *   ],
 *   created_at: '2024-01-01T00:00:00Z',
 *   completed_at: '2024-01-01T00:01:00Z'
 * };
 * ```
 */
export interface ScanReport {
  /** Unique identifier for the scan report */
  id: string;
  /** Project identifier this scan belongs to */
  projectId: string;
  /** Current status of the scan */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Array of detected schema mismatches */
  mismatches: Mismatch[];
  /** Optional Prisma schema models extracted from code */
  codeSchema?: ScannedSchema;
  /** Optional database schema tables extracted from database */
  dbSchema?: ScannedSchema;
  /** ISO 8601 timestamp when the scan was created */
  created_at: string;
  /** ISO 8601 timestamp when the scan completed, or null if still running */
  completed_at?: string | null;
}

/**
 * Discriminated union for mismatch types
 */
export type Mismatch = 
  | MissingTableMismatch
  | ExtraTableMismatch
  | MissingFieldMismatch
  | TypeMismatch
  | NullableMismatch
  | ExtraFieldMismatch
  | MissingRelationshipMismatch
  | ExtraRelationshipMismatch
  | ConstraintMismatch;

/**
 * Base mismatch interface
 */
interface BaseMismatch {
  model: string;
  table?: string;
  column?: string;
  message?: string;
  severity: 'error' | 'warning' | 'info';
  suggestedFix?: string;
}

/**
 * Missing table mismatch
 */
export interface MissingTableMismatch extends BaseMismatch {
  type: 'missing_table';
  codeValue?: SchemaValue;
  dbValue?: SchemaValue;
}

/** Extra table mismatch */
export interface ExtraTableMismatch extends BaseMismatch {
  type: 'extra_table';
  codeValue?: SchemaValue;
  dbValue?: SchemaValue;
}

/**
 * Missing field mismatch
 */
export interface MissingFieldMismatch extends BaseMismatch {
  type: 'missing_field';
  field: string;
  codeValue?: SchemaValue;
  dbValue?: SchemaValue;
}

/**
 * Type mismatch
 */
export interface TypeMismatch extends BaseMismatch {
  type: 'type_mismatch';
  field: string;
  codeValue: SchemaValue;
  dbValue: SchemaValue;
}

/** Column nullability mismatch */
export interface NullableMismatch extends BaseMismatch {
  type: 'nullable_mismatch';
  field: string;
  codeValue: SchemaValue;
  dbValue: SchemaValue;
}

/**
 * Extra field mismatch
 */
export interface ExtraFieldMismatch extends BaseMismatch {
  type: 'extra_field';
  field: string;
  codeValue?: SchemaValue;
  dbValue: SchemaValue;
}

/** Relationship present in code but missing from the database */
export interface MissingRelationshipMismatch extends BaseMismatch {
  type: 'missing_relationship';
  field: string;
  codeValue?: SchemaValue;
  dbValue?: SchemaValue;
}

/** Relationship present in the database but missing from code */
export interface ExtraRelationshipMismatch extends BaseMismatch {
  type: 'extra_relationship';
  field: string;
  codeValue?: SchemaValue;
  dbValue?: SchemaValue;
}

/**
 * Constraint mismatch
 */
export interface ConstraintMismatch extends BaseMismatch {
  type: 'constraint_mismatch';
  field?: string;
  codeValue?: SchemaValue;
  dbValue?: SchemaValue;
}

/**
 * Represents a database migration generated from schema mismatches.
 * 
 * Migrations contain SQL or other database-specific code to synchronize
 * the database schema with the Prisma schema definition.
 * 
 * @example
 * ```typescript
 * const migration: Migration = {
 *   id: 'mig-123',
 *   filename: 'migration_2024-01-01.sql',
 *   content: 'ALTER TABLE "User" ADD COLUMN "email" TEXT;',
 *   format: 'sql',
 *   applied: false,
 *   created_at: '2024-01-01T00:00:00Z'
 * };
 * ```
 */
export interface Migration {
  /** Unique identifier for the migration */
  id: string;
  /** Suggested filename for the migration file */
  filename: string;
  /** Migration content (SQL, Prisma migration format, etc.) */
  content: string;
  /** Format of the migration (e.g., 'sql', 'prisma') */
  format: string;
  /** Whether this migration has been applied to the database */
  applied: boolean;
  /** ISO 8601 timestamp when the migration was created */
  created_at: string;
  /** Validation results if migration was validated */
  validation?: {
    valid: boolean;
    errors: Array<{
      type: string;
      severity: 'error';
      message: string;
      line?: number;
      suggestion?: string;
    }>;
    warnings: Array<{
      type: string;
      severity: 'warning' | 'info';
      message: string;
      line?: number;
      suggestion?: string;
    }>;
    breakingChanges: Array<{
      type: string;
      severity: 'error' | 'warning';
      message: string;
      affectedTable?: string;
      affectedColumn?: string;
      line?: number;
      impact?: string;
      mitigation?: string;
    }>;
    summary: {
      totalIssues: number;
      errorCount: number;
      warningCount: number;
      breakingChangeCount: number;
    };
  } | null;
}

import { IApiClient, IAuthManager } from './interfaces';

/**
 * API client for interacting with the DevSync dashboard API.
 * 
 * Handles HTTP requests to the DevSync service for scanning, migration generation,
 * and report retrieval. All responses are validated using runtime type checking.
 * 
 * @example
 * ```typescript
 * const client = new DevSyncApiClient(
 *   'https://api.Dev-Sync.dev',
 *   'your-api-key',
 *   'project-id'
 * );
 * const report = await client.scan('/path/to/project');
 * ```
 */
export class DevSyncApiClient implements IApiClient {
  private configManager?: IConfigurationManager;
  
  /**
   * Creates a new API client instance.
   * 
   * @param apiUrl - Base URL of the DevSync API
   * @param apiKey - API key for authentication
   * @param projectId - Project identifier (optional, can be set later)
   * @param configManager - Optional configuration manager for dynamic config reading
   */
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private projectId: string = '',
    configManager?: IConfigurationManager,
    private readonly authManager?: IAuthManager
  ) {
    this.configManager = configManager;
  }
  
  /**
   * Sets the project ID for this client instance.
   */
  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }
  
  /**
   * Gets the current project ID.
   */
  getProjectId(): string {
    return this.projectId;
  }
  
  /**
   * Gets the current API key, reading from config manager if available.
   */
  private getApiKey(): string {
    if (this.configManager) {
      const config = this.configManager.getAll();
      return config.apiKey || this.apiKey;
    }
    return this.apiKey;
  }
  
  /**
   * Gets the current API URL, reading from config manager if available.
   */
  private getApiUrl(): string {
    let value: string;
    if (this.configManager) {
      const config = this.configManager.getAll();
      value = config.apiUrl || this.apiUrl;
    } else {
      value = this.apiUrl;
    }
    const normalized = value.trim().replace(/\/+$/, '');
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname === 'dev-sync.dev') {
        parsed.hostname = 'www.dev-sync.dev';
      }
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      return normalized;
    }
  }

  /**
   * Scans a project for schema mismatches between code and database.
   * 
   * Triggers a scan on the DevSync API which compares the Prisma schema
   * with the actual database schema. The response is validated using runtime
   * type checking to ensure type safety.
   * 
   * @param projectPath - The path to the project root directory
   * @param databaseConnection - Optional database connection string for direct database access
   * @returns Promise resolving to a validated scan report
   * @throws {Error} If the API request fails or response validation fails
   * 
   * @example
   * ```typescript
   * const report = await client.scan(
   *   '/path/to/project',
   *   'postgresql://user:pass@localhost:5432/db'
   * );
   * console.log(`Found ${report.mismatches.length} mismatches`);
   * ```
   */
  async scan(projectPath: string, databaseConnection?: string): Promise<ScanReport> {
    if (!this.projectId) {
      throw new Error('Project ID is required. Please set devsync.projectId or save your project to DevSync first.');
    }
    
    // Check API key before making request
    // Check API URL
    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      throw new Error('API URL is required. Please configure devsync.apiUrl in your settings.');
    }
    
    try {
    // For now, we'll trigger a scan via API
    // In the future, this could use the CLI directly
    const response = await this.post<ScanReport>('/api/scans', {
      projectId: this.projectId,
      path: projectPath,
      databaseConnection,
    });
    
    // Validate response with runtime validation
    const { validateScanReport } = await import('./types/validation');
    return validateScanReport(this.normalizeScanReport(response));
    } catch (error: any) {
      // Provide better error messages for authentication failures
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          throw new Error('Unauthorized: Please sign in to DevSync. Your API key may be missing, invalid, or expired. Run "devsync login" or use "DevSync: Sign In" command.');
        }
        // Re-throw with original message
        throw error;
      }
      throw error;
    }
  }

  async getScanReports(limit: number = 10): Promise<ScanReport[]> {
    const response = await this.get<{ scanReports?: unknown[] }>(
      '/api/scans',
      {
        projectId: this.projectId,
        limit: String(limit),
      }
    );

    // Validate each scan report
    const { validateScanReport } = await import('./types/validation');
    return (response.scanReports || []).map((report) => validateScanReport(this.normalizeScanReport(report)));
  }

  async getLatestScanReport(): Promise<ScanReport | null> {
    const reports = await this.getScanReports(1);
    return reports.length > 0 ? reports[0] : null;
  }

  async generateMigration(scanReportId: string, format: string = 'sql'): Promise<Migration> {
    const response = await this.post<Migration>('/api/migrations', {
      scanReportId,
      format,
    });
    
    // Validate response with runtime validation
    const { validateMigration } = await import('./types/validation');
    return validateMigration(response);
  }

  async getMigrations(scanReportId?: string): Promise<Migration[]> {
    const params: Record<string, string> = { projectId: this.projectId };
    if (scanReportId) {
      params.scanReportId = scanReportId;
    }

    const response = await this.get<{ migrations?: unknown[] }>(
      '/api/migrations',
      params
    );
    
    // Validate each migration
    const { validateMigration } = await import('./types/validation');
    return (response.migrations || []).map((migration) => validateMigration(migration));
  }

  async getMigration(migrationId: string): Promise<Migration | null> {
    const response = await this.get<{ migration?: unknown }>(
      `/api/migrations/${migrationId}`,
      { projectId: this.projectId }
    );
    
    if (!response.migration) {
      return null;
    }
    
    // Validate migration
    const { validateMigration } = await import('./types/validation');
    return validateMigration(response.migration);
  }

  getDashboardUrl(): string {
    return this.projectId
      ? `${this.getApiUrl()}/dashboard/projects/${this.projectId}`
      : `${this.getApiUrl()}/dashboard`;
  }

  private normalizeScanReport(report: any): unknown {
    const codeSchema = report.codeSchema ?? report.code_schema;
    const dbSchema = report.dbSchema ?? report.db_schema;
    return {
      id: report.id ?? report.scanId,
      projectId: report.projectId ?? report.project_id ?? this.projectId,
      status: report.status === 'success' ? 'completed' : report.status,
      mismatches: report.mismatches || [],
      ...(codeSchema && typeof codeSchema === 'object' ? { codeSchema } : {}),
      ...(dbSchema && typeof dbSchema === 'object' ? { dbSchema } : {}),
      created_at: report.created_at ?? report.createdAt ?? new Date().toISOString(),
      completed_at: report.completed_at ?? null,
    };
  }

  /**
   * Lists all projects accessible to the current user.
   * 
   * @returns Promise resolving to array of project items
   */
  async listProjects(): Promise<Array<{ id: string; name: string; slug?: string; schemaType?: string; schema_type?: string }>> {
    const response = await this.get<{ projects?: unknown[] }>('/api/projects');
    
    // Return projects with normalized schemaType field
    return (response.projects || []).map((project: any) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      schemaType: project.schemaType || project.schema_type,
    }));
  }

  async createProject(payload: {
    name: string;
    schemaType: string;
    teamId?: string | null;
    dbConnectionString?: string | null;
    codebase?: { type: 'git' | 'upload' | 'cli'; url?: string };
  }): Promise<{ id: string; name: string; slug?: string; schemaType?: string }> {
    const response = await this.post<{ project: any }>('/api/projects', payload);
    return {
      id: response.project.id,
      name: response.project.name,
      slug: response.project.slug,
      schemaType: response.project.schemaType || response.project.schema_type,
    };
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.getApiUrl());
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }

  private async buildAuthHeaders(): Promise<Record<string, string>> {
    const apiKey = this.getApiKey() || await this.authManager?.ensureAccessToken();
    if (!apiKey) {
      throw new Error('API key is required. Please sign in to DevSync or configure devsync.apiKey in your settings.');
    }
    return { Authorization: `Bearer ${apiKey}` };
  }

  async platformRequest<T>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', payload?: unknown): Promise<T> {
    return requestJson<T>(this.buildUrl(path), {
      method,
      headers: await this.buildAuthHeaders(),
      ...(payload === undefined ? {} : { json: payload }),
    });
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    try {
      return await requestJson<T>(this.buildUrl(path), {
      method: 'POST',
      headers: await this.buildAuthHeaders(),
      json: payload,
    });
    } catch (error: any) {
      // Re-throw with more context for authentication errors
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
        throw new Error(`Unauthorized: Please sign in to DevSync. The API key may be missing or invalid.`);
      }
      throw error;
    }
  }

  private async get<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
    try {
      return await requestJson<T>(this.buildUrl(path, params), {
      method: 'GET',
      headers: await this.buildAuthHeaders(),
    });
    } catch (error: any) {
      // Re-throw with more context for authentication errors
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
        throw new Error(`Unauthorized: Please sign in to DevSync. The API key may be missing or invalid.`);
      }
      throw error;
    }
  }
}

