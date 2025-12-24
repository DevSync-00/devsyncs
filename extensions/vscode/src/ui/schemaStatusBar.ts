/**
 * Enhanced Status Bar for Schema Health
 * 
 * Shows real-time schema drift status in the VS Code status bar.
 */

import * as vscode from 'vscode';
import { Mismatch } from '../api';
import { getModelInfoFromConfig } from '../utils/aiModelInfo';

export interface SchemaStatus {
  inSync: boolean;
  totalMismatches: number;
  errors: number;
  warnings: number;
  infos: number;
  lastScanTime?: Date;
}

/**
 * Enhanced status bar manager for schema health.
 */
export class SchemaStatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private currentStatus: SchemaStatus | null = null;
  private clickCommand: vscode.Disposable | null = null;

  constructor(context: vscode.ExtensionContext) {
    // Create status bar item with high priority (right side)
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      200 // High priority
    );
    
    // Set initial state
    this.updateStatus({
      inSync: true,
      totalMismatches: 0,
      errors: 0,
      warnings: 0,
      infos: 0
    });

    // Register click command
    this.clickCommand = vscode.commands.registerCommand(
      'devsync.showStatus',
      () => this.onStatusBarClick()
    );

    context.subscriptions.push(this.statusBarItem, this.clickCommand);
  }

  /**
   * Updates the status bar with current schema status.
   */
  updateStatus(status: SchemaStatus): void {
    this.currentStatus = status;

    if (status.inSync) {
      this.statusBarItem.text = '$(check) DevSync: In Sync';
      this.statusBarItem.color = undefined; // Use default (green)
      
      // Build tooltip with AI model info
      let tooltip = 'Schema is in sync with database';
      try {
        const modelInfo = getModelInfoFromConfig(vscode);
        tooltip += `\n\nAI Model: ${modelInfo.displayName}`;
      } catch {
        // Ignore if config not available
      }
      this.statusBarItem.tooltip = tooltip;
      this.statusBarItem.command = 'devsync.showStatus';
    } else {
      const icon = status.errors > 0 ? '$(error)' : '$(warning)';
      const count = status.totalMismatches;
      this.statusBarItem.text = `${icon} DevSync: ${count} conflict${count !== 1 ? 's' : ''}`;
      this.statusBarItem.color = status.errors > 0 
        ? new vscode.ThemeColor('errorForeground')
        : new vscode.ThemeColor('warningForeground');
      
      // Build detailed tooltip
      const tooltipParts: string[] = [
        `Schema Drift Detected`,
        `Total: ${status.totalMismatches} conflict${status.totalMismatches !== 1 ? 's' : ''}`
      ];
      
      if (status.errors > 0) {
        tooltipParts.push(`Errors: ${status.errors}`);
      }
      if (status.warnings > 0) {
        tooltipParts.push(`Warnings: ${status.warnings}`);
      }
      if (status.infos > 0) {
        tooltipParts.push(`Info: ${status.infos}`);
      }
      
      if (status.lastScanTime) {
        tooltipParts.push(`Last scan: ${status.lastScanTime.toLocaleTimeString()}`);
      }
      
      // Add AI model info
      try {
        const modelInfo = getModelInfoFromConfig(vscode);
        tooltipParts.push('', `AI Model: ${modelInfo.displayName}`);
      } catch {
        // Ignore if config not available
      }
      
      tooltipParts.push('', 'Click to view details');
      
      this.statusBarItem.tooltip = tooltipParts.join('\n');
      this.statusBarItem.command = 'devsync.showStatus';
    }

    this.statusBarItem.show();
  }

  /**
   * Updates status from mismatches array.
   */
  updateFromMismatches(mismatches: Mismatch[], lastScanTime?: Date): void {
    const errors = mismatches.filter(m => m.severity === 'error').length;
    const warnings = mismatches.filter(m => m.severity === 'warning').length;
    const infos = mismatches.filter(m => m.severity === 'info').length;

    this.updateStatus({
      inSync: mismatches.length === 0,
      totalMismatches: mismatches.length,
      errors,
      warnings,
      infos,
      lastScanTime
    });
  }

  /**
   * Shows scanning state.
   */
  showScanning(): void {
    this.statusBarItem.text = '$(sync~spin) DevSync: Scanning...';
    this.statusBarItem.tooltip = 'Scanning codebase and database for schema mismatches';
    this.statusBarItem.color = undefined;
    this.statusBarItem.command = undefined;
    this.statusBarItem.show();
  }

  /**
   * Shows error state.
   */
  showError(message: string): void {
    this.statusBarItem.text = '$(error) DevSync: Error';
    this.statusBarItem.tooltip = message;
    this.statusBarItem.color = new vscode.ThemeColor('errorForeground');
    this.statusBarItem.command = 'devsync.showStatus';
    this.statusBarItem.show();
  }

  /**
   * Handles status bar click.
   */
  private async onStatusBarClick(): Promise<void> {
    if (!this.currentStatus) {
      return;
    }

    if (this.currentStatus.inSync) {
      vscode.window.showInformationMessage(
        '✅ Schema is in sync with database',
        'Scan Again'
      ).then(selection => {
        if (selection === 'Scan Again') {
          vscode.commands.executeCommand('devsync.scan');
        }
      });
    } else {
      // Show quick pick with options
      const items: vscode.QuickPickItem[] = [
        {
          label: '$(list-unordered) View Conflicts',
          description: `Show ${this.currentStatus.totalMismatches} conflict${this.currentStatus.totalMismatches !== 1 ? 's' : ''}`,
          detail: `${this.currentStatus.errors} errors, ${this.currentStatus.warnings} warnings`
        },
        {
          label: '$(tools) Generate Fixes',
          description: 'Generate AI-powered fixes for conflicts',
          detail: 'Preview and apply schema fixes'
        },
        {
          label: '$(sync) Scan Again',
          description: 'Re-scan codebase and database',
          detail: 'Check for new conflicts'
        }
      ];

      const selection = await vscode.window.showQuickPick(items, {
        placeHolder: 'Schema conflicts detected. What would you like to do?'
      });

      if (selection) {
        if (selection.label.includes('View Conflicts')) {
          vscode.commands.executeCommand('devsync.viewReport');
        } else if (selection.label.includes('Generate Fixes')) {
          vscode.commands.executeCommand('devsync.fix');
        } else if (selection.label.includes('Scan Again')) {
          vscode.commands.executeCommand('devsync.scan');
        }
      }
    }
  }

  /**
   * Hides the status bar item.
   */
  hide(): void {
    this.statusBarItem.hide();
  }

  /**
   * Disposes the status bar item.
   */
  dispose(): void {
    this.statusBarItem.dispose();
    this.clickCommand?.dispose();
  }
}
