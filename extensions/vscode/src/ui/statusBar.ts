/**
 * Status bar UI layer.
 * 
 * Manages status bar items for showing operation progress and status.
 */

import * as vscode from 'vscode';
import { createStatusBarItem } from '../utils/ui';

/**
 * Service for managing status bar items.
 * 
 * Provides a clean interface for showing progress and status in the
 * VS Code status bar without coupling business logic to UI APIs.
 * 
 * @example
 * ```typescript
 * const statusBar = new StatusBarService();
 * const item = statusBar.showProgress('Scanning...');
 * // ... do work ...
 * statusBar.hideProgress(item);
 * ```
 */
export class StatusBarService {
  private activeItems: Set<vscode.StatusBarItem> = new Set();

  /**
   * Shows a progress message in the status bar.
   * 
   * @param message - The message to display
   * @param alignment - Status bar alignment (default: Left)
   * @param priority - Status bar priority (default: 100)
   * @returns The status bar item that was created
   */
  showProgress(
    message: string,
    alignment: vscode.StatusBarAlignment = vscode.StatusBarAlignment.Left,
    priority: number = 100
  ): vscode.StatusBarItem {
    const item = createStatusBarItem(alignment, priority);
    item.text = message;
    item.show();
    this.activeItems.add(item);
    return item;
  }

  /**
   * Updates a status bar item's message.
   * 
   * @param item - The status bar item to update
   * @param message - The new message
   */
  updateProgress(item: vscode.StatusBarItem, message: string): void {
    item.text = message;
  }

  /**
   * Hides and disposes a status bar item.
   * 
   * @param item - The status bar item to hide
   */
  hideProgress(item: vscode.StatusBarItem): void {
    item.dispose();
    this.activeItems.delete(item);
  }

  /**
   * Shows a temporary status message.
   * 
   * @param message - The message to display
   * @param duration - How long to show the message in milliseconds (default: 3000)
   * @returns Promise that resolves when the message is hidden
   */
  async showTemporary(message: string, duration: number = 3000): Promise<void> {
    const item = this.showProgress(message);
    await new Promise((resolve) => setTimeout(resolve, duration));
    this.hideProgress(item);
  }

  /**
   * Disposes all active status bar items.
   */
  dispose(): void {
    this.activeItems.forEach((item) => item.dispose());
    this.activeItems.clear();
  }
}

