import axios, { AxiosInstance } from 'axios';
import { DeviceAuthManager } from './auth';

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
  private client: AxiosInstance;

  constructor(private apiUrl: string, private projectId: string, private authManager: DeviceAuthManager) {
    this.client = axios.create({
      baseURL: apiUrl,
    });
  }

  private async authHeaders() {
    const token = await this.authManager.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  async scan(projectPath: string, databaseConnection?: string): Promise<ScanReport> {
    const headers = await this.authHeaders();
    const response = await this.client.post(
      '/api/scans',
      {
        projectId: this.projectId,
        path: projectPath,
        databaseConnection,
      },
      { headers }
    );

    return response.data;
  }

  async getScanReports(limit: number = 10): Promise<ScanReport[]> {
    const headers = await this.authHeaders();
    const response = await this.client.get('/api/scans', {
      params: {
        projectId: this.projectId,
        limit,
      },
      headers,
    });

    return response.data.scanReports || [];
  }

  async getLatestScanReport(): Promise<ScanReport | null> {
    const reports = await this.getScanReports(1);
    return reports.length > 0 ? reports[0] : null;
  }

  async generateMigration(scanReportId: string, format: string = 'sql'): Promise<Migration> {
    const headers = await this.authHeaders();
    const response = await this.client.post(
      '/api/migrations',
      {
        scanReportId,
        format,
      },
      { headers }
    );

    return response.data;
  }

  async getMigrations(scanReportId?: string): Promise<Migration[]> {
    const params: Record<string, string> = { projectId: this.projectId };
    if (scanReportId) {
      params.scanReportId = scanReportId;
    }
    const headers = await this.authHeaders();

    const response = await this.client.get('/api/migrations', { params, headers });
    return response.data.migrations || [];
  }

  getDashboardUrl(): string {
    return `${this.apiUrl}/dashboard/projects/${this.projectId}`;
  }
}

