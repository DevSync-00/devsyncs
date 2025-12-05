/**
 * Session timeout manager with warnings.
 * 
 * Monitors session expiration and provides warnings before timeout.
 */

import * as vscode from 'vscode';
import type { IAuthManager } from '../interfaces';

/**
 * Session timeout configuration
 */
export interface SessionTimeoutConfig {
  /**
   * Warning intervals before expiration (in milliseconds)
   * Default: [15 minutes, 5 minutes, 1 minute]
   */
  warningIntervals: number[];

  /**
   * Enable session timeout warnings
   * Default: true
   */
  enabled: boolean;

  /**
   * Check interval (in milliseconds)
   * Default: 1 minute
   */
  checkInterval: number;
}

/**
 * Session timeout warning event
 */
export interface SessionTimeoutWarning {
  type: 'warning' | 'expired' | 'extended';
  timeRemaining: number; // milliseconds
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
      warningIntervals: [
        15 * 60 * 1000, // 15 minutes
        5 * 60 * 1000,  // 5 minutes
        1 * 60 * 1000,  // 1 minute
      ],
      enabled: true,
      checkInterval: 60 * 1000, // 1 minute
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
   * Check session and emit warnings if needed
   */
  private async checkSession(): Promise<void> {
    const session = this.authManager.getSession();

    if (session.status !== 'authenticated') {
      this.resetWarnings();
      return;
    }

    if (!session.expiresAt) {
      return; // No expiration info
    }

    const now = Date.now();
    const timeRemaining = session.expiresAt - now;

    if (timeRemaining <= 0) {
      // Session expired
      this.emitWarning({
        type: 'expired',
        timeRemaining: 0,
        message: 'Your session has expired. Please sign in again.',
        severity: 'error',
      });
      this.resetWarnings();
      return;
    }

    // Check each warning interval
    for (const interval of this.config.warningIntervals.sort((a, b) => b - a)) {
      if (timeRemaining <= interval && !this.warnedIntervals.has(interval)) {
        this.warnedIntervals.add(interval);
        this.emitWarning({
          type: 'warning',
          timeRemaining,
          message: this.formatWarningMessage(timeRemaining),
          severity: this.getSeverity(timeRemaining),
        });
      }
    }
  }

  /**
   * Format warning message based on time remaining
   */
  private formatWarningMessage(timeRemaining: number): string {
    const minutes = Math.floor(timeRemaining / (60 * 1000));
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `Your session will expire in ${hours} hour${hours > 1 ? 's' : ''} and ${minutes % 60} minute${minutes % 60 !== 1 ? 's' : ''}.`;
    } else if (minutes > 0) {
      return `Your session will expire in ${minutes} minute${minutes !== 1 ? 's' : ''}.`;
    } else {
      const seconds = Math.floor(timeRemaining / 1000);
      return `Your session will expire in ${seconds} second${seconds !== 1 ? 's' : ''}.`;
    }
  }

  /**
   * Get severity level based on time remaining
   */
  private getSeverity(timeRemaining: number): 'info' | 'warning' | 'error' {
    const minutes = timeRemaining / (60 * 1000);

    if (minutes <= 1) {
      return 'error';
    } else if (minutes <= 5) {
      return 'warning';
    } else {
      return 'info';
    }
  }

  /**
   * Emit warning event and show notification
   */
  private emitWarning(warning: SessionTimeoutWarning): void {
    this.timeoutEmitter.fire(warning);

    // Show VS Code notification
    if (warning.type === 'expired') {
      vscode.window.showErrorMessage(warning.message, 'Sign In').then((action) => {
        if (action === 'Sign In') {
          void vscode.commands.executeCommand('devsync.chat.login');
        }
      });
    } else if (warning.severity === 'error') {
      vscode.window.showErrorMessage(warning.message, 'Extend Session').then((action) => {
        if (action === 'Extend Session') {
          void this.extendSession();
        }
      });
    } else if (warning.severity === 'warning') {
      vscode.window.showWarningMessage(warning.message, 'Extend Session').then((action) => {
        if (action === 'Extend Session') {
          void this.extendSession();
        }
      });
    } else {
      vscode.window.showInformationMessage(warning.message);
    }
  }

  /**
   * Extend session by refreshing token
   */
  private async extendSession(): Promise<void> {
    try {
      await this.authManager.ensureAccessToken();
      this.emitWarning({
        type: 'extended',
        timeRemaining: 0,
        message: 'Session extended successfully.',
        severity: 'info',
      });
      this.resetWarnings();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to extend session';
      vscode.window.showErrorMessage(`Failed to extend session: ${message}`);
    }
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

