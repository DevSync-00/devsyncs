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

export interface ProjectListItem {
  id: string;
  name: string;
  slug?: string;
  schemaType?: string;
  createdAt?: string;
  updatedAt?: string;
  teamId?: string | null;
  codebaseType?: string | null;
  lastScanAt?: string | null;
  lastScanStatus?: string | null;
  mismatchCount?: number;
  metadata?: {
    lastScanAt?: string | null;
    lastScanStatus?: string | null;
    mismatchCount?: number;
  };
}

interface ProjectsResponse {
  projects: ProjectListItem[];
}

interface ProjectResponse {
  project: ProjectListItem & {
    dbConnectionString?: string | null;
    config?: any;
  };
}

export interface CreateProjectPayload {
  name: string;
  schemaType: string;
  slug?: string;
  dbConnectionString?: string | null;
  codebase?: {
    type: 'git' | 'upload' | 'cli';
    url?: string;
  };
  teamId?: string | null;
}

export type UpdateProjectPayload = Partial<CreateProjectPayload>;

export class ApiClient {
  private apiUrl: string;
  private apiKey?: string;
  private timeout: number;
  private maxRetries: number;

  constructor(options: ApiClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = options.apiKey;
    this.timeout = options.timeout || 120000; // Increased to 2 minutes for better reliability
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

  async listProjects(search?: string): Promise<ProjectListItem[]> {
    return retry(
      async () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const searchParam = search ? `?search=${encodeURIComponent(search)}` : '';
        const response = await withTimeout(
          fetch(`${this.apiUrl}/api/projects${searchParam}`, {
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
          throw new Error(`Failed to fetch projects: ${errorMessage} (${response.status})`);
        }

        const data = await response.json() as ProjectsResponse;
        return data.projects || [];
      },
      {
        maxAttempts: this.maxRetries,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'timeout', 'network', 'fetch failed']
      }
    );
  }

  async getProject(projectId: string): Promise<ProjectResponse['project']> {
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
          throw new Error(`Failed to fetch project: ${errorMessage} (${response.status})`);
        }

        const data = await response.json() as ProjectResponse;
        return data.project;
      },
      {
        maxAttempts: this.maxRetries,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'timeout', 'network', 'fetch failed']
      }
    );
  }

  async createProject(payload: CreateProjectPayload) {
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

        const data = await response.json() as ProjectResponse;
        return data.project;
      },
      {
        maxAttempts: this.maxRetries,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'timeout', 'network', 'fetch failed']
      }
    );
  }

  async updateProject(projectId: string, payload: UpdateProjectPayload) {
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
            method: 'PATCH',
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
          throw new Error(`Failed to update project: ${errorMessage} (${response.status})`);
        }

        const data = await response.json() as ProjectResponse;
        return data.project;
      },
      {
        maxAttempts: this.maxRetries,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'timeout', 'network', 'fetch failed']
      }
    );
  }

  async deleteProject(projectId: string): Promise<void> {
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
            method: 'DELETE',
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
          throw new Error(`Failed to delete project: ${errorMessage} (${response.status})`);
        }
      },
      {
        maxAttempts: this.maxRetries,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'timeout', 'network', 'fetch failed']
      }
    );
  }
}

