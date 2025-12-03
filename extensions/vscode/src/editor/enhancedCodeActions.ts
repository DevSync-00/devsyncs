/**
 * Enhanced code actions with preview, diff, and batch apply.
 */

import * as vscode from 'vscode';
import { Mismatch } from '../api';
import { ICodeActions, IDiagnostics, IApiClient } from '../interfaces';
import { BatchApplyManager } from './batchApply';
import { DiffViewManager } from './diffView';
import { InlinePreviewManager } from './inlinePreview';
import { EditorService } from '../ui/editor';

/**
 * Enhanced code actions provider with preview and batch apply.
 */
export class EnhancedCodeActions implements ICodeActions {
  private batchApplyManager: BatchApplyManager;
  private diffViewManager: DiffViewManager;
  private previewManager: InlinePreviewManager;
  private editorService: EditorService;

  constructor(
    private apiClient: IApiClient,
    private diagnostics: IDiagnostics
  ) {
    this.editorService = new EditorService();
    this.batchApplyManager = new BatchApplyManager(this.editorService);
    this.diffViewManager = new DiffViewManager(this.editorService);
    this.previewManager = new InlinePreviewManager();
  }

  /**
   * Provides enhanced code actions.
   */
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    // Get diagnostics for this document
    const devsyncDiagnostics = context.diagnostics.filter(
      (d) => d.source === 'devsync'
    );

    if (devsyncDiagnostics.length === 0) {
      return actions;
    }

    // Create actions for each diagnostic
    devsyncDiagnostics.forEach((diagnostic) => {
      const fixAction = this.createPreviewFixAction(document, diagnostic);
      if (fixAction) {
        actions.push(fixAction);
      }

      const diffAction = this.createDiffAction(document, diagnostic);
      if (diffAction) {
        actions.push(diffAction);
      }
    });

    // Batch apply action for multiple diagnostics
    if (devsyncDiagnostics.length > 1) {
      const batchAction = this.createBatchApplyAction(document, devsyncDiagnostics);
      if (batchAction) {
        actions.push(batchAction);
      }
    }

    return actions;
  }

  /**
   * Creates preview fix action.
   */
  private createPreviewFixAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction | null {
    const suggestedFix = this.extractSuggestedFix(diagnostic.message);
    if (!suggestedFix) {
      return null;
    }

    const action = new vscode.CodeAction(
      'Preview Fix',
      vscode.CodeActionKind.QuickFix
    );
    action.diagnostics = [diagnostic];
    action.command = {
      command: 'devsync.previewFix',
      title: 'Preview Fix',
      arguments: [document, diagnostic, suggestedFix],
    };

    return action;
  }

  /**
   * Creates diff view action.
   */
  private createDiffAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction | null {
    const suggestedFix = this.extractSuggestedFix(diagnostic.message);
    if (!suggestedFix) {
      return null;
    }

    const action = new vscode.CodeAction(
      'Show Diff',
      vscode.CodeActionKind.QuickFix
    );
    action.diagnostics = [diagnostic];
    action.command = {
      command: 'devsync.showDiff',
      title: 'Show Diff',
      arguments: [document, diagnostic, suggestedFix],
    };

    return action;
  }

  /**
   * Creates batch apply action.
   */
  private createBatchApplyAction(
    document: vscode.TextDocument,
    diagnostics: vscode.Diagnostic[]
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Apply All Fixes (${diagnostics.length})`,
      vscode.CodeActionKind.QuickFix
    );
    action.diagnostics = diagnostics;
    action.command = {
      command: 'devsync.batchApplyFixes',
      title: 'Apply All Fixes',
      arguments: [document, diagnostics],
    };

    return action;
  }

  /**
   * Extracts suggested fix from diagnostic message.
   */
  private extractSuggestedFix(message: string): string | null {
    const match = message.match(/Suggested Fix:\s*(.+)/s);
    return match ? match[1].trim() : null;
  }

  /**
   * Gets preview manager.
   */
  getPreviewManager(): InlinePreviewManager {
    return this.previewManager;
  }

  /**
   * Gets batch apply manager.
   */
  getBatchApplyManager(): BatchApplyManager {
    return this.batchApplyManager;
  }

  /**
   * Gets diff view manager.
   */
  getDiffViewManager(): DiffViewManager {
    return this.diffViewManager;
  }
}

