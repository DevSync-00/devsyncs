/**
 * Inline preview of suggested fixes in the editor.
 */

import * as vscode from 'vscode';
import { Mismatch } from '../api';

/**
 * Inline preview manager for suggested fixes.
 */
export class InlinePreviewManager {
  private decorations: Map<string, vscode.TextEditorDecorationType> = new Map();
  private activePreviews: Map<string, vscode.Range[]> = new Map();

  /**
   * Shows inline preview for a suggested fix.
   */
  showInlinePreview(
    editor: vscode.TextEditor,
    range: vscode.Range,
    mismatch: Mismatch,
    suggestedFix: string
  ): void {
    const key = `${editor.document.uri.toString()}-${range.start.line}`;
    
    // Create decoration type if not exists
    if (!this.decorations.has(key)) {
      const decorationType = vscode.window.createTextEditorDecorationType({
        after: {
          contentText: ` → ${this.formatPreview(suggestedFix)}`,
          color: new vscode.ThemeColor('editorCodeLens.foreground'),
          fontWeight: 'normal',
          fontStyle: 'italic',
          margin: '0 0 0 1em',
        },
        isWholeLine: false,
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      });
      this.decorations.set(key, decorationType);
    }

    const decoration = this.decorations.get(key)!;
    this.activePreviews.set(key, [range]);
    editor.setDecorations(decoration, [range]);
  }

  /**
   * Hides inline preview.
   */
  hideInlinePreview(editor: vscode.TextEditor, range: vscode.Range): void {
    const key = `${editor.document.uri.toString()}-${range.start.line}`;
    const decoration = this.decorations.get(key);
    
    if (decoration) {
      editor.setDecorations(decoration, []);
      this.activePreviews.delete(key);
    }
  }

  /**
   * Clears all previews for an editor.
   */
  clearAllPreviews(editor: vscode.TextEditor): void {
    const uri = editor.document.uri.toString();
    
    for (const [key, decoration] of this.decorations.entries()) {
      if (key.startsWith(uri)) {
        editor.setDecorations(decoration, []);
        this.decorations.delete(key);
        this.activePreviews.delete(key);
      }
    }
  }

  /**
   * Formats preview text from suggested fix.
   */
  private formatPreview(suggestedFix: string): string {
    // Extract key information from SQL fix
    if (suggestedFix.includes('ADD COLUMN')) {
      const match = suggestedFix.match(/ADD COLUMN\s+"(\w+)"/i);
      if (match) {
        return `Add ${match[1]}`;
      }
    }
    
    if (suggestedFix.includes('ALTER COLUMN')) {
      const match = suggestedFix.match(/ALTER COLUMN\s+"(\w+)"/i);
      if (match) {
        return `Modify ${match[1]}`;
      }
    }
    
    // Return truncated version
    return suggestedFix.substring(0, 50) + (suggestedFix.length > 50 ? '...' : '');
  }

  /**
   * Disposes all decorations.
   */
  dispose(): void {
    for (const decoration of this.decorations.values()) {
      decoration.dispose();
    }
    this.decorations.clear();
    this.activePreviews.clear();
  }
}

