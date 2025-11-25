import axios, { AxiosError } from 'axios';
import * as vscode from 'vscode';
import type { AuthSessionState } from './types';

const TOKENS_KEY = 'devsync.chat.tokens';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId?: string;
  clientId?: string;
}

interface DeviceStartResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface DeviceTokenResponse {
  token_type: 'Bearer';
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  user_id: string;
  client_id: string;
}

interface DeviceTokenErrorResponse {
  error: string;
  error_description?: string;
}

export type AuthFlowUpdate =
  | { kind: 'deviceCode'; payload: DeviceStartResponse }
  | { kind: 'status'; message: string }
  | { kind: 'error'; message: string };

const TOKEN_REFRESH_BUFFER_MS = 60_000;

export class AuthManager {
  private session: AuthSessionState = { status: 'unauthenticated' };
  private readonly sessionEmitter = new vscode.EventEmitter<AuthSessionState>();
  private tokens?: StoredTokens;
  private authenticating = false;
  private analyzerUrl: string;

  constructor(private readonly context: vscode.ExtensionContext, analyzerUrl: string) {
    this.analyzerUrl = this.normalizeUrl(analyzerUrl);
    void this.restoreTokens();
  }

  get onDidChangeSession() {
    return this.sessionEmitter.event;
  }

  getSession(): AuthSessionState {
    return this.session;
  }

  setAnalyzerUrl(url: string) {
    this.analyzerUrl = this.normalizeUrl(url);
  }

  async ensureAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('You must sign in to DevSync before using chat.');
    }

    if (Date.now() >= this.tokens.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
      await this.refreshToken();
    }

    return this.tokens.accessToken;
  }

  async startDeviceFlow(progress?: (update: AuthFlowUpdate) => void): Promise<AuthSessionState> {
    if (this.authenticating) {
      throw new Error('Authentication is already in progress.');
    }

    this.authenticating = true;
    this.updateSession({ status: 'authenticating' });

    try {
      const startResponse = await axios.post<DeviceStartResponse>(
        `${this.analyzerUrl}/api/auth/device/start`,
        { client_id: 'vscode' },
        { timeout: 15_000 }
      );

      progress?.({ kind: 'deviceCode', payload: startResponse.data });

      const expiresAt = Date.now() + startResponse.data.expires_in * 1000;
      let intervalMs = Math.max(2000, startResponse.data.interval * 1000);

      while (Date.now() < expiresAt) {
        await delay(intervalMs);
        progress?.({ kind: 'status', message: 'Waiting for approval...' });

        try {
          const pollResponse = await axios.post<DeviceTokenResponse>(
            `${this.analyzerUrl}/api/auth/device/token`,
            { device_code: startResponse.data.device_code },
            { timeout: 15_000 }
          );

          await this.storeTokens(pollResponse.data);
          progress?.({ kind: 'status', message: 'Signed in successfully.' });
          return this.session;
        } catch (error) {
          const handled = this.handleDeviceError(error);
          if (handled === 'retry') {
            continue;
          }
          if (handled === 'slow_down') {
            intervalMs += 1000;
            continue;
          }
          throw handled;
        }
      }

      throw new Error('Device code expired. Please try again.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to authenticate with DevSync.';
      progress?.({ kind: 'error', message });
      this.updateSession({ status: 'unauthenticated', error: message });
      throw error;
    } finally {
      this.authenticating = false;
    }
  }

  async logout(): Promise<void> {
    this.tokens = undefined;
    await this.context.secrets.delete(TOKENS_KEY);
    this.updateSession({ status: 'unauthenticated' });
  }

  private async refreshToken(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available.');
    }

    const response = await axios.post<DeviceTokenResponse>(
      `${this.analyzerUrl}/api/auth/token/refresh`,
      { refresh_token: this.tokens.refreshToken },
      { timeout: 15_000 }
    );

    await this.storeTokens(response.data);
  }

  private async storeTokens(tokens: DeviceTokenResponse): Promise<void> {
    const stored: StoredTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      userId: tokens.user_id,
      clientId: tokens.client_id,
    };

    this.tokens = stored;
    await this.context.secrets.store(TOKENS_KEY, JSON.stringify(stored));
    this.updateSession({
      status: 'authenticated',
      userId: tokens.user_id,
      clientId: tokens.client_id,
      expiresAt: stored.expiresAt,
    });
  }

  private async restoreTokens(): Promise<void> {
    const raw = await this.context.secrets.get(TOKENS_KEY);
    if (!raw) {
      return;
    }

    try {
      const stored = JSON.parse(raw) as StoredTokens;
      this.tokens = stored;

      if (Date.now() >= stored.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
        try {
          await this.refreshToken();
          return;
        } catch {
          await this.context.secrets.delete(TOKENS_KEY);
          this.tokens = undefined;
          return;
        }
      }

      this.updateSession({
        status: 'authenticated',
        userId: stored.userId,
        clientId: stored.clientId,
        expiresAt: stored.expiresAt,
      });
    } catch {
      await this.context.secrets.delete(TOKENS_KEY);
      this.tokens = undefined;
    }
  }

  private handleDeviceError(error: unknown): 'retry' | 'slow_down' | Error {
    const axiosError = error as AxiosError<DeviceTokenErrorResponse>;
    const payload = axiosError.response?.data;
    const code = payload?.error;

    if (code === 'authorization_pending') {
      return 'retry';
    }

    if (code === 'slow_down') {
      return 'slow_down';
    }

    if (code === 'expired_token') {
      return new Error('Device code expired. Please start again.');
    }

    if (code === 'access_denied') {
      return new Error('The request was denied. Please restart the login flow.');
    }

    const message =
      payload?.error_description ||
      (axiosError.response?.statusText ?? axiosError.message ?? 'Device authorization failed.');

    return new Error(message);
  }

  private updateSession(state: AuthSessionState) {
    this.session = state;
    this.sessionEmitter.fire(state);
  }

  private normalizeUrl(url: string): string {
    return url.replace(/\/$/, '');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const handle = setTimeout(() => {
      clearTimeout(handle);
      resolve();
    }, ms);
  });
}


