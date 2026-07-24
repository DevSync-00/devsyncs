/**
 * Authentication Check Utility
 * Ensures CLI is authenticated before performing operations
 */

import chalk from 'chalk';
import { loadAuthConfig, saveAuthConfig, isTokenExpired, deriveExpiryFromToken } from './auth-config.js';
import { AnalyzerApiClient } from './analyzer-api-client.js';
import type { AuthConfig } from './auth-config.js';
import { resolveDashboardUrl } from '../utils/dashboard-url.js';

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

  // Check if token is actually expired (not just within buffer)
  // For fresh tokens, we don't want to trigger unnecessary refreshes
  const now = Date.now() / 1000;
  const timeUntilExpiry = existing.expiresAt - now;
  const actuallyExpired = deps.isTokenExpired(existing.expiresAt, 0);
  
  // Debug logging to help diagnose issues
  if (!silent && process.env.DEVSYNC_DEBUG === '1') {
    log(deps.chalk.gray(`   Current time: ${now} (${new Date(now * 1000).toISOString()})`));
    log(deps.chalk.gray(`   Token expires: ${existing.expiresAt} (${new Date(existing.expiresAt * 1000).toISOString()})`));
    log(deps.chalk.gray(`   Time until expiry: ${Math.floor(timeUntilExpiry / 60)} minutes`));
    log(deps.chalk.gray(`   Token valid: ${!actuallyExpired}`));
    log(deps.chalk.gray(`   Has accessToken: ${!!existing.accessToken}`));
    log(deps.chalk.gray(`   Has refreshToken: ${!!existing.refreshToken}`));
  }
  
  if (!actuallyExpired) {
    // Token is still valid - return immediately without refresh
    // Even if it's close to expiration, we'll refresh it when it's actually needed
    // This prevents false positives for fresh tokens
    
    // Validate that the token has required fields before returning
    if (!existing.accessToken || !existing.refreshToken) {
      log(deps.chalk.red('❌ Invalid token configuration: missing access or refresh token.'));
      log(deps.chalk.gray('   Run `devsync login` to re-authenticate.\n'));
      process.exit(1);
    }
    
    // Token is valid - return it
    if (!silent && process.env.DEVSYNC_DEBUG === '1') {
      log(deps.chalk.gray('   Returning valid token without refresh'));
    }
    return existing;
  }
  
  // If token expired very recently (within last 5 minutes), it might be a clock skew issue
  // Try to use it anyway if it's only slightly expired
  if (timeUntilExpiry > -300) { // Expired less than 5 minutes ago
    log(deps.chalk.yellow('⚠️  Token appears expired, but may be due to clock skew. Attempting refresh...'));
  }
  
  // Token is actually expired - try to refresh
  log(deps.chalk.gray('🔄 Access token expired, refreshing...'));

  try {
    const dashboardUrl = existing.apiUrl || resolveDashboardUrl();
    const client = new deps.AnalyzerApiClient(dashboardUrl, {
      timeoutMs: 60000, // Increased to 1 minute for better reliability
      retryAttempts: 3,
    });

    const refreshed = await client.refreshTokens(existing.refreshToken);

    // Check if refresh token is also expired
    if (refreshed.refresh_expires_in) {
      const refreshExpiresAt = Math.floor(Date.now() / 1000) + refreshed.refresh_expires_in;
      if (refreshExpiresAt <= Math.floor(Date.now() / 1000)) {
        log(deps.chalk.red('❌ Refresh token expired. Please log in again.'));
        log(deps.chalk.gray('   Run `devsync login` to re-authenticate.\n'));
        process.exit(1);
      }
    }

    // Derive expiry from new access token
    let newExpiresAt: number;
    try {
      newExpiresAt = deps.deriveExpiryFromToken(refreshed.access_token);
      // Validate that the expiry is in the future
      const now = Math.floor(Date.now() / 1000);
      if (newExpiresAt <= now) {
        // Token expiry is in the past - this shouldn't happen for a fresh token
        // Fall back to calculating from expires_in if available
        if (refreshed.expires_in) {
          newExpiresAt = now + refreshed.expires_in;
        } else {
          throw new Error('Token expiry is in the past and no expires_in provided');
        }
      }
    } catch (error) {
      // If we can't parse the token expiry, calculate from expires_in
      const now = Math.floor(Date.now() / 1000);
      if (refreshed.expires_in) {
        newExpiresAt = now + refreshed.expires_in;
      } else {
        throw new Error(`Failed to determine token expiry: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Ensure expiresAt is in seconds (not milliseconds)
    if (newExpiresAt > 10000000000) {
      // If expiry is > year 2286, it's likely in milliseconds, convert to seconds
      newExpiresAt = Math.floor(newExpiresAt / 1000);
    }

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

    // Check if it's a refresh token expiration error (invalid token)
    if (errorMessage.includes('refresh token is invalid') || 
        errorMessage.includes('401') ||
        errorMessage.includes('Unauthorized')) {
      // Only throw if refresh token is actually invalid
      // This is a real authentication failure
      throw new Error('Refresh token expired or invalid. Please log in again.');
    }

    // For network errors, don't throw - use existing token if still valid
    // Sessions are lifecycle-based: they remain active during network issues
    if (errorMessage.includes('timeout') || 
        errorMessage.includes('ECONNREFUSED') || 
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('network') ||
        errorMessage.includes('fetch failed')) {
      // Network error - check if token is still valid
      const now = Date.now() / 1000;
      const stillValid = now < existing.expiresAt;
      
      if (stillValid) {
        // Token is still valid, just couldn't refresh - use it
        // Don't log here - let the caller decide if they want to show a warning
        return existing;
      } else {
        // Token is expired and can't refresh due to network - this is an error
        throw new Error(`Token expired and cannot refresh due to network error: ${errorMessage}`);
      }
    }

    // Other errors - check if token is still valid before throwing
    // If token hasn't actually expired yet, use it
    const now = Date.now() / 1000;
    const stillValid = now < existing.expiresAt;
    if (stillValid) {
      // Token is still valid, just couldn't refresh - use it
      return existing;
    }

    // Token is actually expired and refresh failed - this is an error
    // But don't exit - let the caller handle it
    throw new Error(`Failed to refresh token: ${errorMessage}`);
  }
}

