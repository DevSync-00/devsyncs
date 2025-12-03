/**
 * Utility functions for VS Code UI components
 */

import * as vscode from 'vscode';

/**
 * Create a status bar item with common configuration
 */
export function createStatusBarItem(
  alignment: vscode.StatusBarAlignment = vscode.StatusBarAlignment.Left,
  priority: number = 100
): vscode.StatusBarItem {
  return vscode.window.createStatusBarItem(alignment, priority);
}

/**
 * Show a status bar item with text and dispose it after a delay
 */
export async function showTemporaryStatusBarItem(
  text: string,
  duration: number = 3000,
  alignment: vscode.StatusBarAlignment = vscode.StatusBarAlignment.Left,
  priority: number = 100
): Promise<void> {
  const statusBarItem = createStatusBarItem(alignment, priority);
  statusBarItem.text = text;
  statusBarItem.show();

  await new Promise((resolve) => setTimeout(resolve, duration));
  statusBarItem.dispose();
}

/**
 * Show a progress notification with cancellation support
 */
export async function showProgress<T>(
  title: string,
  task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>
): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: true,
    },
    task
  );
}

/**
 * Show a progress notification in the status bar
 */
export async function showStatusBarProgress<T>(
  title: string,
  task: (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => Promise<T>
): Promise<T> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title,
      cancellable: true,
    },
    task
  );
}

/**
 * Format a mismatch type for display
 */
export function formatMismatchType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Extract suggested fix from diagnostic message
 */
export function extractSuggestedFix(message: string): string | null {
  const match = message.match(/Suggested Fix:\s*(.+)/);
  return match ? match[1].trim() : null;
}

