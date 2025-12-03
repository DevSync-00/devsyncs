import * as vscode from 'vscode';
import { DevSyncError, ErrorCode } from './base';
import { ScanError } from './scanError';
import { MigrationError } from './migrationError';
import { AuthError } from './authError';

/**
 * Recovery action result
 */
export interface RecoveryResult {
  success: boolean;
  message?: string;
  retry?: () => Promise<void>;
}

/**
 * Error recovery service
 */
export class ErrorRecovery {
  /**
   * Attempt to recover from an error
   */
  static async recover(
    error: DevSyncError,
    context?: Record<string, unknown>
  ): Promise<RecoveryResult> {
    // Try specific recovery strategies based on error type
    if (error instanceof ScanError) {
      return this.recoverFromScanError(error, context);
    }

    if (error instanceof MigrationError) {
      return this.recoverFromMigrationError(error, context);
    }

    if (error instanceof AuthError) {
      return this.recoverFromAuthError(error, context);
    }

    // Generic recovery
    return this.recoverGeneric(error, context);
  }

  /**
   * Recover from scan errors
   */
  private static async recoverFromScanError(
    error: ScanError,
    context?: Record<string, unknown>
  ): Promise<RecoveryResult> {
    // Network errors - suggest checking connection
    if (error.context?.network) {
      const action = await vscode.window.showWarningMessage(
        error.getUserMessage(),
        'Check Settings',
        'Retry',
        'Dismiss'
      );

      if (action === 'Check Settings') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'devsync.apiUrl');
        return { success: false, message: 'Please update your settings and try again.' };
      }

      if (action === 'Retry') {
        return {
          success: true,
          message: 'Retrying scan operation...',
          retry: async () => {
            await vscode.commands.executeCommand('devsync.scan');
          },
        };
      }
    }

    // Configuration errors - suggest opening settings
    if (error.context?.missingFields) {
      const action = await vscode.window.showWarningMessage(
        error.getUserMessage(),
        'Open Settings',
        'Dismiss'
      );

      if (action === 'Open Settings') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'devsync');
        return { success: false, message: 'Please configure the required settings.' };
      }
    }

    return { success: false };
  }

  /**
   * Recover from migration errors
   */
  private static async recoverFromMigrationError(
    error: MigrationError,
    context?: Record<string, unknown>
  ): Promise<RecoveryResult> {
    // No scan report - suggest running scan first
    if (error.context?.noScan) {
      const action = await vscode.window.showWarningMessage(
        error.getUserMessage(),
        'Run Scan',
        'Dismiss'
      );

      if (action === 'Run Scan') {
        return {
          success: true,
          message: 'Running scan first...',
          retry: async () => {
            await vscode.commands.executeCommand('devsync.scan');
          },
        };
      }
    }

    // Database connection errors
    if (error.context?.dbConnection) {
      const action = await vscode.window.showWarningMessage(
        error.getUserMessage(),
        'Check Connection',
        'Dismiss'
      );

      if (action === 'Check Connection') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'devsync.databaseConnection');
        return { success: false, message: 'Please verify your database connection string.' };
      }
    }

    return { success: false };
  }

  /**
   * Recover from auth errors
   */
  private static async recoverFromAuthError(
    error: AuthError,
    context?: Record<string, unknown>
  ): Promise<RecoveryResult> {
    // Expired or invalid token - suggest re-authentication
    if (error.context?.expired || error.context?.invalidToken) {
      const action = await vscode.window.showWarningMessage(
        error.getUserMessage(),
        'Sign In',
        'Dismiss'
      );

      if (action === 'Sign In') {
        return {
          success: true,
          message: 'Opening sign-in flow...',
          retry: async () => {
            await vscode.commands.executeCommand('devsync.chat.login');
          },
        };
      }
    }

    // Network errors
    if (error.context?.network) {
      const action = await vscode.window.showWarningMessage(
        error.getUserMessage(),
        'Check Settings',
        'Retry',
        'Dismiss'
      );

      if (action === 'Check Settings') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'devsync.analyzerUrl');
        return { success: false, message: 'Please verify your analyzer URL setting.' };
      }

      if (action === 'Retry') {
        return {
          success: true,
          message: 'Retrying authentication...',
          retry: async () => {
            await vscode.commands.executeCommand('devsync.chat.login');
          },
        };
      }
    }

    return { success: false };
  }

  /**
   * Generic recovery strategy
   */
  private static async recoverGeneric(
    error: DevSyncError,
    context?: Record<string, unknown>
  ): Promise<RecoveryResult> {
    if (error.isRecoverable()) {
      const action = await vscode.window.showWarningMessage(
        error.getUserMessage(),
        'Retry',
        'View Details',
        'Dismiss'
      );

      if (action === 'View Details') {
        // Show output channel - would need logger instance
        return { success: false, message: 'Check the output panel for details.' };
      }

      if (action === 'Retry') {
        return {
          success: true,
          message: 'Please retry the operation manually.',
        };
      }
    }

    return { success: false };
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }
}

