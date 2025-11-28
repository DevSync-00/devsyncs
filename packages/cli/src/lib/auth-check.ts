/**
 * Authentication Check Utility
 * Ensures CLI is authenticated before performing operations
 */

import chalk from 'chalk';
import { loadAuthConfig, saveAuthConfig, isTokenExpired, deriveExpiryFromToken } from './auth-config.js';
import { AnalyzerApiClient } from './analyzer-api-client.js';
import type { AuthConfig } from './auth-config.js';

// Dependency injection for testing
let deps = {
  chalk,
  loadAuthConfig,
  saveAuthConfig,
  isTokenExpired,
  AnalyzerApiClient,
  deriveExpiryFromToken,
};

export function __setAuthCheckDeps(newDeps: Partial<typeof deps>): void {
  deps = { ...deps, ...newDeps };
}

export function __resetAuthCheckDeps(): void {
  deps = {
    chalk,
    loadAuthConfig,
    saveAuthConfig,
    isTokenExpired,
    AnalyzerApiClient,
    deriveExpiryFromToken,
  };
}

/**
 * Get analyzer URL from environment or default
 */
function getAnalyzerUrl(): string {
  return process.env.ANALYZER_URL || 
         process.env.NEXT_PUBLIC_ANALYZER_URL || 
         'http://localhost:4000';
}

/**
 * Require authenticated CLI session
 * Returns auth config if valid, refreshes if expired, or exits if not authenticated
 */
export async function requireAuthenticatedCli(): Promise<AuthConfig> {
  const silent = process.env.DEVSYNC_SILENT === '1';
  const log = silent ? () => {} : console.log;

  // Load existing auth config
  const existing = await deps.loadAuthConfig();

  if (!existing) {
    log(deps.chalk.red('❌ DevSync CLI is not logged in.'));
    log(deps.chalk.gray('   Run `devsync login` to authenticate.\n'));
    process.exit(1);
  }

  // Check if token is expired
  const expired = deps.isTokenExpired(existing.expiresAt);

  if (!expired) {
    // Token is still valid
    return existing;
  }

  // Token expired, try to refresh
  log(deps.chalk.gray('🔄 Access token expired, refreshing...'));

  try {
    const analyzerUrl = getAnalyzerUrl();
    const client = new deps.AnalyzerApiClient(analyzerUrl, {
      timeoutMs: 30000,
      retryAttempts: 3,
    });

    const refreshed = await client.refreshTokens(existing.refreshToken);

    // Check if refresh token is also expired
    if (refreshed.refresh_expires_in) {
      const refreshExpiresAt = Math.floor(Date.now() / 1000) + refreshed.refresh_expires_in;
      if (deps.isTokenExpired(refreshExpiresAt)) {
        log(deps.chalk.red('❌ Refresh token expired. Please log in again.'));
        log(deps.chalk.gray('   Run `devsync login` to re-authenticate.\n'));
        process.exit(1);
      }
    }

    // Derive expiry from new access token
    const newExpiresAt = deps.deriveExpiryFromToken(refreshed.access_token);

    const updated: AuthConfig = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: newExpiresAt,
      refreshExpiresAt: refreshed.refresh_expires_in
        ? Math.floor(Date.now() / 1000) + refreshed.refresh_expires_in
        : undefined,
      userId: refreshed.user_id,
      clientId: refreshed.client_id,
      apiUrl: existing.apiUrl,
    };

    // Save updated config
    await deps.saveAuthConfig(updated);

    log(deps.chalk.green('✅ Token refreshed successfully.\n'));

    return updated;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if it's a refresh token expiration error
    if (errorMessage.includes('refresh token is invalid') || 
        errorMessage.includes('expired') ||
        errorMessage.includes('401')) {
      log(deps.chalk.red('❌ Refresh token expired. Please log in again.'));
      log(deps.chalk.gray('   Run `devsync login` to re-authenticate.\n'));
      process.exit(1);
    }

    // Other errors
    log(deps.chalk.red(`❌ Failed to refresh token: ${errorMessage}`));
    log(deps.chalk.gray('   Run `devsync login` to re-authenticate.\n'));
    process.exit(1);
  }
}

