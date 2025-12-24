/**
 * Analyzer API Client for Device Flow OAuth Authentication
 * Handles device code flow with comprehensive error handling, retries, and timeouts
 * 
 * This is also exported as AnalyzerApiClient from lib/api-client.ts for backward compatibility
 */

import { retry, withTimeout } from '../utils/retry.js';

export interface DeviceFlowStartResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface DeviceFlowTokenResponse {
  token_type: string;
  access_token: string;
  refresh_token: string;
  refresh_expires_in: number;
  expires_in: number;
  user_id: string;
  client_id: string;
}

export interface TokenRefreshResponse {
  token_type: string;
  access_token: string;
  refresh_token: string;
  refresh_expires_in: number;
  expires_in: number;
  user_id: string;
  client_id: string;
}

export interface AnalyzerApiClientOptions {
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class AnalyzerApiClient {
  private baseUrl: string;
  private timeoutMs: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(baseUrl: string, options: AnalyzerApiClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeoutMs = options.timeoutMs || 120000; // Increased to 2 minutes for better reliability
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Start device flow authentication
   * Returns device code and user code for user to authorize
   */
  async startDeviceFlow(clientId: string): Promise<DeviceFlowStartResponse> {
    return retry(
      async () => {
        const response = await withTimeout(
          fetch(`${this.baseUrl}/api/auth/device/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ client_id: clientId }),
          }),
          this.timeoutMs,
          'Device flow start request timed out'
        );

        if (!response.ok) {
          let errorMessage = 'Failed to start device flow';
          try {
            const errorData = await response.json() as { error?: string; message?: string };
            errorMessage = errorData.error || errorData.message || response.statusText;
          } catch {
            errorMessage = response.statusText;
          }

          // Provide actionable error messages
          if (response.status === 503 || response.status === 502) {
            throw new Error(
              `${errorMessage}. Ensure the DevSync dashboard is running at ${this.baseUrl}. ` +
              'Check that the dashboard is started and accessible.'
            );
          }

          if (response.status === 404) {
            throw new Error(
              `${errorMessage}. The authentication endpoint was not found. ` +
              `Verify that ${this.baseUrl} is the correct dashboard URL.`
            );
          }

          throw new Error(`Failed to start device flow: ${errorMessage} (${response.status})`);
        }

        const data = await response.json() as DeviceFlowStartResponse;
        
        // Validate response structure
        if (!data.device_code || !data.user_code || !data.verification_uri) {
          throw new Error('Invalid device flow response: missing required fields');
        }

        return data;
      },
      {
        maxAttempts: this.retryAttempts,
        initialDelay: this.retryDelay,
        retryableErrors: [
          'ECONNREFUSED',
          'ETIMEDOUT',
          'timeout',
          'network',
          'fetch failed',
          'ECONNRESET',
          'ENOTFOUND'
        ]
      }
    );
  }

  /**
   * Poll for device flow token
   * Continues polling until user authorizes or flow expires
   */
  async pollDeviceFlowToken(
    deviceCode: string,
    interval: number,
    expiresIn: number,
    onProgress?: (message: string) => void
  ): Promise<DeviceFlowTokenResponse> {
    const startTime = Date.now();
    const expiresAt = startTime + (expiresIn * 1000);
    let lastPollTime = startTime;
    let pollInterval = Math.max(interval * 1000, 2000); // Minimum 2 seconds between polls

    while (Date.now() < expiresAt) {
      // Check if we need to wait before polling
      const timeSinceLastPoll = Date.now() - lastPollTime;
      if (timeSinceLastPoll < pollInterval) {
        await new Promise(resolve => setTimeout(resolve, pollInterval - timeSinceLastPoll));
      }

      try {
        const response = await withTimeout(
          fetch(`${this.baseUrl}/api/auth/device/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ device_code: deviceCode }),
          }),
          this.timeoutMs,
          'Device flow token request timed out'
        );

        if (response.status === 200) {
          const data = await response.json() as DeviceFlowTokenResponse;
          
          // Validate response structure
          if (!data.access_token || !data.refresh_token) {
            throw new Error('Invalid token response: missing required fields');
          }

          return data;
        }

        if (response.status === 400) {
          // User hasn't authorized yet, continue polling
          const errorData = await response.json() as { error?: string };
          if (errorData.error === 'authorization_pending') {
            onProgress?.('Waiting for authorization...');
            lastPollTime = Date.now();
            continue;
          }
          
          // Other 400 errors are not retryable
          let errorMessage = 'Authorization failed';
          try {
            errorMessage = errorData.error || response.statusText;
          } catch {
            errorMessage = response.statusText;
          }
          throw new Error(`Device flow authorization failed: ${errorMessage}`);
        }

        if (response.status === 403) {
          throw new Error(
            'Device code expired or was already used. Please start a new login flow.'
          );
        }

        // For other errors, try to get error message
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json() as { error?: string; message?: string };
          errorMessage = errorData.error || errorData.message || response.statusText;
        } catch {
          errorMessage = response.statusText;
        }
        throw new Error(`Failed to get device flow token: ${errorMessage} (${response.status})`);

      } catch (error) {
        // If it's a network error, retry
        if (error instanceof Error && (
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('timeout') ||
          error.message.includes('network') ||
          error.message.includes('fetch failed')
        )) {
          onProgress?.('Connection error, retrying...');
          lastPollTime = Date.now();
          continue;
        }

        // For other errors, rethrow
        throw error;
      }
    }

    throw new Error(
      'Device flow expired. The authorization code is no longer valid. ' +
      'Please run `devsync login` again to start a new authorization flow.'
    );
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<TokenRefreshResponse> {
    return retry(
      async () => {
        const response = await withTimeout(
          fetch(`${this.baseUrl}/api/auth/token/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          }),
          this.timeoutMs,
          'Token refresh request timed out'
        );

        if (!response.ok) {
          let errorMessage = 'Failed to refresh token';
          try {
            const errorData = await response.json() as { error?: string; message?: string };
            errorMessage = errorData.error || errorData.message || response.statusText;
          } catch {
            errorMessage = response.statusText;
          }

          // Provide actionable error messages
          if (response.status === 401) {
            throw new Error(
              'Token refresh failed: refresh token is invalid or expired. ' +
              'Please run `devsync login` again to re-authenticate.'
            );
          }

          if (response.status === 503 || response.status === 502) {
            throw new Error(
              `${errorMessage}. Ensure the DevSync dashboard is running at ${this.baseUrl}.`
            );
          }

          throw new Error(`Failed to refresh token: ${errorMessage} (${response.status})`);
        }

        const data = await response.json() as TokenRefreshResponse;
        
        // Validate response structure
        if (!data.access_token || !data.refresh_token) {
          throw new Error('Invalid refresh response: missing required fields');
        }

        return data;
      },
      {
        maxAttempts: this.retryAttempts,
        initialDelay: this.retryDelay,
        retryableErrors: [
          'ECONNREFUSED',
          'ETIMEDOUT',
          'timeout',
          'network',
          'fetch failed',
          'ECONNRESET'
        ]
      }
    );
  }
}

