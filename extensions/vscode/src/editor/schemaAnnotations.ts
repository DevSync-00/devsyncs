/**
 * Annotate schema with database state.
 */

import * as vscode from 'vscode';
import { ScanReport, Mismatch } from '../api';

/**
 * Schema annotation manager for showing database state inline.
 */
export class SchemaAnnotationManager {
  private decorations: Map<string, vscode.TextEditorDecorationType> = new Map();
  private hoverProvider?: vscode.Disposable;

  /**
   * Annotates schema with database state.
   */
  annotateSchema(
    editor: vscode.TextEditor,
    scanReport: ScanReport
  ): void {
    const mismatches = scanReport.mismatches || [];
    const decorations: Map<vscode.TextEditorDecorationType, vscode.Range[]> = new Map();

    mismatches.forEach((mismatch) => {
      const range = this.findMismatchRange(editor.document, mismatch);
      if (!range) {
        return;
      }

      const decorationType = this.getDecorationType(mismatch.severity);
      if (!decorations.has(decorationType)) {
        decorations.set(decorationType, []);
      }
      decorations.get(decorationType)!.push(range);
    });

    // Apply decorations
    for (const [decorationType, ranges] of decorations.entries()) {
      editor.setDecorations(decorationType, ranges);
    }
  }

  /**
   * Registers hover provider for detailed mismatch information.
   */
  registerHoverProvider(context: vscode.ExtensionContext): void {
    if (this.hoverProvider) {
      this.hoverProvider.dispose();
    }

    this.hoverProvider = vscode.languages.registerHoverProvider(
      { scheme: 'file', language: 'prisma' },
      {
        provideHover: (document, position) => {
          // This would need access to scan report
          // For now, return null - can be enhanced later
          return null;
        },
      }
    );

    context.subscriptions.push(this.hoverProvider);
  }

  /**
   * Finds range for a mismatch in the document.
   */
  private findMismatchRange(document: vscode.TextDocument, mismatch: Mismatch): vscode.Range | null {
    const text = document.getText();
    const lines = text.split('\n');

    const field = 'field' in mismatch ? mismatch.field : undefined;
    const searchPattern = field
      ? new RegExp(`^\\s*${field}\\s+`, 'i')
      : new RegExp(`^model\\s+${mismatch.model}\\s*\\{`, 'i');

    for (let i = 0; i < lines.length; i++) {
      if (searchPattern.test(lines[i])) {
        const line = document.lineAt(i);
        return line.range;
      }
    }

    return null;
  }

  /**
   * Gets decoration type for severity.
   */
  private getDecorationType(severity: string): vscode.TextEditorDecorationType {
    const key = `devsync-${severity}`;
    
    if (!this.decorations.has(key)) {
      const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: this.getSeverityColor(severity),
        overviewRulerColor: this.getSeverityColor(severity),
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        isWholeLine: false,
      });
      this.decorations.set(key, decorationType);
    }

    return this.decorations.get(key)!;
  }

  /**
   * Gets color for severity.
   */
  private getSeverityColor(severity: string): vscode.ThemeColor {
    switch (severity) {
      case 'error':
        return new vscode.ThemeColor('editorError.foreground');
      case 'warning':
        return new vscode.ThemeColor('editorWarning.foreground');
      case 'info':
        return new vscode.ThemeColor('editorInfo.foreground');
      default:
        return new vscode.ThemeColor('editor.foreground');
    }
  }

  /**
   * Clears all annotations.
   */
  clearAnnotations(editor: vscode.TextEditor): void {
    for (const decoration of this.decorations.values()) {
      editor.setDecorations(decoration, []);
    }
  }

  /**
   * Disposes all decorations.
   */
  dispose(): void {
    for (const decoration of this.decorations.values()) {
      decoration.dispose();
    }
    this.decorations.clear();
    this.hoverProvider?.dispose();
  }
}

