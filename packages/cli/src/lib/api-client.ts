import chalk from 'chalk';
import { Buffer } from 'node:buffer';
import { AuthConfig, isTokenExpired, loadAuthConfig, saveAuthConfig } from './config.js';

const DEFAULT_API_URL = process.env.DEVSYNC_API_URL ?? 'http://localhost:4000';

export interface DeviceStartResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface DeviceTokenSuccess {
  token_type: 'Bearer';
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  user_id: string;
  client_id: 'cli' | 'vscode';
}

export class DevicePollError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

const parseJson = async (response: Response) => {
  try {
    return (await response.json()) as Record<string, any>;
  } catch {
    return null;
  }
};

export const deriveExpiryFromToken = (token: string) => {
  const [, payload] = token.split('.');
  if (!payload) {
    return Math.floor(Date.now() / 1000) + 3600;
  }

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { exp?: number };
  return decoded.exp ?? Math.floor(Date.now() / 1000) + 3600;
};

export class AnalyzerApiClient {
  constructor(private readonly baseUrl: string = DEFAULT_API_URL) {}

  private async handleError(response: Response) {
    const payload = await parseJson(response);
    const description = payload?.error_description ?? payload?.error ?? response.statusText;
    throw new Error(`${chalk.red('API error')}: ${description}`);
  }

  async startDeviceFlow(clientId: 'cli' | 'vscode'): Promise<DeviceStartResponse> {
    const response = await fetch(`${this.baseUrl}/api/auth/device/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId }),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return (await response.json()) as DeviceStartResponse;
  }

  async pollDeviceToken(deviceCode: string): Promise<DeviceTokenSuccess> {
    const response = await fetch(`${this.baseUrl}/api/auth/device/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_code: deviceCode }),
    });

    if (response.ok) {
      return (await response.json()) as DeviceTokenSuccess;
    }

    const payload = await parseJson(response);
    const errorCode = payload?.error ?? 'unknown_error';
    const description = payload?.error_description ?? 'Device authorization failed';
    throw new DevicePollError(errorCode, description);
  }

  async refreshTokens(refreshToken: string): Promise<DeviceTokenSuccess> {
    const response = await fetch(`${this.baseUrl}/api/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return (await response.json()) as DeviceTokenSuccess;
  }

  private async getValidAuth(): Promise<AuthConfig> {
    let auth = await loadAuthConfig();
    if (!auth) {
      throw new Error('You are not logged in. Run `devsync login` first.');
    }

    if (!isTokenExpired(auth)) {
      return auth;
    }

    const refreshed = await this.refreshTokens(auth.refreshToken);
    auth = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: deriveExpiryFromToken(refreshed.access_token),
      clientId: refreshed.client_id,
    };
    await saveAuthConfig(auth);
    return auth;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const auth = await this.getValidAuth();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return (await response.json()) as T;
  }
}

