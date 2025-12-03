/**
 * Enhanced tree item with status indicators, progress bars, and color coding.
 */

import * as vscode from 'vscode';
import { Mismatch } from '../api';

/**
 * Tree item status for color coding.
 */
export enum TreeItemStatus {
  Normal = 'normal',
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
  Processing = 'processing',
  Info = 'info'
}

/**
 * Progress information for tree items.
 */
export interface ProgressInfo {
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number; // seconds
}

/**
 * Enhanced tree item with status indicators and progress support.
 */
export class EnhancedTreeItem extends vscode.TreeItem {
  public readonly mismatch?: Mismatch;
  public readonly status: TreeItemStatus;
  public readonly progressInfo?: ProgressInfo;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly icon: string,
    public readonly command?: vscode.Command,
    contextValue?: string,
    description?: string,
    progressInfo?: ProgressInfo,
    status: TreeItemStatus = TreeItemStatus.Normal,
    mismatch?: Mismatch
  ) {
    super(label, collapsibleState);

    this.tooltip = this.buildTooltip();
    this.description = description;
    this.mismatch = mismatch;
    this.status = status;
    this.progressInfo = progressInfo;

    // Set icon with status-based color
    this.iconPath = this.getIconPath();

    // Set context value for menu contributions
    if (contextValue) {
      this.contextValue = contextValue;
    }

    // Add resource URI for custom icons if needed
    if (status !== TreeItemStatus.Normal) {
      this.resourceUri = vscode.Uri.parse(`devsync://status/${status}`);
    }
  }

  /**
   * Builds tooltip with progress information.
   */
  private buildTooltip(): string {
    const parts: string[] = [this.label];

    if (this.description && typeof this.description === 'string') {
      parts.push(this.description);
    }

    if (this.progressInfo) {
      parts.push(`Progress: ${this.progressInfo.progress}%`);
      parts.push(this.progressInfo.message);
      
      if (this.progressInfo.estimatedTimeRemaining) {
        const minutes = Math.floor(this.progressInfo.estimatedTimeRemaining / 60);
        const seconds = Math.floor(this.progressInfo.estimatedTimeRemaining % 60);
        if (minutes > 0) {
          parts.push(`Estimated time remaining: ${minutes}m ${seconds}s`);
        } else {
          parts.push(`Estimated time remaining: ${seconds}s`);
        }
      }
    }

    if (this.mismatch) {
      parts.push(`Type: ${this.mismatch.type}`);
      parts.push(`Severity: ${this.mismatch.severity}`);
      if (this.mismatch.suggestedFix) {
        parts.push('Has suggested fix');
      }
    }

    return parts.join('\n');
  }

  /**
   * Gets icon path based on status.
   */
  private getIconPath(): vscode.ThemeIcon | vscode.Uri {
    // Use animated icon for processing status
    if (this.status === TreeItemStatus.Processing) {
      return new vscode.ThemeIcon(this.icon, new vscode.ThemeColor('charts.blue'));
    }

    // Use status-based colors
    let color: vscode.ThemeColor | undefined;
    switch (this.status) {
      case TreeItemStatus.Success:
        color = new vscode.ThemeColor('charts.green');
        break;
      case TreeItemStatus.Warning:
        color = new vscode.ThemeColor('charts.yellow');
        break;
      case TreeItemStatus.Error:
        color = new vscode.ThemeColor('charts.red');
        break;
      case TreeItemStatus.Info:
        color = new vscode.ThemeColor('charts.blue');
        break;
    }

    if (color) {
      return new vscode.ThemeIcon(this.icon, color);
    }

    return new vscode.ThemeIcon(this.icon);
  }

  /**
   * Gets status badge text.
   */
  getStatusBadge(): string | undefined {
    switch (this.status) {
      case TreeItemStatus.Success:
        return '✓';
      case TreeItemStatus.Warning:
        return '⚠';
      case TreeItemStatus.Error:
        return '✗';
      case TreeItemStatus.Processing:
        return '⟳';
      case TreeItemStatus.Info:
        return 'ℹ';
      default:
        return undefined;
    }
  }
}

