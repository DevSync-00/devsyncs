import * as vscode from 'vscode';
import { DevSyncApiClient, Mismatch } from './api-client';

export class DevSyncDiagnostics {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private apiClient: DevSyncApiClient;

  constructor(apiClient: DevSyncApiClient, context: vscode.ExtensionContext) {
    this.apiClient = apiClient;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('devsync');
    context.subscriptions.push(this.diagnosticCollection);
  }

  async checkWorkspace(workspaceFolder: vscode.WorkspaceFolder) {
    const config = vscode.workspace.getConfiguration('devsync');
    if (!config.get<boolean>('enableDiagnostics', true)) {
      return;
    }

    try {
      const scanReport = await this.apiClient.getLatestScanReport();

      if (!scanReport || !scanReport.mismatches) {
        this.diagnosticCollection.clear();
        return;
      }

      this.updateDiagnostics(scanReport.mismatches, workspaceFolder);
    } catch (error) {
      console.error('DevSync: Failed to check workspace', error);
    }
  }

  private updateDiagnostics(mismatches: Mismatch[], workspaceFolder: vscode.WorkspaceFolder) {
    this.diagnosticCollection.clear();

    // Find Prisma schema file
    const prismaPattern = new vscode.RelativePattern(
      workspaceFolder,
      '**/schema.prisma'
    );

    vscode.workspace.findFiles(prismaPattern).then((files) => {
      if (files.length === 0) {
        return;
      }

      const schemaFile = files[0];
      const diagnostics: vscode.Diagnostic[] = [];

      // Read schema file to map mismatches to lines
      vscode.workspace.openTextDocument(schemaFile).then((document) => {
        const text = document.getText();
        const lines = text.split('\n');

        mismatches.forEach((mismatch) => {
          // Find the line for this model/field
          const lineIndex = this.findLineForMismatch(mismatch, lines);

          if (lineIndex !== -1) {
            const line = document.lineAt(lineIndex);
            const range = line.range;

            const severity = this.mapSeverity(mismatch.severity);
            const message = this.formatMismatchMessage(mismatch);

            const diagnostic = new vscode.Diagnostic(
              range,
              message,
              severity
            );

            // Add code action for suggested fix
            if (mismatch.suggestedFix) {
              diagnostic.code = {
                value: `devsync.${mismatch.type}`,
                target: vscode.Uri.parse(`https://devsync.ai/docs/mismatches#${mismatch.type}`),
              };
            }

            diagnostics.push(diagnostic);
          }
        });

        this.diagnosticCollection.set(schemaFile, diagnostics);
      });
    });
  }

  private findLineForMismatch(mismatch: Mismatch, lines: string[]): number {
    // Simple line finding - look for model name or field name
    const searchPattern = mismatch.field
      ? new RegExp(`^\\s*${mismatch.field}\\s+`, 'i')
      : new RegExp(`^model\\s+${mismatch.model}\\s*\\{`, 'i');

    for (let i = 0; i < lines.length; i++) {
      if (searchPattern.test(lines[i])) {
        return i;
      }
    }

    return -1;
  }

  private mapSeverity(severity: string): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'error':
        return vscode.DiagnosticSeverity.Error;
      case 'warning':
        return vscode.DiagnosticSeverity.Warning;
      case 'info':
        return vscode.DiagnosticSeverity.Information;
      default:
        return vscode.DiagnosticSeverity.Information;
    }
  }

  private formatMismatchMessage(mismatch: Mismatch): string {
    const typeName = mismatch.type
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    let message = `DevSync: ${typeName}`;

    if (mismatch.field) {
      message += ` - Field "${mismatch.field}" in model "${mismatch.model}"`;
    } else {
      message += ` - Model "${mismatch.model}"`;
    }

    if (mismatch.codeValue && mismatch.dbValue) {
      message += `\nCode: ${mismatch.codeValue} | DB: ${mismatch.dbValue}`;
    } else if (mismatch.codeValue) {
      message += `\nExpected: ${mismatch.codeValue}`;
    } else if (mismatch.dbValue) {
      message += `\nFound in DB: ${mismatch.dbValue}`;
    }

    if (mismatch.suggestedFix) {
      message += `\n\nSuggested Fix: ${mismatch.suggestedFix}`;
    }

    return message;
  }

  clear() {
    this.diagnosticCollection.clear();
  }
}

