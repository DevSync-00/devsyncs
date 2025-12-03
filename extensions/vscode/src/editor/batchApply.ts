/**
 * Batch apply fixes for multiple mismatches.
 */

import * as vscode from 'vscode';
import { Mismatch } from '../api';
import { EditorService } from '../ui/editor';
import { DiffViewManager } from './diffView';

/**
 * Batch fix application manager.
 */
export class BatchApplyManager {
  private diffViewManager: DiffViewManager;

  constructor(private editorService: EditorService) {
    this.diffViewManager = new DiffViewManager(editorService);
  }

  /**
   * Applies fixes for multiple mismatches.
   */
  async applyBatchFixes(
    document: vscode.TextDocument,
    mismatches: Array<{ mismatch: Mismatch; diagnostic: vscode.Diagnostic; fix: string }>,
    preview: boolean = true
  ): Promise<boolean> {
    if (mismatches.length === 0) {
      return false;
    }

    // Build combined changes
    const edits: vscode.TextEdit[] = [];
    const changes: Array<{ range: vscode.Range; oldText: string; newText: string }> = [];

    for (const { mismatch, diagnostic, fix } of mismatches) {
      const edit = this.createEditForFix(document, diagnostic.range, mismatch, fix);
      if (edit) {
        edits.push(edit);
        changes.push({
          range: diagnostic.range,
          oldText: document.getText(diagnostic.range),
          newText: edit.newText,
        });
      }
    }

    if (edits.length === 0) {
      vscode.window.showWarningMessage('No applicable fixes found.');
      return false;
    }

    // Show preview if requested
    if (preview) {
      const previewContent = this.buildPreviewContent(document, changes);
      const proceed = await this.showPreviewAndConfirm(previewContent, edits.length);
      
      if (!proceed) {
        return false;
      }
    }

    // Apply edits
    const workspaceEdit = new vscode.WorkspaceEdit();
    edits.forEach((edit) => {
      workspaceEdit.replace(document.uri, edit.range, edit.newText);
    });

    const applied = await vscode.workspace.applyEdit(workspaceEdit);

    if (applied) {
      vscode.window.showInformationMessage(
        `DevSync: Applied ${edits.length} fix${edits.length !== 1 ? 'es' : ''}`
      );
      return true;
    } else {
      vscode.window.showErrorMessage('Failed to apply fixes.');
      return false;
    }
  }

  /**
   * Creates an edit for a fix.
   */
  private createEditForFix(
    document: vscode.TextDocument,
    range: vscode.Range,
    mismatch: Mismatch,
    fix: string
  ): vscode.TextEdit | null {
    // Parse fix and create appropriate edit
    // This is a simplified version - full implementation would parse SQL properly
    
    if (fix.includes('ADD COLUMN')) {
      // Extract column definition
      const columnMatch = fix.match(/ADD COLUMN\s+"(\w+)"\s+(.+);/i);
      if (columnMatch) {
        const [, columnName, columnType] = columnMatch;
        const prismaType = this.mapPostgresToPrisma(columnName, columnType);
        
        // Find insertion point (before closing brace of model)
        const insertionPoint = this.findInsertionPoint(document, mismatch.model);
        if (insertionPoint) {
          const newText = `  ${columnName} ${prismaType}\n`;
          const range = new vscode.Range(insertionPoint, insertionPoint);
          return new vscode.TextEdit(range, newText);
        }
      }
    }

    // Fallback: replace the range with fix content
    return new vscode.TextEdit(range, fix);
  }

  /**
   * Finds insertion point for a new field in a model.
   */
  private findInsertionPoint(document: vscode.TextDocument, modelName: string): vscode.Position | null {
    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith(`model ${modelName}`)) {
        // Find the closing brace
        let braceCount = 0;
        let endLine = i;

        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          braceCount += (currentLine.match(/{/g) || []).length;
          braceCount -= (currentLine.match(/}/g) || []).length;

          if (braceCount === 0 && j > i) {
            endLine = j;
            break;
          }
        }

        return new vscode.Position(endLine, 0);
      }
    }

    return null;
  }

  /**
   * Maps PostgreSQL types to Prisma types.
   */
  private mapPostgresToPrisma(columnName: string, postgresType: string): string {
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

  /**
   * Builds preview content for changes.
   */
  private buildPreviewContent(
    document: vscode.TextDocument,
    changes: Array<{ range: vscode.Range; oldText: string; newText: string }>
  ): string {
    let content = `// Preview: ${changes.length} change${changes.length !== 1 ? 's' : ''}\n\n`;
    
    changes.forEach((change, index) => {
      const line = document.lineAt(change.range.start.line);
      content += `// Change ${index + 1} at line ${change.range.start.line + 1}: ${line.text.trim()}\n`;
      content += `// Before:\n${change.oldText}\n`;
      content += `// After:\n${change.newText}\n\n`;
    });

    return content;
  }

  /**
   * Shows preview and asks for confirmation.
   */
  private async showPreviewAndConfirm(previewContent: string, changeCount: number): Promise<boolean> {
    const action = await vscode.window.showInformationMessage(
      `Apply ${changeCount} fix${changeCount !== 1 ? 'es' : ''}?`,
      'Preview Changes',
      'Apply All',
      'Cancel'
    );

    if (action === 'Preview Changes') {
      await this.editorService.openDocument('Preview Changes', previewContent, 'prisma');
      const confirm = await vscode.window.showInformationMessage(
        'Apply these changes?',
        'Apply',
        'Cancel'
      );
      return confirm === 'Apply';
    }

    return action === 'Apply All';
  }
}

