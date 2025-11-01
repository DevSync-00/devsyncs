import type { SchemaDiff } from '../types/index.js';

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

  constructor(options: ApiClientOptions) {
    this.apiUrl = options.apiUrl;
    this.apiKey = options.apiKey;
  }

  async sendScanReport(payload: ScanReportPayload): Promise<ScanReportResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.apiUrl}/api/scans`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = 'Unknown error';
      try {
        const errorData = await response.json() as { error?: string };
        errorMessage = errorData.error || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }
      throw new Error(`Failed to send scan report: ${errorMessage}`);
    }

    const data = await response.json() as ScanReportResponse;
    return data;
  }

  async getScanReports(projectId: string): Promise<any[]> {
    const headers: Record<string, string> = {};

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.apiUrl}/api/scans?projectId=${projectId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      let errorMessage = 'Unknown error';
      try {
        const errorData = await response.json() as { error?: string };
        errorMessage = errorData.error || response.statusText;
      } catch {
        errorMessage = response.statusText;
      }
      throw new Error(`Failed to fetch scan reports: ${errorMessage}`);
    }

    const data = await response.json() as ScanReportsResponse;
    return data.scanReports || [];
  }
}

