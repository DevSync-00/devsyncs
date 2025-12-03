/**
 * Enhanced error handling with retry options and better error messages.
 */

import * as vscode from 'vscode';
import { ChatMessage, ChatMessageStatus } from '../types';

/**
 * Error recovery options.
 */
export interface ErrorRecoveryOptions {
  message: string;
  error: Error | string;
  messageId: string;
  retryAction?: () => Promise<void>;
  alternativeActions?: Array<{
    label: string;
    action: () => Promise<void>;
  }>;
}

/**
 * Enhanced error recovery handler.
 */
export class ErrorRecovery {
  /**
   * Shows error with retry options.
   */
  static async showErrorWithRetry(options: ErrorRecoveryOptions): Promise<void> {
    const errorMessage = options.error instanceof Error 
      ? options.error.message 
      : options.error;

    const actions: string[] = ['Dismiss'];
    
    if (options.retryAction) {
      actions.unshift('Retry');
    }
    
    if (options.alternativeActions && options.alternativeActions.length > 0) {
      actions.push(...options.alternativeActions.map(a => a.label));
    }

    const choice = await vscode.window.showErrorMessage(
      `Error: ${errorMessage}`,
      ...actions
    );

    if (choice === 'Retry' && options.retryAction) {
      try {
        await options.retryAction();
      } catch (retryError) {
        // Recursive retry with exponential backoff could be added here
        vscode.window.showErrorMessage(
          `Retry failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`
        );
      }
    } else if (choice && options.alternativeActions) {
      const alternative = options.alternativeActions.find(a => a.label === choice);
      if (alternative) {
        try {
          await alternative.action();
        } catch (altError) {
          vscode.window.showErrorMessage(
            `Action failed: ${altError instanceof Error ? altError.message : String(altError)}`
          );
        }
      }
    }
  }

  /**
   * Gets user-friendly error message.
   */
  static getUserFriendlyMessage(error: Error | string): string {
    const errorStr = error instanceof Error ? error.message : error;
    
    // Map common errors to user-friendly messages
    const errorMap: Record<string, string> = {
      'network': 'Network error. Please check your internet connection.',
      'timeout': 'Request timed out. Please try again.',
      'unauthorized': 'Authentication required. Please sign in.',
      'not found': 'Resource not found. Please check your configuration.',
      'rate limit': 'Rate limit exceeded. Please wait a moment and try again.',
    };

    const lowerError = errorStr.toLowerCase();
    for (const [key, message] of Object.entries(errorMap)) {
      if (lowerError.includes(key)) {
        return message;
      }
    }

    return errorStr;
  }

  /**
   * Suggests recovery actions based on error type.
   */
  static getRecoverySuggestions(error: Error | string): Array<{ label: string; action: () => Promise<void> }> {
    const errorStr = error instanceof Error ? error.message : error;
    const lowerError = errorStr.toLowerCase();
    const suggestions: Array<{ label: string; action: () => Promise<void> }> = [];

    if (lowerError.includes('network') || lowerError.includes('connection')) {
      suggestions.push({
        label: 'Check Connection',
        action: async () => {
          vscode.window.showInformationMessage('Please check your internet connection and try again.');
        },
      });
    }

    if (lowerError.includes('auth') || lowerError.includes('unauthorized')) {
      suggestions.push({
        label: 'Sign In',
        action: async () => {
          await vscode.commands.executeCommand('devsync.chat.login');
        },
      });
    }

    if (lowerError.includes('config') || lowerError.includes('configuration')) {
      suggestions.push({
        label: 'Open Settings',
        action: async () => {
          await vscode.commands.executeCommand('workbench.action.openSettings', 'devsync');
        },
      });
    }

    return suggestions;
  }
}

