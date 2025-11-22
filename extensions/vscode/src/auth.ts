import axios from 'axios';
import * as vscode from 'vscode';
import { Buffer } from 'buffer';

const TOKEN_KEY = 'devsync-token';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const decodeExpiry = (token: string) => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return Math.floor(Date.now() / 1000) + 3600;
  }
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8')) as { exp?: number };
  return payload.exp ?? Math.floor(Date.now() / 1000) + 3600;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class DeviceAuthManager {
  constructor(private readonly context: vscode.ExtensionContext, private readonly apiUrl: string) {}

  private async readTokens(): Promise<StoredTokens | null> {
    const raw = await this.context.secrets.get(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  }

  private async persistTokens(tokens: StoredTokens) {
    await this.context.secrets.store(TOKEN_KEY, JSON.stringify(tokens));
  }

  private async refresh(refreshToken: string): Promise<StoredTokens> {
    const response = await axios.post(`${this.apiUrl}/api/auth/token/refresh`, {
      refresh_token: refreshToken,
    });
    const { access_token, refresh_token } = response.data;
    const tokens = {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: decodeExpiry(access_token),
    };
    await this.persistTokens(tokens);
    return tokens;
  }

  private async startDeviceFlow(): Promise<StoredTokens> {
    const startRes = await axios.post(`${this.apiUrl}/api/auth/device/start`, {
      client_id: 'vscode',
    });
    const start = startRes.data as {
      user_code: string;
      verification_uri: string;
      device_code: string;
      expires_in: number;
      interval: number;
    };

    const open = 'Open device portal';
    const selection = await vscode.window.showInformationMessage(
      `Enter code ${start.user_code} to link VS Code.`,
      open
    );
    if (selection === open) {
      await vscode.env.openExternal(vscode.Uri.parse(start.verification_uri));
    }

    const tokens = await vscode.window.withProgress<StoredTokens>(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Waiting for DevSync authorization…',
        cancellable: true,
      },
      async (_progress, cancellationToken) => {
        const deadline = Date.now() + start.expires_in * 1000;
        let delay = start.interval * 1000;

        while (Date.now() < deadline) {
          if (cancellationToken.isCancellationRequested) {
            throw new Error('Login cancelled');
          }
          await sleep(delay);
          try {
            const tokenRes = await axios.post(`${this.apiUrl}/api/auth/device/token`, {
              device_code: start.device_code,
            });
            const data = tokenRes.data;
            return {
              accessToken: data.access_token,
              refreshToken: data.refresh_token,
              expiresAt: decodeExpiry(data.access_token),
            };
          } catch (error) {
            if (axios.isAxiosError(error) && error.response?.data?.error) {
              const code = error.response.data.error;
              if (code === 'authorization_pending') {
                continue;
              }
              if (code === 'slow_down') {
                delay += 2000;
                continue;
              }
              if (code === 'expired_token') {
                throw new Error('Device code expired. Run the login again.');
              }
            }
            throw error;
          }
        }
        throw new Error('Device code expired. Please try again.');
      }
    );

    await this.persistTokens(tokens);
    vscode.window.showInformationMessage('DevSync VS Code extension is now authenticated.');
    return tokens;
  }

  async ensureAuthenticated(): Promise<StoredTokens> {
    let tokens = await this.readTokens();
    const now = Math.floor(Date.now() / 1000);

    if (!tokens) {
      tokens = await this.startDeviceFlow();
      return tokens;
    }

    if (now >= tokens.expiresAt - 30) {
      tokens = await this.refresh(tokens.refreshToken);
    }

    return tokens;
  }

  async getAccessToken(): Promise<string> {
    const tokens = await this.ensureAuthenticated();
    return tokens.accessToken;
  }
}

