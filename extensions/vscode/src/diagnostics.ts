import * as vscode from 'vscode';
import { DevSyncApiClient, Mismatch } from './api';
import { IDiagnostics, IApiClient } from './interfaces';

/**
 * Provides diagnostics for Prisma schema files based on scan results.
 * 
 * Maps schema mismatches detected by DevSync scans to VS Code diagnostics,
 * which appear as squiggly underlines in the editor. Diagnostics include
 * severity levels (error, warning, info) and can trigger code actions.
 * 
 * @example
 * ```typescript
 * const diagnostics = new DevSyncDiagnostics(apiClient, context);
 * await diagnostics.checkWorkspace(workspaceFolder);
 * ```
 */
export class DevSyncDiagnostics implements IDiagnostics {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private apiClient: IApiClient;

  /**
   * Creates a new diagnostics provider.
   * 
   * @param apiClient - API client for retrieving scan reports
   * @param context - VS Code extension context for managing subscriptions
   */
  constructor(apiClient: IApiClient, context: vscode.ExtensionContext) {
    this.apiClient = apiClient;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('devsync');
    context.subscriptions.push(this.diagnosticCollection);
  }

  /**
   * Checks the workspace for schema mismatches and updates diagnostics.
   * 
   * @param workspaceFolder - The workspace folder to check
   */
  async checkWorkspace(workspaceFolder: vscode.WorkspaceFolder) {
    // Note: Diagnostics would need access to configManager if we want to check enableDiagnostics
    // For now, we'll keep the direct access but this could be refactored later
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
    } catch (error: any) {
      // Silently handle authentication errors - user may not be logged in yet
      if (error?.status === 401 || error?.message?.includes('Unauthorized')) {
        // User is not authenticated - this is expected and fine
        // Diagnostics will work once user logs in
        return;
      }
      
      // Only log unexpected errors
      if (error?.code !== 'ENOENT' && error?.code !== 'FileNotFound') {
      console.error('DevSync: Failed to check workspace', error);
      }
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
                target: vscode.Uri.parse(`https://Dev-Sync.dev/docs/mismatches#${mismatch.type}`),
              };
            }

            diagnostics.push(diagnostic);
          }
        });

        this.diagnosticCollection.set(schemaFile, diagnostics);
      });
    });
  }

  /**
   * Finds the line number in the Prisma schema for a given mismatch.
   * 
   * Uses pattern matching to locate the model or field definition:
   * - For field mismatches: searches for field name at start of line
   * - For model mismatches: searches for "model ModelName {" pattern
   * 
   * @param mismatch - The mismatch to find the line for
   * @param lines - Array of lines from the Prisma schema file
   * @returns The line index (0-based), or -1 if not found
   * 
   * @example
   * ```typescript
   * const lines = schemaText.split('\n');
   * const lineIndex = this.findLineForMismatch(mismatch, lines);
   * if (lineIndex !== -1) {
   *   const line = document.lineAt(lineIndex);
   *   // Create diagnostic for this line
   * }
   * ```
   */
  private findLineForMismatch(mismatch: Mismatch, lines: string[]): number {
    // Simple line finding - look for model name or field name
    const field = 'field' in mismatch ? mismatch.field : undefined;
    const searchPattern = field
      ? new RegExp(`^\\s*${field}\\s+`, 'i')
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

  /**
   * Formats a mismatch into a human-readable diagnostic message.
   * 
   * Creates a detailed message that includes:
   * - Mismatch type (formatted from snake_case to Title Case)
   * - Model and field names (if applicable)
   * - Code vs database value comparison (for type mismatches)
   * - Suggested fix (if available)
   * 
   * Uses TypeScript discriminated union type narrowing to safely access
   * type-specific properties.
   * 
   * @param mismatch - The mismatch to format
   * @returns Formatted diagnostic message string
   * 
   * @example
   * ```typescript
   * const message = this.formatMismatchMessage({
   *   type: 'missing_field',
   *   model: 'User',
   *   field: 'email',
   *   severity: 'error'
   * });
   * // Returns: "DevSync: Missing Field - Field "email" in model "User""
   * ```
   */
  private formatMismatchMessage(mismatch: Mismatch): string {
    const typeName = mismatch.type
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    let message = `DevSync: ${typeName}`;

    // Use type narrowing for discriminated union
    if ('field' in mismatch && mismatch.field) {
      message += ` - Field "${mismatch.field}" in model "${mismatch.model}"`;
    } else {
      message += ` - Model "${mismatch.model}"`;
    }

    // Check for codeValue and dbValue (only in certain mismatch types)
    if ('codeValue' in mismatch && 'dbValue' in mismatch) {
      if (mismatch.codeValue !== undefined && mismatch.dbValue !== undefined) {
        message += `\nCode: ${String(mismatch.codeValue)} | DB: ${String(mismatch.dbValue)}`;
      } else if (mismatch.codeValue !== undefined) {
        message += `\nExpected: ${String(mismatch.codeValue)}`;
      } else if (mismatch.dbValue !== undefined) {
        message += `\nFound in DB: ${String(mismatch.dbValue)}`;
      }
    } else if ('dbValue' in mismatch && mismatch.dbValue !== undefined) {
      message += `\nFound in DB: ${String(mismatch.dbValue)}`;
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

