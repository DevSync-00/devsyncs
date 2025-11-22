import * as vscode from 'vscode';
import { DevSyncApiClient } from './api-client';
import { DevSyncDiagnostics } from './diagnostics';

export class DevSyncCommands {
  constructor(
    private apiClient: DevSyncApiClient,
    private diagnostics: DevSyncDiagnostics
  ) {}

  async scan() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const workspaceFolder = workspaceFolders[0];
    const config = vscode.workspace.getConfiguration('devsync');
    const databaseConnection = config.get<string>('databaseConnection', '');

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(sync~spin) DevSync: Scanning...';
    statusBarItem.show();

    try {
      // Check if we have API configuration
      if (!this.apiClient.getDashboardUrl()) {
        vscode.window.showWarningMessage(
          'DevSync: API not configured. Please set devsync.apiUrl, devsync.apiKey, and devsync.projectId in settings.',
          'Open Settings'
        ).then((selection) => {
          if (selection === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'devsync');
          }
        });
        statusBarItem.dispose();
        return;
      }

      // Trigger scan via API
      await this.apiClient.scan(workspaceFolder.uri.fsPath, databaseConnection);

      // Refresh diagnostics
      await this.diagnostics.checkWorkspace(workspaceFolder);

      statusBarItem.text = '$(check) DevSync: Scan complete';
      statusBarItem.dispose();

      vscode.window.showInformationMessage('DevSync: Scan complete! Check diagnostics for mismatches.');
    } catch (error: any) {
      statusBarItem.dispose();
      vscode.window.showErrorMessage(
        `DevSync: Scan failed - ${error.message || 'Unknown error'}`
      );
    }
  }

  async generateMigration() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    try {
      // Get latest scan report
      const scanReport = await this.apiClient.getLatestScanReport();

      if (!scanReport) {
        vscode.window.showWarningMessage(
          'DevSync: No scan report found. Run a scan first.',
          'Run Scan'
        ).then((selection) => {
          if (selection === 'Run Scan') {
            this.scan();
          }
        });
        return;
      }

      if (!scanReport.mismatches || scanReport.mismatches.length === 0) {
        vscode.window.showInformationMessage('DevSync: No mismatches found. Everything is in sync!');
        return;
      }

      // Generate migration
      const migration = await this.apiClient.generateMigration(scanReport.id);

      // Show migration in a new document
      const document = await vscode.workspace.openTextDocument({
        content: migration.content,
        language: 'sql',
      });

      await vscode.window.showTextDocument(document);

      vscode.window.showInformationMessage(
        `DevSync: Migration generated! Review and apply manually.`
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `DevSync: Failed to generate migration - ${error.message || 'Unknown error'}`
      );
    }
  }

  async viewReport() {
    try {
      const scanReport = await this.apiClient.getLatestScanReport();

      if (!scanReport) {
        vscode.window.showWarningMessage(
          'DevSync: No scan report found. Run a scan first.',
          'Run Scan'
        ).then((selection) => {
          if (selection === 'Run Scan') {
            this.scan();
          }
        });
        return;
      }

      // Open dashboard in browser
      const dashboardUrl = this.apiClient.getDashboardUrl();
      vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `DevSync: Failed to open report - ${error.message || 'Unknown error'}`
      );
    }
  }

  async openDashboard() {
    const dashboardUrl = this.apiClient.getDashboardUrl();
    vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
  }
}

