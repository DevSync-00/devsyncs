/**
 * UI notification layer.
 * 
 * Centralizes all UI feedback operations to separate presentation
 * from business logic. This allows services to remain UI-agnostic.
 */

import * as vscode from 'vscode';

/**
 * Service for displaying user notifications.
 * 
 * Provides a clean interface for showing messages, progress, and status
 * updates without coupling business logic to VS Code UI APIs.
 * 
 * @example
 * ```typescript
 * const notifications = new NotificationService();
 * await notifications.showInfo('Operation completed successfully');
 * ```
 */
export class NotificationService {
  /**
   * Shows an information message to the user.
   * 
   * @param message - The message to display
   * @param items - Optional action items to show as buttons
   * @returns Promise resolving to the selected action, or undefined if dismissed
   */
  async showInfo(message: string, ...items: string[]): Promise<string | undefined> {
    if (items.length > 0) {
      return vscode.window.showInformationMessage(message, ...items);
    }
    vscode.window.showInformationMessage(message);
    return undefined;
  }

  /**
   * Shows a warning message to the user.
   * 
   * @param message - The message to display
   * @param items - Optional action items to show as buttons
   * @returns Promise resolving to the selected action, or undefined if dismissed
   */
  async showWarning(message: string, ...items: string[]): Promise<string | undefined> {
    if (items.length > 0) {
      return vscode.window.showWarningMessage(message, ...items);
    }
    vscode.window.showWarningMessage(message);
    return undefined;
  }

  /**
   * Shows an error message to the user.
   * 
   * @param message - The message to display
   * @param items - Optional action items to show as buttons
   * @returns Promise resolving to the selected action, or undefined if dismissed
   */
  async showError(message: string, ...items: string[]): Promise<string | undefined> {
    if (items.length > 0) {
      return vscode.window.showErrorMessage(message, ...items);
    }
    vscode.window.showErrorMessage(message);
    return undefined;
  }

  /**
   * Shows an input box to the user.
   * 
   * @param options - Input box options
   * @returns Promise resolving to the entered value, or undefined if cancelled
   */
  async showInput(options: {
    prompt: string;
    placeHolder?: string;
    value?: string;
    ignoreFocusOut?: boolean;
    validateInput?: (value: string) => string | null;
  }): Promise<string | undefined> {
    return vscode.window.showInputBox(options);
  }

  /**
   * Shows a quick pick menu to the user.
   * 
   * @param items - Array of items to choose from
   * @param options - Quick pick options
   * @returns Promise resolving to the selected item, or undefined if cancelled
   */
  async showQuickPick<T extends string>(
    items: readonly T[],
    options?: {
      placeHolder?: string;
      canPickMany?: boolean;
      ignoreFocusOut?: boolean;
    }
  ): Promise<T | T[] | undefined> {
    return vscode.window.showQuickPick(items as readonly string[], options) as Promise<T | T[] | undefined>;
  }

  /**
   * Opens a URL in the default browser.
   * 
   * @param url - The URL to open
   * @returns Promise that resolves when the URL is opened
   */
  async openExternal(url: string): Promise<void> {
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }
}

