import { requestJson } from './lib/http';
import { PrismaModel, DatabaseTable, SchemaValue } from './types/schema';

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
  codeSchema?: PrismaModel[];
  /** Optional database schema tables extracted from database */
  dbSchema?: DatabaseTable[];
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
  | MissingFieldMismatch
  | TypeMismatch
  | ExtraFieldMismatch
  | ConstraintMismatch;

/**
 * Base mismatch interface
 */
interface BaseMismatch {
  model: string;
  severity: 'error' | 'warning' | 'info';
  suggestedFix?: string;
}

/**
 * Missing table mismatch
 */
export interface MissingTableMismatch extends BaseMismatch {
  type: 'missing_table';
}

/**
 * Missing field mismatch
 */
export interface MissingFieldMismatch extends BaseMismatch {
  type: 'missing_field';
  field: string;
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

/**
 * Extra field mismatch
 */
export interface ExtraFieldMismatch extends BaseMismatch {
  type: 'extra_field';
  field: string;
  dbValue: SchemaValue;
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
}

import { IApiClient } from './interfaces';

/**
 * API client for interacting with the DevSync dashboard API.
 * 
 * Handles HTTP requests to the DevSync service for scanning, migration generation,
 * and report retrieval. All responses are validated using runtime type checking.
 * 
 * @example
 * ```typescript
 * const client = new DevSyncApiClient(
 *   'https://api.devsync.ai',
 *   'your-api-key',
 *   'project-id'
 * );
 * const report = await client.scan('/path/to/project');
 * ```
 */
export class DevSyncApiClient implements IApiClient {
  /**
   * Creates a new API client instance.
   * 
   * @param apiUrl - Base URL of the DevSync API
   * @param apiKey - API key for authentication
   * @param projectId - Project identifier
   */
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly projectId: string
  ) {}

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
    // For now, we'll trigger a scan via API
    // In the future, this could use the CLI directly
    const response = await this.post<ScanReport>('/api/scans', {
      projectId: this.projectId,
      path: projectPath,
      databaseConnection,
    });
    
    // Validate response with runtime validation
    const { validateScanReport } = await import('./types/validation');
    return validateScanReport(response);
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
    return (response.scanReports || []).map((report) => validateScanReport(report));
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

  getDashboardUrl(): string {
    return `${this.apiUrl}/dashboard/projects/${this.projectId}`;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.apiUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }

  private get authHeaders(): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    return requestJson<T>(this.buildUrl(path), {
      method: 'POST',
      headers: this.authHeaders,
      json: payload,
    });
  }

  private async get<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
    return requestJson<T>(this.buildUrl(path, params), {
      method: 'GET',
      headers: this.authHeaders,
    });
  }
}

