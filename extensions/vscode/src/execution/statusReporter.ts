/**
 * Status reporter for command execution.
 * 
 * Provides detailed status messages and notifications.
 */

import * as vscode from 'vscode';
import { NotificationService } from '../ui/notifications';
import { StatusBarService } from '../ui/statusBar';
import { ProgressUpdate } from './progressTracker';

/**
 * Status level.
 */
export enum StatusLevel {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

/**
 * Status message definition.
 */
export interface StatusMessage {
  level: StatusLevel;
  message: string;
  details?: string;
  actions?: string[];
}

/**
 * Status reporter for command execution.
 */
export class StatusReporter {
  private notificationService: NotificationService;
  private statusBarService: StatusBarService;
  private statusBarItem: vscode.StatusBarItem | null = null;

  constructor() {
    this.notificationService = new NotificationService();
    this.statusBarService = new StatusBarService();
  }

  /**
   * Reports a status message.
   */
  report(message: StatusMessage): void {
    switch (message.level) {
      case StatusLevel.INFO:
        this.notificationService.showInfo(message.message);
        break;
      case StatusLevel.SUCCESS:
        this.notificationService.showInfo(message.message);
        break;
      case StatusLevel.WARNING:
        this.notificationService.showWarning(message.message);
        break;
      case StatusLevel.ERROR:
        if (message.actions && message.actions.length > 0) {
          this.notificationService.showError(message.message, ...message.actions);
        } else {
          this.notificationService.showError(message.message);
        }
        break;
    }

    // Update status bar
    this.updateStatusBar(message);
  }

  /**
   * Reports progress update.
   */
  reportProgress(update: ProgressUpdate): void {
    const statusText = `$(sync~spin) DevSync: ${update.message}`;
    const tooltip = this.buildProgressTooltip(update);

    if (!this.statusBarItem) {
      this.statusBarItem = this.statusBarService.showProgress(statusText);
    } else {
      this.statusBarItem.text = statusText;
      this.statusBarItem.tooltip = tooltip;
    }
  }

  /**
   * Reports completion.
   */
  reportCompletion(message: string, duration?: number): void {
    const durationText = duration ? ` (${this.formatDuration(duration)})` : '';
    this.notificationService.showInfo(`${message}${durationText}`);

    if (this.statusBarItem) {
      this.statusBarItem.text = `$(check) DevSync: ${message}`;
      this.statusBarItem.tooltip = undefined;
      setTimeout(() => {
        this.statusBarItem?.dispose();
        this.statusBarItem = null;
      }, 3000);
    }
  }

  /**
   * Reports error.
   */
  reportError(message: string, error?: Error, actions?: string[]): void {
    const errorMessage = error ? `${message}: ${error.message}` : message;
    if (actions && actions.length > 0) {
      this.notificationService.showError(errorMessage, ...actions);
    } else {
      this.notificationService.showError(errorMessage);
    }

    if (this.statusBarItem) {
      this.statusBarItem.text = `$(error) DevSync: Error`;
      this.statusBarItem.tooltip = errorMessage;
      this.statusBarItem.color = new vscode.ThemeColor('errorForeground');
    }
  }

  /**
   * Clears status.
   */
  clear(): void {
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
      this.statusBarItem = null;
    }
  }

  /**
   * Updates status bar with message.
   */
  private updateStatusBar(message: StatusMessage): void {
    if (!this.statusBarItem) {
      const icon = this.getStatusIcon(message.level);
      this.statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
      );
      this.statusBarItem.text = `${icon} DevSync`;
      this.statusBarItem.show();
    }

    this.statusBarItem.tooltip = message.details || message.message;
  }

  /**
   * Gets status icon for level.
   */
  private getStatusIcon(level: StatusLevel): string {
    switch (level) {
      case StatusLevel.SUCCESS:
        return '$(check)';
      case StatusLevel.WARNING:
        return '$(warning)';
      case StatusLevel.ERROR:
        return '$(error)';
      default:
        return '$(info)';
    }
  }

  /**
   * Builds progress tooltip.
   */
  private buildProgressTooltip(update: ProgressUpdate): string {
    const parts: string[] = [update.message];

    if (update.step && update.totalSteps) {
      parts.push(`Step ${update.step} of ${update.totalSteps}`);
    }

    if (update.estimatedTimeRemaining) {
      parts.push(`Estimated time remaining: ${this.formatDuration(update.estimatedTimeRemaining)}`);
    }

    return parts.join('\n');
  }

  /**
   * Formats duration in milliseconds to human-readable string.
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

