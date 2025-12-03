import * as vscode from 'vscode';
import { DevSyncApiClient, Mismatch } from './api';
import { DevSyncDiagnostics } from './diagnostics';
import { ICodeActions, IApiClient, IDiagnostics } from './interfaces';

/**
 * Provides code actions for Prisma schema files based on DevSync diagnostics.
 * 
 * Code actions appear as lightbulb suggestions in VS Code when hovering over
 * diagnostics. They allow users to quickly apply fixes for schema mismatches.
 * 
 * @example
 * When a diagnostic appears for a missing field, users can:
 * - Apply the suggested fix directly
 * - Generate a migration for all mismatches
 * - Trigger a new scan
 */
export class DevSyncCodeActions implements ICodeActions {
  private apiClient: IApiClient;
  private diagnostics: IDiagnostics;

  /**
   * Creates a new code actions provider.
   * 
   * @param apiClient - API client for generating migrations
   * @param diagnostics - Diagnostics provider for refreshing after fixes
   */
  constructor(apiClient: IApiClient, diagnostics: IDiagnostics) {
    this.apiClient = apiClient;
    this.diagnostics = diagnostics;
  }

  /**
   * Provides code actions for a given document and range.
   * 
   * Analyzes diagnostics in the context and creates appropriate code actions:
   * - Quick fix actions for individual mismatches
   * - Generate migration action for multiple mismatches
   * - Scan schema action if no recent scan exists
   * 
   * @param document - The text document
   * @param range - The range for which code actions should be provided
   * @param context - Code action context containing diagnostics
   * @param token - Cancellation token
   * @returns Array of code actions, or undefined if none available
   */
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    // Get diagnostics for this document
    const diagnostics = context.diagnostics.filter(
      (d) => d.source === 'devsync'
    );

    if (diagnostics.length === 0) {
      return actions;
    }

    // Group diagnostics by type
    const mismatchesByType = new Map<string, vscode.Diagnostic[]>();
    diagnostics.forEach((diagnostic) => {
      const code = diagnostic.code;
      if (code && typeof code === 'object' && 'value' in code) {
        const mismatchType = (code.value as string).replace('devsync.', '');
        if (!mismatchesByType.has(mismatchType)) {
          mismatchesByType.set(mismatchType, []);
        }
        mismatchesByType.get(mismatchType)!.push(diagnostic);
      }
    });

    // Create code actions for each mismatch type
    mismatchesByType.forEach((diagnostics, mismatchType) => {
      const action = this.createQuickFixAction(
        document,
        range,
        diagnostics,
        mismatchType
      );
      if (action) {
        actions.push(action);
      }
    });

    // Add "Generate Migration" action if there are multiple mismatches
    if (diagnostics.length > 1) {
      const generateMigrationAction = this.createGenerateMigrationAction(
        document,
        diagnostics
      );
      if (generateMigrationAction) {
        actions.push(generateMigrationAction);
      }
    }

    // Add "Scan Schema" action if no recent scan
    const scanAction = this.createScanAction(document);
    actions.push(scanAction);

    return actions;
  }

  private createQuickFixAction(
    document: vscode.TextDocument,
    range: vscode.Range,
    diagnostics: vscode.Diagnostic[],
    mismatchType: string
  ): vscode.CodeAction | null {
    const diagnostic = diagnostics[0];
    if (!diagnostic) {
      return null;
    }

    const action = new vscode.CodeAction(
      `Fix ${this.formatMismatchType(mismatchType)}`,
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    // Extract suggested fix from diagnostic message
    const suggestedFix = this.extractSuggestedFix(diagnostic.message);
    if (!suggestedFix) {
      return null;
    }

    action.command = {
      command: 'devsync.applyFix',
      title: `Apply fix for ${this.formatMismatchType(mismatchType)}`,
      arguments: [document, diagnostic, suggestedFix],
    };

    return action;
  }

  private createGenerateMigrationAction(
    document: vscode.TextDocument,
    diagnostics: vscode.Diagnostic[]
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Generate Migration for All Mismatches',
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = diagnostics;
    action.command = {
      command: 'devsync.generateMigration',
      title: 'Generate Migration',
    };

    return action;
  }

  private createScanAction(
    document: vscode.TextDocument
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Scan Schema',
      vscode.CodeActionKind.Empty
    );

    action.command = {
      command: 'devsync.scan',
      title: 'Scan Schema',
    };

    return action;
  }

  private formatMismatchType(type: string): string {
    return type
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private extractSuggestedFix(message: string): string | null {
    const match = message.match(/Suggested Fix:\s*(.+)/);
    return match ? match[1].trim() : null;
  }
}

// Apply fix command handler
export async function applyFix(
  document: vscode.TextDocument,
  diagnostic: vscode.Diagnostic,
  suggestedFix: string
) {
  try {
    // Parse the suggested fix SQL
    // For now, we'll show it in a new document
    // In the future, we could apply it directly to the database

    const edit = new vscode.WorkspaceEdit();

    // Try to apply the fix to the document
    // This is a simplified version - in practice, you'd need more sophisticated parsing

    if (suggestedFix.includes('ADD COLUMN')) {
      // Extract column definition
      const columnMatch = suggestedFix.match(/ADD COLUMN\s+"(\w+)"\s+(.+);/i);
      if (columnMatch) {
        const [, columnName, columnType] = columnMatch;

        // Find the model in the Prisma schema
        const text = document.getText();
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.trim().startsWith('model')) {
            // Find the closing brace
            let braceCount = 0;
            let endLine = i;

            for (let j = i; j < lines.length; j++) {
              const currentLine = lines[j];
              braceCount += (currentLine.match(/{/g) || []).length;
              braceCount -= (currentLine.match(/}/g) || []).length;

              if (braceCount === 0) {
                endLine = j;
                break;
              }
            }

            // Add the column before the closing brace
            const insertPosition = new vscode.Position(endLine, 0);
            const columnDef = mapPostgresToPrisma(columnName, columnType);
            const insertText = `  ${columnName} ${columnDef}\n`;

            edit.insert(document.uri, insertPosition, insertText);
            break;
          }
        }
      }
    }

    // Apply the edit
    const applied = await vscode.workspace.applyEdit(edit);

    if (applied) {
      vscode.window.showInformationMessage(
        'DevSync: Fix applied! Review the changes.'
      );
    } else {
      // If we can't apply directly, show the SQL fix
      const doc = await vscode.workspace.openTextDocument({
        content: `-- Suggested Fix:\n${suggestedFix}\n\n-- Apply this SQL to your database manually.`,
        language: 'sql',
      });
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(
        'DevSync: Unable to auto-apply. Showing SQL fix - apply manually.'
      );
    }
  } catch (error: any) {
    vscode.window.showErrorMessage(
      `DevSync: Failed to apply fix - ${error.message || 'Unknown error'}`
    );
  }
}

// Helper to map PostgreSQL types to Prisma types
function mapPostgresToPrisma(columnName: string, postgresType: string): string {
  const lowerType = postgresType.toLowerCase().trim();

  if (lowerType.includes('text') || lowerType.includes('varchar')) {
    return 'String';
  }
  if (lowerType.includes('integer') || lowerType.includes('int')) {
    return 'Int';
  }
  if (lowerType.includes('bigint')) {
    return 'BigInt';
  }
  if (lowerType.includes('boolean') || lowerType.includes('bool')) {
    return 'Boolean';
  }
  if (lowerType.includes('timestamp')) {
    return 'DateTime';
  }
  if (lowerType.includes('json')) {
    return 'Json';
  }
  if (lowerType.includes('uuid')) {
    return 'String @default(uuid())';
  }

  return 'String'; // Default fallback
}

