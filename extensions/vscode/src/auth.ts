import * as vscode from 'vscode';
import type { AuthSessionState } from './types';
import {
  HttpRequestError,
  isAbortError,
  requestJson,
} from './lib/http';

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

import { IAuthManager } from './interfaces';

export class AuthManager implements IAuthManager {
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

  /**
   * Ensure access token is valid and refresh if needed.
   * 
   * Sessions are lifecycle-based: tokens are automatically refreshed to keep
   * the session alive indefinitely while the user is working.
   */
  async ensureAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('You must sign in to DevSync before using chat.');
    }

    // Automatically refresh token if it's about to expire
    // This keeps the session alive indefinitely - no time-based expiration
    if (Date.now() >= this.tokens.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
      try {
        await this.refreshToken();
      } catch (error) {
        // If refresh fails, only throw if refresh token is invalid
        // Network errors should not invalidate the session
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('refresh') || errorMessage.includes('invalid') || errorMessage.includes('401')) {
          // Refresh token is invalid - clear session
          await this.logout();
          throw new Error('Session expired. Please sign in again.');
        }
        // For network errors, use the existing token (it may still be valid)
        // The refresh will retry on the next call
      }
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
      const startResponse = await this.postWithTimeout<DeviceStartResponse>(
        '/api/auth/device/start',
        { client_id: 'vscode' }
      );

      progress?.({ kind: 'deviceCode', payload: startResponse });

      const expiresAt = Date.now() + startResponse.expires_in * 1000;
      let intervalMs = Math.max(2000, startResponse.interval * 1000);

      while (Date.now() < expiresAt) {
        await delay(intervalMs);
        progress?.({ kind: 'status', message: 'Waiting for approval...' });

        try {
          const pollResponse = await this.postWithTimeout<DeviceTokenResponse>(
            '/api/auth/device/token',
            { device_code: startResponse.device_code }
          );

          // Validate response has required fields
          if (!pollResponse.access_token || !pollResponse.refresh_token) {
            throw new Error('Invalid token response: missing access or refresh token');
          }

          await this.storeTokens(pollResponse);
          progress?.({ kind: 'status', message: 'Signed in successfully.' });
          
          // Ensure session is updated before returning
          if (this.session.status !== 'authenticated') {
            console.error('[Auth] Session not updated after storing tokens');
            throw new Error('Failed to update session after authentication');
          }
          
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

  /**
   * Logout and invalidate session.
   * 
   * This is the only way to explicitly end a session (other than window close).
   * Sessions are lifecycle-based and don't expire based on time.
   */
  async logout(): Promise<void> {
    // Clear tokens from memory
    this.tokens = undefined;
    // Delete tokens from secure storage
    await this.context.secrets.delete(TOKENS_KEY);
    // Update session state to unauthenticated
    this.updateSession({ status: 'unauthenticated' });
    // Session is now terminated - user must log in again
  }

  /**
   * Refresh access token using refresh token.
   * 
   * This keeps the session alive indefinitely by automatically refreshing
   * tokens before they expire. Sessions are lifecycle-based, not time-based.
   */
  private async refreshToken(): Promise<void> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available.');
    }

    const response = await this.postWithTimeout<DeviceTokenResponse>(
      '/api/auth/token/refresh',
      { refresh_token: this.tokens.refreshToken }
    );

    await this.storeTokens(response);
    // Token refreshed - session continues indefinitely
  }

  private async storeTokens(tokens: DeviceTokenResponse): Promise<void> {
    try {
      const stored: StoredTokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
        userId: tokens.user_id,
        clientId: tokens.client_id,
      };

      // Validate tokens before storing
      if (!stored.accessToken || !stored.refreshToken) {
        throw new Error('Cannot store tokens: access or refresh token is empty');
      }

      this.tokens = stored;
      await this.context.secrets.store(TOKENS_KEY, JSON.stringify(stored));
      
      this.updateSession({
        status: 'authenticated',
        userId: tokens.user_id,
        clientId: tokens.client_id,
        expiresAt: stored.expiresAt,
      });
      
      // Use debug level for successful token storage to reduce console noise
      console.debug('[Auth] Tokens stored successfully for user:', tokens.user_id);
    } catch (error) {
      console.error('[Auth] Error storing tokens:', error);
      throw error;
    }
  }

  /**
   * Restore tokens from storage on extension activation.
   * 
   * Sessions are lifecycle-based: if tokens exist and are valid (or can be refreshed),
   * the session is restored. This allows sessions to persist across VS Code reloads.
   */
  private async restoreTokens(): Promise<void> {
    const raw = await this.context.secrets.get(TOKENS_KEY);
    if (!raw) {
      return;
    }

    try {
      const stored = JSON.parse(raw) as StoredTokens;
      this.tokens = stored;

      // If token is expired or about to expire, try to refresh it
      // This keeps the session alive across reloads and during use
      if (Date.now() >= stored.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
        try {
          await this.refreshToken();
          // Token refreshed successfully - session continues
          return;
        } catch (error) {
          // Only clear tokens if refresh token is invalid
          // Network errors should not invalidate the session
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (errorMessage.includes('refresh') || errorMessage.includes('invalid') || errorMessage.includes('401')) {
            // Refresh token is invalid - clear session
            await this.context.secrets.delete(TOKENS_KEY);
            this.tokens = undefined;
            return;
          }
          // For network errors, keep the stored tokens and try again later
          // The session will remain active and token refresh will retry
        }
      }

      // Restore session with existing tokens
      // Session remains active indefinitely until explicit logout or window close
      this.updateSession({
        status: 'authenticated',
        userId: stored.userId,
        clientId: stored.clientId,
        expiresAt: stored.expiresAt,
      });
    } catch {
      // If tokens are corrupted, clear them
      await this.context.secrets.delete(TOKENS_KEY);
      this.tokens = undefined;
    }
  }

  private handleDeviceError(error: unknown): 'retry' | 'slow_down' | Error {
    if (error instanceof HttpRequestError) {
      const payload = error.data as DeviceTokenErrorResponse | undefined;
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
        error.message ||
        'Device authorization failed.';
      return new Error(message);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('Device authorization failed.');
  }

  private async postWithTimeout<T>(
    path: string,
    payload: unknown,
    timeoutMs: number = 60_000 // Increased to 1 minute for better reliability
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await requestJson<T>(`${this.analyzerUrl}${path}`, {
        method: 'POST',
        json: payload,
        signal: controller.signal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error('DevSync analyzer request timeout');
      }
      if (error instanceof HttpRequestError && error.status === 0) {
        const details =
          (error.cause instanceof Error && error.cause.message) ||
          error.message ||
          'Network request failed';
        throw new Error(
          `Unable to reach the DevSync dashboard at ${this.analyzerUrl}. ${details}. ` +
            `Check the "devsync.analyzerUrl" setting and ensure the dashboard is running.`
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private updateSession(state: AuthSessionState) {
    this.session = state;
    this.sessionEmitter.fire(state);
  }

  private normalizeUrl(url: string): string {
    return url.replace(/\/$/, '');
  }
}

import { delay } from './utils';
