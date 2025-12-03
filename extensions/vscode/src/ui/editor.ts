/**
 * Editor UI layer.
 * 
 * Manages editor operations like opening documents and applying edits.
 */

import * as vscode from 'vscode';

/**
 * Service for managing editor operations.
 * 
 * Provides a clean interface for opening documents and applying edits
 * without coupling business logic to VS Code editor APIs.
 * 
 * @example
 * ```typescript
 * const editor = new EditorService();
 * await editor.openDocument('Migration generated', migrationContent, 'sql');
 * ```
 */
export class EditorService {
  /**
   * Opens a document in the editor.
   * 
   * @param title - Optional title for the document
   * @param content - The content to display
   * @param language - Optional language ID for syntax highlighting
   * @returns Promise resolving to the opened text document
   */
  async openDocument(title: string, content: string, language?: string): Promise<vscode.TextDocument> {
    const document = await vscode.workspace.openTextDocument({
      content,
      language: language || 'plaintext',
    });
    await vscode.window.showTextDocument(document);
    return document;
  }

  /**
   * Opens a file in the editor.
   * 
   * @param filePath - Path to the file to open
   * @returns Promise resolving to the opened text document
   */
  async openFile(filePath: string): Promise<vscode.TextDocument> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(document);
    return document;
  }

  /**
   * Applies edits to a document.
   * 
   * @param document - The document to edit
   * @param edits - Array of text edits to apply
   * @returns Promise resolving to whether the edits were applied
   */
  async applyEdits(
    document: vscode.TextDocument,
    edits: Array<{ range: vscode.Range; newText: string }>
  ): Promise<boolean> {
    const workspaceEdit = new vscode.WorkspaceEdit();
    edits.forEach((edit) => {
      workspaceEdit.replace(document.uri, edit.range, edit.newText);
    });
    return vscode.workspace.applyEdit(workspaceEdit);
  }
}

