/**
 * Session lifecycle manager.
 * 
 * Monitors session state and handles lifecycle events (login, logout, window close).
 * Sessions remain active indefinitely while the user is working and only terminate
 * on explicit logout or window/process close.
 */

import * as vscode from 'vscode';
import type { IAuthManager } from '../interfaces';

/**
 * Session lifecycle configuration
 * 
 * Note: Sessions are now lifecycle-based, not time-based.
 * Sessions remain active until explicit logout or window/process close.
 */
export interface SessionTimeoutConfig {
  /**
   * @deprecated Warning intervals are no longer used - sessions don't expire based on time
   * Kept for backward compatibility but ignored
   */
  warningIntervals: number[];

  /**
   * Enable session lifecycle monitoring
   * Default: true
   */
  enabled: boolean;

  /**
   * Check interval for token refresh (in milliseconds)
   * Default: 5 minutes - checks if token needs refresh
   */
  checkInterval: number;
}

/**
 * Session lifecycle warning event
 * 
 * Only used for actual errors (e.g., refresh token invalid), not time-based expiration
 */
export interface SessionTimeoutWarning {
  type: 'warning' | 'expired' | 'extended';
  timeRemaining: number; // milliseconds (not used for expiration, kept for compatibility)
  message: string;
  severity: 'info' | 'warning' | 'error';
}

/**
 * Session timeout manager
 */
export class SessionTimeoutManager {
  private timeoutTimer: NodeJS.Timeout | null = null;
  private warnedIntervals: Set<number> = new Set();
  private timeoutEmitter = new vscode.EventEmitter<SessionTimeoutWarning>();
  public readonly onTimeoutWarning = this.timeoutEmitter.event;

  constructor(
    private authManager: IAuthManager,
    private config: SessionTimeoutConfig = {
      warningIntervals: [], // No longer used - sessions don't expire
      enabled: true,
      checkInterval: 5 * 60 * 1000, // 5 minutes - check for token refresh
    }
  ) {
    // Listen for session changes
    this.authManager.onDidChangeSession(() => {
      this.resetWarnings();
      void this.checkSession();
    });
  }

  /**
   * Start monitoring session timeout
   */
  start(): void {
    if (!this.config.enabled) {
      return;
    }

    this.stop(); // Clear any existing timer

    // Check immediately
    void this.checkSession();

    // Set up periodic checks
    this.timeoutTimer = setInterval(() => {
      void this.checkSession();
    }, this.config.checkInterval);
  }

  /**
   * Stop monitoring session timeout
   */
  stop(): void {
    if (this.timeoutTimer) {
      clearInterval(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  /**
   * Check session and ensure token is refreshed if needed
   * 
   * Sessions are lifecycle-based: they remain active indefinitely while the user is working.
   * We only check if the token needs to be refreshed to keep the session alive.
   */
  private async checkSession(): Promise<void> {
    const session = this.authManager.getSession();

    if (session.status !== 'authenticated') {
      this.resetWarnings();
      return;
    }

    if (!session.expiresAt) {
      return; // No expiration info - session is valid
    }

    const now = Date.now();
    const timeUntilExpiry = session.expiresAt - now;

    // If token is about to expire (within 2 minutes), refresh it automatically
    // This keeps the session alive indefinitely while the user is working
    if (timeUntilExpiry <= 2 * 60 * 1000) {
      try {
        // Automatically refresh token to keep session alive
        await this.authManager.ensureAccessToken();
        // Token refreshed successfully - session continues
      } catch (error) {
        // If refresh fails, only then do we consider the session invalid
        // This handles cases where refresh token is invalid or network is down
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('refresh') || errorMessage.includes('invalid')) {
          // Refresh token is invalid - user needs to re-authenticate
          this.emitWarning({
            type: 'expired',
            timeRemaining: 0,
            message: 'Session refresh failed. Please sign in again.',
            severity: 'error',
          });
          this.resetWarnings();
        }
        // For network errors, don't expire session - it will retry on next check
      }
    }
    
    // No time-based expiration warnings - sessions don't expire based on inactivity
  }

  /**
   * Format warning message (no longer used for time-based warnings)
   * @deprecated Sessions don't expire based on time
   */
  private formatWarningMessage(timeRemaining: number): string {
    // Not used anymore - sessions are lifecycle-based
    return '';
  }

  /**
   * Get severity level (no longer used for time-based warnings)
   * @deprecated Sessions don't expire based on time
   */
  private getSeverity(timeRemaining: number): 'info' | 'warning' | 'error' {
    // Not used anymore - sessions are lifecycle-based
    return 'info';
  }

  /**
   * Emit warning event and show notification
   * 
   * Only used for actual errors (e.g., refresh token invalid), not time-based expiration
   */
  private emitWarning(warning: SessionTimeoutWarning): void {
    this.timeoutEmitter.fire(warning);

    // Only show notifications for actual errors (refresh token invalid, etc.)
    // Not for time-based expiration since sessions don't expire based on time
    if (warning.type === 'expired') {
      vscode.window.showErrorMessage(warning.message, 'Sign In').then((action) => {
        if (action === 'Sign In') {
          void vscode.commands.executeCommand('devsync.chat.login');
        }
      });
    }
    // No other warnings - sessions are lifecycle-based and don't expire
  }

  /**
   * Reset warning intervals (called when session changes)
   */
  private resetWarnings(): void {
    this.warnedIntervals.clear();
  }

  /**
   * Update timeout configuration
   */
  updateConfig(config: Partial<SessionTimeoutConfig>): void {
    this.config = { ...this.config, ...config };
    this.resetWarnings();

    if (this.config.enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  /**
   * Get current timeout configuration
   */
  getConfig(): Readonly<SessionTimeoutConfig> {
    return { ...this.config };
  }

  /**
   * Dispose of the timeout manager
   */
  dispose(): void {
    this.stop();
    this.timeoutEmitter.dispose();
  }
}

