import axios, { AxiosInstance } from 'axios';

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
  private apiUrl: string;
  private apiKey: string;
  private projectId: string;
  private client: AxiosInstance;

  constructor(apiUrl: string, apiKey: string, projectId: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.projectId = projectId;

    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      },
    });
  }

  async scan(projectPath: string, databaseConnection?: string): Promise<ScanReport> {
    // For now, we'll trigger a scan via API
    // In the future, this could use the CLI directly
    const response = await this.client.post('/api/scans', {
      projectId: this.projectId,
      path: projectPath,
      databaseConnection,
    });

    return response.data;
  }

  async getScanReports(limit: number = 10): Promise<ScanReport[]> {
    const response = await this.client.get('/api/scans', {
      params: {
        projectId: this.projectId,
        limit,
      },
    });

    return response.data.scanReports || [];
  }

  async getLatestScanReport(): Promise<ScanReport | null> {
    const reports = await this.getScanReports(1);
    return reports.length > 0 ? reports[0] : null;
  }

  async generateMigration(scanReportId: string, format: string = 'sql'): Promise<Migration> {
    const response = await this.client.post('/api/migrations', {
      scanReportId,
      format,
    });

    return response.data;
  }

  async getMigrations(scanReportId?: string): Promise<Migration[]> {
    const params: any = { projectId: this.projectId };
    if (scanReportId) {
      params.scanReportId = scanReportId;
    }

    const response = await this.client.get('/api/migrations', { params });
    return response.data.migrations || [];
  }

  getDashboardUrl(): string {
    return `${this.apiUrl}/dashboard/projects/${this.projectId}`;
  }
}

