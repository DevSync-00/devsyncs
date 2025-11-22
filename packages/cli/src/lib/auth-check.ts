import chalk from 'chalk';
import { AnalyzerApiClient, deriveExpiryFromToken } from './api-client.js';
import { AuthConfig, isTokenExpired, loadAuthConfig, saveAuthConfig } from './config.js';

/**
 * Get authenticated config without exiting if not logged in
 * Use this when you want to check auth status without forcing login
 */
export async function getAuthenticatedCli(): Promise<AuthConfig | null> {
  let auth = await loadAuthConfig();
  if (!auth) {
    return null;
  }

  if (!isTokenExpired(auth)) {
    return auth;
  }

  try {
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
  } catch (error) {
    // Token refresh failed, return null
    return null;
  }
}

/**
 * Require authentication - exits if not logged in
 * Use this only when authentication is mandatory
 */
export async function requireAuthenticatedCli(): Promise<AuthConfig> {
  const auth = await getAuthenticatedCli();
  if (!auth) {
    console.error(chalk.red('✖ DevSync CLI is not logged in.'));
    console.error(chalk.gray('Run `devsync login` to connect this machine to your account.'));
    process.exit(1);
  }
  return auth;
}

