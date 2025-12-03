import type { AiQueryResult } from './types';
import type { ScanReport } from './api';
import {
  HttpRequestError,
  JsonRequestInit,
  isAbortError,
  requestJson,
} from './lib/http';
import { IChatApiClient, IAuthManager } from './interfaces';

interface AiQueryResponse {
  answer: string;
  question: string;
  scanReportId: string;
}

interface ScanResponsePayload {
  scanReports: ScanReport[];
}

export class ChatApiClient implements IChatApiClient {
  constructor(private apiUrl: string, private readonly auth: IAuthManager) {}

  setApiUrl(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async getLatestScanReport(projectId: string): Promise<ScanReport | null> {
    const headers = await this.buildHeaders();

    try {
      const response = await this.request<ScanResponsePayload>('/api/scans', {
        method: 'GET',
        headers,
      }, {
        projectId,
        limit: '1',
      });

      const reports = response.scanReports || [];
      return reports.length > 0 ? reports[0] : null;
    } catch (error) {
      throw new Error(this.extractError(error, 'Failed to load scan reports.'));
    }
  }

  async queryAI(question: string, scanReportId: string, signal?: AbortSignal): Promise<AiQueryResult> {
    const headers = await this.buildHeaders();

    try {
      const response = await this.request<AiQueryResponse>(
        '/api/ai/query',
        {
          method: 'POST',
          headers,
          json: { question, scanReportId },
          signal,
        }
      );

      return {
        answer: response.answer,
        question: response.question,
        scanReportId: response.scanReportId,
      };
    } catch (error) {
      if (isAbortError(error)) {
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
    if (error instanceof HttpRequestError) {
      if (error.status === 0) {
        const detail =
          (error.cause instanceof Error && error.cause.message) ||
          error.message ||
          'Network request failed';
        return `Unable to reach the DevSync API at ${this.normalizeUrl(
          this.apiUrl
        )}. ${detail}.`;
      }

      if (typeof error.data === 'object' && error.data !== null) {
        const payload = error.data as { error?: string; details?: string };
        return payload.error || payload.details || error.message || fallback;
      }
      return error.message || fallback;
    }

    if (error instanceof Error) {
      return error.message || fallback;
    }

    return fallback;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const base = this.normalizeUrl(this.apiUrl);
    const url = new URL(path, base.endsWith('/') ? base : `${base}/`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }

  private async request<T>(
    path: string,
    init: JsonRequestInit,
    params?: Record<string, string>
  ): Promise<T> {
    return requestJson<T>(this.buildUrl(path, params), init);
  }
}


