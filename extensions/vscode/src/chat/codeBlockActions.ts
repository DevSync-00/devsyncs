/**
 * Enhanced code block actions: run, apply, diff view, and more.
 */

import * as vscode from 'vscode';
import { EditorService } from '../ui/editor';

/**
 * Code block action handler.
 */
export class CodeBlockActions {
  constructor(private editorService: EditorService) {}

  /**
   * Runs code directly (for supported languages).
   */
  async runCode(code: string, language: string): Promise<void> {
    // For SQL, we could execute it against the database
    // For other languages, show a message
    if (language === 'sql') {
      const result = await vscode.window.showInformationMessage(
        'Execute SQL code?',
        'Yes',
        'No'
      );
      
      if (result === 'Yes') {
        // Execute SQL via CLI or API
        vscode.window.showInformationMessage('SQL execution not yet implemented');
      }
    } else {
      vscode.window.showInformationMessage(
        `Running ${language} code is not supported. Use "Apply to File" instead.`
      );
    }
  }

  /**
   * Applies code to a file.
   */
  async applyToFile(code: string, language: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      const action = await vscode.window.showWarningMessage(
        'No active editor. Create a new file?',
        'Yes',
        'No'
      );
      
      if (action === 'Yes') {
        await this.editorService.openDocument('New File', code, language);
      }
      return;
    }

    // Show diff preview before applying
    const apply = await vscode.window.showInformationMessage(
      'Apply code to current file?',
      'Preview Diff',
      'Apply',
      'Cancel'
    );

    if (apply === 'Preview Diff') {
      await this.showDiff(editor.document, code);
    } else if (apply === 'Apply') {
      await editor.edit((builder) => {
        if (editor.selection.isEmpty) {
          // Insert at cursor
          builder.insert(editor.selection.active, code);
        } else {
          // Replace selection
          builder.replace(editor.selection, code);
        }
      });
      vscode.window.showInformationMessage('Code applied successfully');
    }
  }

  /**
   * Shows diff view before applying changes.
   */
  async showDiff(document: vscode.TextDocument, newCode: string): Promise<void> {
    const currentContent = document.getText();
    const uri = document.uri;
    
    // Create a temporary file with new content
    const tempUri = vscode.Uri.parse(`devsync-diff://temp/${uri.path}`);
    
    // Use VS Code's diff command
    await vscode.commands.executeCommand('vscode.diff', uri, tempUri, 'Current ↔ Proposed');
    
    // Note: This is a simplified implementation
    // Full implementation would require creating a custom document provider
    vscode.window.showInformationMessage(
      'Diff view: Compare the current file with the proposed changes'
    );
  }

  /**
   * Copies code to clipboard.
   */
  async copyCode(code: string): Promise<void> {
    await vscode.env.clipboard.writeText(code);
    vscode.window.showInformationMessage('Code copied to clipboard');
  }

  /**
   * Opens code in a new editor.
   */
  async openInEditor(code: string, language: string): Promise<void> {
    await this.editorService.openDocument('Code Block', code, language);
  }

  /**
   * Formats code.
   */
  async formatCode(code: string, language: string): Promise<string | null> {
    // Use VS Code's formatter if available
    const document = await vscode.workspace.openTextDocument({
      content: code,
      language,
    });

    try {
      const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
        'vscode.executeFormatDocumentProvider',
        document.uri,
        { insertSpaces: true, tabSize: 2 }
      );

      if (edits && edits.length > 0) {
        const formatted = edits.reduce((text, edit) => {
          const start = document.offsetAt(edit.range.start);
          const end = document.offsetAt(edit.range.end);
          return text.substring(0, start) + edit.newText + text.substring(end);
        }, code);
        return formatted;
      }
    } catch (error) {
      // Formatter not available
    }

    return null;
  }
}

