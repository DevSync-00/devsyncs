import { requestJson } from './lib/http';

export interface ScanReport {
  id: string;
  projectId: string;
  status: string;
  mismatches: Mismatch[];
  codeSchema?: any;
  dbSchema?: any;
  created_at: string;
  completed_at?: string;
}

export interface Mismatch {
  type: 'missing_table' | 'missing_field' | 'type_mismatch' | 'extra_field' | 'constraint_mismatch';
  model: string;
  field?: string;
  codeValue?: any;
  dbValue?: any;
  severity: 'error' | 'warning' | 'info';
  suggestedFix?: string;
}

export interface Migration {
  id: string;
  filename: string;
  content: string;
  format: string;
  applied: boolean;
  created_at: string;
}

export class DevSyncApiClient {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string,
    private readonly projectId: string
  ) {}

  async scan(projectPath: string, databaseConnection?: string): Promise<ScanReport> {
    // For now, we'll trigger a scan via API
    // In the future, this could use the CLI directly
    return this.post<ScanReport>('/api/scans', {
      projectId: this.projectId,
      path: projectPath,
      databaseConnection,
    });
  }

  async getScanReports(limit: number = 10): Promise<ScanReport[]> {
    const response = await this.get<{ scanReports?: ScanReport[] }>(
      '/api/scans',
      {
        projectId: this.projectId,
        limit: String(limit),
      }
    );

    return response.scanReports || [];
  }

  async getLatestScanReport(): Promise<ScanReport | null> {
    const reports = await this.getScanReports(1);
    return reports.length > 0 ? reports[0] : null;
  }

  async generateMigration(scanReportId: string, format: string = 'sql'): Promise<Migration> {
    return this.post<Migration>('/api/migrations', {
      scanReportId,
      format,
    });
  }

  async getMigrations(scanReportId?: string): Promise<Migration[]> {
    const params: Record<string, string> = { projectId: this.projectId };
    if (scanReportId) {
      params.scanReportId = scanReportId;
    }

    const response = await this.get<{ migrations?: Migration[] }>(
      '/api/migrations',
      params
    );
    return response.migrations || [];
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

