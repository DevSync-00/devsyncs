/**
 * Auth Config Management
 * Handles loading and saving authentication configuration
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

export interface AuthConfig {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in seconds
  refreshExpiresAt?: number; // Unix timestamp in seconds
  userId?: string;
  clientId: string;
  apiUrl?: string; // Dashboard API URL
}

let authConfigPathOverride: string | null = null;

/**
 * Set custom auth config path (for testing)
 * This is exported for test utilities
 */
export function setAuthConfigPath(path: string | null): void {
  authConfigPathOverride = path;
}

/**
 * Get the default auth config path
 */
function getDefaultAuthConfigPath(): string {
  if (authConfigPathOverride) {
    return authConfigPathOverride;
  }

  // Check environment variable first
  const envPath = process.env.DEVSYNC_CONFIG_PATH;
  if (envPath) {
    return envPath;
  }

  // Default to ~/.config/devsync/config.json
  return join(homedir(), '.config', 'devsync', 'config.json');
}

/**
 * Load authentication configuration
 */
export async function loadAuthConfig(): Promise<AuthConfig | null> {
  const configPath = getDefaultAuthConfigPath();

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as Partial<AuthConfig>;

    // Validate required fields
    if (!config.accessToken || !config.refreshToken || !config.expiresAt || !config.clientId) {
      return null;
    }

    return {
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
      expiresAt: config.expiresAt,
      refreshExpiresAt: config.refreshExpiresAt,
      userId: config.userId,
      clientId: config.clientId,
      apiUrl: config.apiUrl,
    };
  } catch (error) {
    // If config is corrupted, return null (user will need to re-login)
    if (error instanceof SyntaxError) {
      return null;
    }
    throw new Error(`Failed to load auth config: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Save authentication configuration
 */
export async function saveAuthConfig(config: AuthConfig): Promise<void> {
  const configPath = getDefaultAuthConfigPath();

  try {
    // Ensure directory exists
    mkdirSync(dirname(configPath), { recursive: true });

    // Write config file
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Set appropriate permissions (read/write for owner only on Unix)
    if (process.platform !== 'win32') {
      try {
        const { chmodSync } = await import('fs');
        chmodSync(configPath, 0o600); // rw-------
      } catch {
        // Ignore chmod errors (may not be available in all environments)
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to save auth config: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      `Ensure you have write permissions for ${dirname(configPath)}`
    );
  }
}

/**
 * Delete authentication configuration (logout)
 */
export async function deleteAuthConfig(): Promise<void> {
  const configPath = getDefaultAuthConfigPath();

  if (!existsSync(configPath)) {
    return;
  }

  try {
    const { unlinkSync } = await import('fs');
    unlinkSync(configPath);
  } catch (error) {
    throw new Error(
      `Failed to delete auth config: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(expiresAt: number, bufferSeconds: number = 60): boolean {
  // Add buffer to refresh before actual expiration
  return Date.now() / 1000 >= (expiresAt - bufferSeconds);
}

/**
 * Derive expiry timestamp from JWT token
 * Returns expiry in seconds (Unix timestamp)
 */
export function deriveExpiryFromToken(token: string): number {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    
    if (!payload.exp) {
      throw new Error('JWT missing expiration claim');
    }

    return payload.exp;
  } catch (error) {
    throw new Error(
      `Failed to parse token expiry: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

