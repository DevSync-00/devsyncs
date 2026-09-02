/**
 * Enhanced Status Bar for Schema Health
 * 
 * Shows real-time schema drift status in the VS Code status bar with interactive indicators,
 * clear labels, tooltips, and clickable actions.
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
  pendingFixes?: number;
  appliedFixes?: number;
  failedFixes?: number;
}

/**
 * Enhanced status bar manager for schema health with multiple indicators.
 */
export class SchemaStatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private fixStatusBarItem: vscode.StatusBarItem | null = null;
  private currentStatus: SchemaStatus | null = null;
  private clickCommand: vscode.Disposable | null = null;
  private fixClickCommand: vscode.Disposable | null = null;

  constructor(context: vscode.ExtensionContext) {
    // Create main status bar item with high priority (right side)
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      200 // High priority
    );
    
    // Create fix status bar item (shown when fixes are pending/applied)
    this.fixStatusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      199 // Slightly lower priority than main status
    );
    
    // Set initial state
    this.updateStatus({
      inSync: true,
      totalMismatches: 0,
      errors: 0,
      warnings: 0,
      infos: 0
    });

    // Register click commands
    this.clickCommand = vscode.commands.registerCommand(
      'devsync.showStatus',
      () => this.onStatusBarClick()
    );

    this.fixClickCommand = vscode.commands.registerCommand(
      'devsync.showFixStatus',
      () => this.onFixStatusBarClick()
    );

    context.subscriptions.push(
      this.statusBarItem, 
      this.fixStatusBarItem,
      this.clickCommand,
      this.fixClickCommand
    );
  }

  /**
   * Updates the status bar with current schema status.
   */
  updateStatus(status: SchemaStatus): void {
    this.currentStatus = status;

    // Update main status bar
    if (status.inSync) {
      this.statusBarItem.text = '$(check) DevSync: In Sync';
      this.statusBarItem.color = undefined; // Use default (green)
      
      // Build tooltip with AI model info
      let tooltip = '✅ Schema is in sync with database';
      if (status.lastScanTime) {
        tooltip += `\n\nLast scan: ${status.lastScanTime.toLocaleString()}`;
      }
      try {
        const modelInfo = getModelInfoFromConfig(vscode);
        tooltip += `\nAI Model: ${modelInfo.displayName}`;
      } catch {
        // Ignore if config not available
      }
      tooltip += '\n\nClick to scan again';
      this.statusBarItem.tooltip = tooltip;
      this.statusBarItem.command = 'devsync.showStatus';
    } else {
      const icon = status.errors > 0 ? '$(error)' : status.warnings > 0 ? '$(warning)' : '$(info)';
      const count = status.totalMismatches;
      const severityLabel = status.errors > 0 ? 'Errors' : status.warnings > 0 ? 'Warnings' : 'Issues';
      
      this.statusBarItem.text = `${icon} DevSync: ${count} ${severityLabel.toLowerCase()}`;
      this.statusBarItem.color = status.errors > 0 
        ? new vscode.ThemeColor('errorForeground')
        : status.warnings > 0
        ? new vscode.ThemeColor('warningForeground')
        : new vscode.ThemeColor('textLink-foreground');
      
      // Build detailed tooltip
      const tooltipParts: string[] = [
        `⚠️ Schema Drift Detected`,
        '',
        `📊 Summary:`,
        `  • Total: ${status.totalMismatches} conflict${status.totalMismatches !== 1 ? 's' : ''}`
      ];
      
      if (status.errors > 0) {
        tooltipParts.push(`  • 🔴 Errors: ${status.errors}`);
      }
      if (status.warnings > 0) {
        tooltipParts.push(`  • 🟡 Warnings: ${status.warnings}`);
      }
      if (status.infos > 0) {
        tooltipParts.push(`  • 🔵 Info: ${status.infos}`);
      }
      
      if (status.lastScanTime) {
        tooltipParts.push('', `⏰ Last scan: ${status.lastScanTime.toLocaleString()}`);
      }
      
      // Add AI model info
      try {
        const modelInfo = getModelInfoFromConfig(vscode);
        tooltipParts.push('', `🤖 AI Model: ${modelInfo.displayName}`);
      } catch {
        // Ignore if config not available
      }
      
      tooltipParts.push('', '👆 Click to view conflicts and generate fixes');
      
      this.statusBarItem.tooltip = tooltipParts.join('\n');
      this.statusBarItem.command = 'devsync.showStatus';
    }

    this.statusBarItem.show();

    // Update fix status bar (if there are pending/applied/failed fixes)
    if (this.fixStatusBarItem) {
      const hasFixActivity = (status.pendingFixes ?? 0) > 0 || 
                            (status.appliedFixes ?? 0) > 0 || 
                            (status.failedFixes ?? 0) > 0;

      if (hasFixActivity) {
        const parts: string[] = [];
        const tooltipParts: string[] = ['🔧 Fix Status'];

        if (status.pendingFixes && status.pendingFixes > 0) {
          parts.push(`$(sync~spin) ${status.pendingFixes} pending`);
          tooltipParts.push(`⏳ Pending: ${status.pendingFixes} fix${status.pendingFixes !== 1 ? 'es' : ''}`);
        }

        if (status.appliedFixes && status.appliedFixes > 0) {
          parts.push(`$(check) ${status.appliedFixes} applied`);
          tooltipParts.push(`✅ Applied: ${status.appliedFixes} fix${status.appliedFixes !== 1 ? 'es' : ''}`);
        }

        if (status.failedFixes && status.failedFixes > 0) {
          parts.push(`$(error) ${status.failedFixes} failed`);
          tooltipParts.push(`❌ Failed: ${status.failedFixes} fix${status.failedFixes !== 1 ? 'es' : ''}`);
        }

        this.fixStatusBarItem.text = `DevSync Fixes: ${parts.join(' | ')}`;
        this.fixStatusBarItem.tooltip = tooltipParts.join('\n') + '\n\n👆 Click to view fix details';
        this.fixStatusBarItem.command = 'devsync.showFixStatus';
        this.fixStatusBarItem.color = status.failedFixes && status.failedFixes > 0
          ? new vscode.ThemeColor('errorForeground')
          : status.pendingFixes && status.pendingFixes > 0
          ? new vscode.ThemeColor('textLink-foreground')
          : new vscode.ThemeColor('textLink-foreground');
        this.fixStatusBarItem.show();
      } else {
        this.fixStatusBarItem.hide();
      }
    }
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
   * Handles status bar click with enhanced quick pick menu.
   */
  private async onStatusBarClick(): Promise<void> {
    if (!this.currentStatus) {
      return;
    }

    // The cockpit owns the review loop; the command gracefully falls back when
    // users disable the experimental panel and retain the legacy tree.
    if (vscode.workspace.getConfiguration('devsync').get<boolean>('experimentalPanel', true)) {
      await vscode.commands.executeCommand('devsync.cockpit.open', 'scans');
      return;
    }

    if (this.currentStatus.inSync) {
      const selection = await vscode.window.showInformationMessage(
        '✅ Schema is in sync with database',
        { modal: false },
        'Scan Again',
        'View Dashboard'
      );
      
      if (selection === 'Scan Again') {
        vscode.commands.executeCommand('devsync.scan');
      } else if (selection === 'View Dashboard') {
        vscode.commands.executeCommand('devsync.openDashboard');
      }
    } else {
      // Show enhanced quick pick with more options
      const items: vscode.QuickPickItem[] = [
        {
          label: '$(list-unordered) View All Conflicts',
          description: `Show ${this.currentStatus.totalMismatches} conflict${this.currentStatus.totalMismatches !== 1 ? 's' : ''}`,
          detail: `${this.currentStatus.errors} errors, ${this.currentStatus.warnings} warnings, ${this.currentStatus.infos} info`
        },
        {
          label: '$(tools) Generate & Preview Fixes',
          description: 'Generate AI-powered fixes for all conflicts',
          detail: 'Preview fixes before applying'
        },
        {
          label: '$(sync) Scan Again',
          description: 'Re-scan codebase and database',
          detail: 'Check for new or resolved conflicts'
        },
        {
          label: '$(browser) Open Dashboard',
          description: 'View detailed report in web dashboard',
          detail: 'Full analysis and team collaboration'
        }
      ];

      // Add fix-related options if there are pending/applied fixes
      if (this.currentStatus.pendingFixes || this.currentStatus.appliedFixes) {
        items.splice(2, 0, {
          label: '$(checklist) View Fix Status',
          description: 'Check status of pending and applied fixes',
          detail: `${this.currentStatus.appliedFixes || 0} applied, ${this.currentStatus.pendingFixes || 0} pending`
        });
      }

      const selection = await vscode.window.showQuickPick(items, {
        placeHolder: `Schema conflicts detected (${this.currentStatus.totalMismatches} total). What would you like to do?`,
        ignoreFocusOut: false
      });

      if (selection) {
        if (selection.label.includes('View All Conflicts')) {
          vscode.commands.executeCommand('devsync.viewReport');
        } else if (selection.label.includes('Generate & Preview Fixes')) {
          vscode.commands.executeCommand('devsync.fix');
        } else if (selection.label.includes('View Fix Status')) {
          vscode.commands.executeCommand('devsync.showFixStatus');
        } else if (selection.label.includes('Scan Again')) {
          vscode.commands.executeCommand('devsync.scan');
        } else if (selection.label.includes('Open Dashboard')) {
          vscode.commands.executeCommand('devsync.openDashboard');
        }
      }
    }
  }

  /**
   * Handles fix status bar click.
   */
  private async onFixStatusBarClick(): Promise<void> {
    if (!this.currentStatus) {
      return;
    }

    const items: vscode.QuickPickItem[] = [];

    if (this.currentStatus.pendingFixes && this.currentStatus.pendingFixes > 0) {
      items.push({
        label: '$(sync~spin) View Pending Fixes',
        description: `${this.currentStatus.pendingFixes} fix${this.currentStatus.pendingFixes !== 1 ? 'es' : ''} pending`,
        detail: 'Fixes that are being applied or waiting'
      });
    }

    if (this.currentStatus.appliedFixes && this.currentStatus.appliedFixes > 0) {
      items.push({
        label: '$(check) View Applied Fixes',
        description: `${this.currentStatus.appliedFixes} fix${this.currentStatus.appliedFixes !== 1 ? 'es' : ''} applied successfully`,
        detail: 'Review successfully applied fixes'
      });
    }

    if (this.currentStatus.failedFixes && this.currentStatus.failedFixes > 0) {
      items.push({
        label: '$(error) View Failed Fixes',
        description: `${this.currentStatus.failedFixes} fix${this.currentStatus.failedFixes !== 1 ? 'es' : ''} failed`,
        detail: 'Review and retry failed fixes'
      });
    }

    if (items.length === 0) {
      vscode.window.showInformationMessage('No fix activity to display.');
      return;
    }

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: 'Fix status details',
      ignoreFocusOut: false
    });

    if (selection) {
      if (selection.label.includes('Pending')) {
        vscode.commands.executeCommand('devsync.previewFix');
      } else if (selection.label.includes('Applied')) {
        vscode.commands.executeCommand('devsync.viewReport');
      } else if (selection.label.includes('Failed')) {
        vscode.commands.executeCommand('devsync.previewFix');
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
   * Disposes the status bar items.
   */
  dispose(): void {
    this.statusBarItem.dispose();
    this.fixStatusBarItem?.dispose();
    this.clickCommand?.dispose();
    this.fixClickCommand?.dispose();
  }
}
