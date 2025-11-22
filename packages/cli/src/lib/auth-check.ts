import chalk from 'chalk';
import { AnalyzerApiClient, deriveExpiryFromToken } from './api-client.js';
import { AuthConfig, isTokenExpired, loadAuthConfig, saveAuthConfig } from './config.js';

export async function requireAuthenticatedCli(): Promise<AuthConfig> {
  let auth = await loadAuthConfig();
  if (!auth) {
    console.error(chalk.red('✖ DevSync CLI is not logged in.'));
    console.error(chalk.gray('Run `devsync login` to connect this machine to your account.'));
    process.exit(1);
  }

  if (!isTokenExpired(auth)) {
    return auth;
  }

  const client = new AnalyzerApiClient();
  const refreshed = await client.refreshTokens(auth.refreshToken);
  auth = {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: deriveExpiryFromToken(refreshed.access_token),
    clientId: refreshed.client_id,
  };
  await saveAuthConfig(auth);
  return auth;
}

