/**
 * Preview manager for command execution.
 * 
 * Shows preview of changes before applying them.
 */

import * as vscode from 'vscode';
import { DiffViewManager } from '../editor/diffView';
import { EditorService } from '../ui/editor';

/**
 * Preview change definition.
 */
export interface PreviewChange {
  /** Type of change */
  type: 'add' | 'modify' | 'delete';
  /** File path */
  filePath: string;
  /** Original content */
  originalContent: string;
  /** Modified content */
  modifiedContent: string;
  /** Description of the change */
  description: string;
}

/**
 * Preview result.
 */
export interface PreviewResult {
  /** Whether user approved the changes */
  approved: boolean;
  /** Whether user wants to see diff */
  showDiff?: boolean;
}

/**
 * Preview manager for showing changes before execution.
 */
export class PreviewManager {
  private diffViewManager: DiffViewManager;

  constructor(diffViewManager?: DiffViewManager) {
    if (diffViewManager) {
      this.diffViewManager = diffViewManager;
    } else {
      // Initialize with default editor service
      this.diffViewManager = new DiffViewManager(new EditorService());
    }
  }

  /**
   * Shows preview of changes and asks for confirmation.
   */
  async showPreview(changes: PreviewChange[]): Promise<PreviewResult> {
    if (changes.length === 0) {
      return { approved: true };
    }

    // Show summary
    const summary = this.buildSummary(changes);
    const action = await vscode.window.showInformationMessage(
      summary,
      'Preview Changes',
      'Apply All',
      'Cancel'
    );

    if (action === 'Cancel') {
      return { approved: false };
    }

    if (action === 'Preview Changes') {
      // Show diff view for first change
      const firstChange = changes[0];
      // Create a temporary document for the diff view
      const tempDoc = await vscode.workspace.openTextDocument({
        content: firstChange.originalContent,
        language: 'prisma',
      });
      await this.diffViewManager.showDiffView(
        tempDoc,
        firstChange.modifiedContent,
        `Preview: ${firstChange.description}`
      );

      // Ask again after preview
      const afterPreview = await vscode.window.showInformationMessage(
        `Previewed ${changes.length} change(s). Apply all changes?`,
        'Apply All',
        'Cancel'
      );

      return { approved: afterPreview === 'Apply All' };
    }

    return { approved: action === 'Apply All' };
  }

  /**
   * Shows preview for a single change.
   */
  async showSinglePreview(change: PreviewChange): Promise<PreviewResult> {
    const action = await vscode.window.showInformationMessage(
      change.description,
      'Preview',
      'Apply',
      'Cancel'
    );

    if (action === 'Cancel') {
      return { approved: false };
    }

    if (action === 'Preview') {
      // Create a temporary document for the diff view
      const tempDoc = await vscode.workspace.openTextDocument({
        content: change.originalContent,
        language: 'prisma',
      });
      await this.diffViewManager.showDiffView(
        tempDoc,
        change.modifiedContent,
        `Preview: ${change.description}`
      );

      const afterPreview = await vscode.window.showInformationMessage(
        'Apply this change?',
        'Apply',
        'Cancel'
      );

      return { approved: afterPreview === 'Apply' };
    }

    return { approved: action === 'Apply' };
  }

  /**
   * Builds summary message for changes.
   */
  private buildSummary(changes: PreviewChange[]): string {
    const counts = {
      add: changes.filter(c => c.type === 'add').length,
      modify: changes.filter(c => c.type === 'modify').length,
      delete: changes.filter(c => c.type === 'delete').length,
    };

    const parts: string[] = [];
    if (counts.add > 0) parts.push(`${counts.add} addition(s)`);
    if (counts.modify > 0) parts.push(`${counts.modify} modification(s)`);
    if (counts.delete > 0) parts.push(`${counts.delete} deletion(s)`);

    return `This will make ${parts.join(', ')}. ${changes.length} total change(s).`;
  }
}
