import axios, { AxiosError, AxiosInstance } from 'axios';
import type { AuthManager } from './auth';
import type { AiQueryResult } from './types';
import type { ScanReport } from './api';

interface AiQueryResponse {
  answer: string;
  question: string;
  scanReportId: string;
}

interface ScanResponsePayload {
  scanReports: ScanReport[];
}

export class ChatApiClient {
  private client: AxiosInstance;

  constructor(private apiUrl: string, private readonly auth: AuthManager) {
    this.client = axios.create({
      baseURL: this.normalizeUrl(apiUrl),
    });
  }

  setApiUrl(apiUrl: string) {
    this.apiUrl = apiUrl;
    this.client = axios.create({
      baseURL: this.normalizeUrl(apiUrl),
    });
  }

  async getLatestScanReport(projectId: string): Promise<ScanReport | null> {
    const headers = await this.buildHeaders();

    try {
      const response = await this.client.get<ScanResponsePayload>('/api/scans', {
        headers,
        params: {
          projectId,
          limit: 1,
        },
      });

      const reports = response.data.scanReports || [];
      return reports.length > 0 ? reports[0] : null;
    } catch (error) {
      throw new Error(this.extractError(error, 'Failed to load scan reports.'));
    }
  }

  async queryAI(question: string, scanReportId: string, signal?: AbortSignal): Promise<AiQueryResult> {
    const headers = await this.buildHeaders();

    try {
      const response = await this.client.post<AiQueryResponse>(
        '/api/ai/query',
        { question, scanReportId },
        { headers, signal }
      );

      return {
        answer: response.data.answer,
        question: response.data.question,
        scanReportId: response.data.scanReportId,
      };
    } catch (error) {
      if (axios.isCancel(error)) {
        throw new Error('Request cancelled.');
      }
      throw new Error(this.extractError(error, 'AI query failed.'));
    }
  }

  private async buildHeaders(): Promise<Record<string, string>> {
    const token = await this.auth.ensureAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private normalizeUrl(url: string): string {
    return url.replace(/\/$/, '');
  }

  private extractError(error: unknown, fallback: string): string {
    const axiosError = error as AxiosError<{ error?: string; details?: string }>;
    return (
      axiosError.response?.data?.error ||
      axiosError.response?.data?.details ||
      axiosError.message ||
      fallback
    );
  }
}


