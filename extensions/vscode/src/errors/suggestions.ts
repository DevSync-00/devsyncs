/**
 * Error recovery suggestions.
 * 
 * Provides intelligent suggestions for recovering from errors
 * based on error type, context, and common patterns.
 */

import * as vscode from 'vscode';
import { DevSyncError, ErrorCode } from './base';
import { ScanError } from './scanError';
import { MigrationError } from './migrationError';
import { AuthError } from './authError';

/**
 * Recovery suggestion.
 */
export interface RecoverySuggestion {
  /** Suggestion title */
  title: string;
  /** Suggestion description */
  description: string;
  /** Action to execute */
  action: () => Promise<void>;
  /** Priority (higher = more important) */
  priority: number;
}

/**
 * Error recovery suggestion provider.
 */
export class ErrorSuggestionProvider {
  /**
   * Gets recovery suggestions for an error.
   * 
   * @param error - The error to get suggestions for
   * @param context - Additional context
   * @returns Array of recovery suggestions
   */
  static getSuggestions(
    error: DevSyncError,
    context?: Record<string, unknown>
  ): RecoverySuggestion[] {
    const suggestions: RecoverySuggestion[] = [];

    if (error instanceof ScanError) {
      suggestions.push(...this.getScanErrorSuggestions(error, context));
    } else if (error instanceof MigrationError) {
      suggestions.push(...this.getMigrationErrorSuggestions(error, context));
    } else if (error instanceof AuthError) {
      suggestions.push(...this.getAuthErrorSuggestions(error, context));
    }

    // Add generic suggestions
    suggestions.push(...this.getGenericSuggestions(error, context));

    // Sort by priority
    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Gets suggestions for scan errors.
   */
  private static getScanErrorSuggestions(
    error: ScanError,
    context?: Record<string, unknown>
  ): RecoverySuggestion[] {
    const suggestions: RecoverySuggestion[] = [];

    // Network errors
    if (error.context?.network) {
      suggestions.push({
        title: 'Check Network Connection',
        description: 'Verify your internet connection and try again.',
        action: async () => {
          await vscode.window.showInformationMessage(
            'Please check your network connection and try again.'
          );
        },
        priority: 10,
      });

      suggestions.push({
        title: 'Check API URL Settings',
        description: 'Verify that the API URL in settings is correct.',
        action: async () => {
          await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'devsync.apiUrl'
          );
        },
        priority: 9,
      });
    }

    // Configuration errors
    if (error.context?.missingFields) {
      const missingFields = error.context.missingFields as string[];
      suggestions.push({
        title: 'Configure Missing Settings',
        description: `The following settings are missing: ${missingFields.join(', ')}`,
        action: async () => {
          await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'devsync'
          );
        },
        priority: 10,
      });
    }

    // Database connection errors
    if (error.context?.dbConnection) {
      suggestions.push({
        title: 'Check Database Connection',
        description: 'Verify your database connection string is correct.',
        action: async () => {
          await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'devsync.databaseConnection'
          );
        },
        priority: 9,
      });
    }

    // Retry suggestion
    if (error.isRecoverable()) {
      suggestions.push({
        title: 'Retry Operation',
        description: 'The error may be temporary. Try running the scan again.',
        action: async () => {
          await vscode.commands.executeCommand('devsync.scan');
        },
        priority: 5,
      });
    }

    return suggestions;
  }

  /**
   * Gets suggestions for migration errors.
   */
  private static getMigrationErrorSuggestions(
    error: MigrationError,
    context?: Record<string, unknown>
  ): RecoverySuggestion[] {
    const suggestions: RecoverySuggestion[] = [];

    // No scan report
    if (error.context?.noScan) {
      suggestions.push({
        title: 'Run Scan First',
        description: 'A scan must be run before generating migrations.',
        action: async () => {
          await vscode.commands.executeCommand('devsync.scan');
        },
        priority: 10,
      });
    }

    // Database errors
    if (error.context?.dbError) {
      suggestions.push({
        title: 'Check Database Connection',
        description: 'Verify your database is accessible and connection string is correct.',
        action: async () => {
          await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            'devsync.databaseConnection'
          );
        },
        priority: 9,
      });
    }

    // Retry suggestion
    if (error.isRecoverable()) {
      suggestions.push({
        title: 'Retry Migration Generation',
        description: 'Try generating the migration again.',
        action: async () => {
          await vscode.commands.executeCommand('devsync.generateMigration');
        },
        priority: 5,
      });
    }

    return suggestions;
  }

  /**
   * Gets suggestions for auth errors.
   */
  private static getAuthErrorSuggestions(
    error: AuthError,
    context?: Record<string, unknown>
  ): RecoverySuggestion[] {
    const suggestions: RecoverySuggestion[] = [];

    // Expired or invalid token
    if (error.context?.expired || error.context?.invalidToken) {
      suggestions.push({
        title: 'Sign In Again',
        description: 'Your authentication token has expired. Please sign in again.',
        action: async () => {
          await vscode.commands.executeCommand('devsync.chat.login');
        },
        priority: 10,
      });
    }

    // Network errors
    if (error.context?.network) {
      suggestions.push({
        title: 'Check Network Connection',
        description: 'Verify your internet connection and try again.',
        action: async () => {
          await vscode.window.showInformationMessage(
            'Please check your network connection and try again.'
          );
        },
        priority: 9,
      });
    }

    return suggestions;
  }

  /**
   * Gets generic suggestions.
   */
  private static getGenericSuggestions(
    error: DevSyncError,
    context?: Record<string, unknown>
  ): RecoverySuggestion[] {
    const suggestions: RecoverySuggestion[] = [];

    // View error details
    suggestions.push({
      title: 'View Error Details',
      description: 'Check the output panel for detailed error information.',
      action: async () => {
        // This would show the error logger output
        await vscode.commands.executeCommand('workbench.action.output.toggleOutput');
      },
      priority: 3,
    });

    // Check documentation
    suggestions.push({
      title: 'Check Documentation',
      description: 'View the DevSync documentation for troubleshooting tips.',
      action: async () => {
        await vscode.env.openExternal(
          vscode.Uri.parse('https://github.com/devsync/docs')
        );
      },
      priority: 2,
    });

    return suggestions;
  }

  /**
   * Shows suggestions to the user.
   */
  static async showSuggestions(
    error: DevSyncError,
    context?: Record<string, unknown>
  ): Promise<void> {
    const suggestions = this.getSuggestions(error, context);

    if (suggestions.length === 0) {
      return;
    }

    // Show primary suggestion
    const primarySuggestion = suggestions[0];
    const action = await vscode.window.showErrorMessage(
      error.getUserMessage(),
      primarySuggestion.title,
      'View All Suggestions',
      'Dismiss'
    );

    if (action === primarySuggestion.title) {
      await primarySuggestion.action();
    } else if (action === 'View All Suggestions') {
      // Show quick pick with all suggestions
      const items = suggestions.map((s) => ({
        label: s.title,
        description: s.description,
        suggestion: s,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a recovery action',
      });

      if (selected) {
        await selected.suggestion.action();
      }
    }
  }
}

