import type { SchemaDiff } from '../types/index.js';
import { retry, withTimeout } from '../utils/retry.js';

export interface ScanReportPayload {
  projectId: string;
  codeSchema?: any;
  dbSchema?: any;
  mismatches: any[];
  metadata?: {
    codeVersion: string;
    dbVersion: string;
    timestamp: Date;
  };
}

export interface ApiClientOptions {
  apiUrl: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface ScanReportResponse {
  scanId: string;
  status: string;
  mismatches?: any[];
  createdAt?: string;
}

export interface ScanReportsResponse {
  scanReports: any[];
}

export class ApiClient {
  private apiUrl: string;
  private apiKey?: string;
  private timeout: number;
  private maxRetries: number;

  constructor(options: ApiClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = options.apiKey;
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
  }

  async sendScanReport(payload: ScanReportPayload): Promise<ScanReportResponse> {
    return retry(
      async () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const response = await withTimeout(
          fetch(`${this.apiUrl}/api/scans`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          }),
          this.timeout,
          'Request to API timed out'
        );

        if (!response.ok) {
          let errorMessage = 'Unknown error';
          try {
            const errorData = await response.json() as { error?: string; details?: string };
            errorMessage = errorData.error || errorData.details || response.statusText;
          } catch {
            errorMessage = response.statusText;
          }
          throw new Error(`Failed to send scan report: ${errorMessage} (${response.status})`);
        }

        const data = await response.json() as ScanReportResponse;
        return data;
      },
      {
        maxAttempts: this.maxRetries,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'timeout', 'network', 'fetch failed']
      }
    );
  }

  async getScanReports(projectId: string): Promise<any[]> {
    return retry(
      async () => {
        const headers: Record<string, string> = {};

        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const response = await withTimeout(
          fetch(`${this.apiUrl}/api/scans?projectId=${projectId}`, {
            method: 'GET',
            headers,
          }),
          this.timeout,
          'Request to API timed out'
        );

        if (!response.ok) {
          let errorMessage = 'Unknown error';
          try {
            const errorData = await response.json() as { error?: string; details?: string };
            errorMessage = errorData.error || errorData.details || response.statusText;
          } catch {
            errorMessage = response.statusText;
          }
          throw new Error(`Failed to fetch scan reports: ${errorMessage} (${response.status})`);
        }

        const data = await response.json() as ScanReportsResponse;
        return data.scanReports || [];
      },
      {
        maxAttempts: this.maxRetries,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'timeout', 'network', 'fetch failed']
      }
    );
  }

  async getProjectMetadata(projectId: string): Promise<{
    id: string;
    name: string;
    databaseConnectionString?: string;
    schemaType?: string;
    [key: string]: any;
  }> {
    return retry(
      async () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const response = await withTimeout(
          fetch(`${this.apiUrl}/api/projects/${projectId}`, {
            method: 'GET',
            headers,
          }),
          this.timeout,
          'Request to API timed out'
        );

        if (!response.ok) {
          let errorMessage = 'Unknown error';
          try {
            const errorData = await response.json() as { error?: string; details?: string };
            errorMessage = errorData.error || errorData.details || response.statusText;
          } catch {
            errorMessage = response.statusText;
          }
          throw new Error(`Failed to fetch project metadata: ${errorMessage} (${response.status})`);
        }

        const data = await response.json() as {
          id: string;
          name: string;
          databaseConnectionString?: string;
          schemaType?: string;
          [key: string]: any;
        };
        return data;
      },
      {
        maxAttempts: this.maxRetries,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'timeout', 'network', 'fetch failed']
      }
    );
  }

  async createProject(payload: {
    name: string;
    schemaType?: string;
    databaseConnectionString: string;
    codebaseSource: string;
  }): Promise<{
    id: string;
    name: string;
    databaseConnectionString?: string;
    schemaType?: string;
    [key: string]: any;
  }> {
    return retry(
      async () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const response = await withTimeout(
          fetch(`${this.apiUrl}/api/projects`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          }),
          this.timeout,
          'Request to API timed out'
        );

        if (!response.ok) {
          let errorMessage = 'Unknown error';
          try {
            const errorData = await response.json() as { error?: string; details?: string };
            errorMessage = errorData.error || errorData.details || response.statusText;
          } catch {
            errorMessage = response.statusText;
          }
          throw new Error(`Failed to create project: ${errorMessage} (${response.status})`);
        }

        const data = await response.json() as {
          id: string;
          name: string;
          databaseConnectionString?: string;
          schemaType?: string;
          [key: string]: any;
        };
        return data;
      },
      {
        maxAttempts: this.maxRetries,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'timeout', 'network', 'fetch failed']
      }
    );
  }
}

