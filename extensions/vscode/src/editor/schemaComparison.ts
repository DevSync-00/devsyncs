/**
 * Schema Comparison View
 * 
 * Provides in-editor schema comparison showing before/after changes
 * with side-by-side or inline diff format, highlighting breaking vs non-breaking changes.
 */

import * as vscode from 'vscode';
import { Mismatch } from '../api';
import { EditorService } from '../ui/editor';
import { EnhancedFix } from './fixPreview';

export interface SchemaComparison {
  model: string;
  field?: string;
  before: SchemaState;
  after: SchemaState;
  changes: SchemaChange[];
  breaking: boolean;
}

export interface SchemaState {
  type?: string;
  nullable?: boolean;
  defaultValue?: string;
  constraints?: string[];
  indexes?: string[];
}

export interface SchemaChange {
  type: 'added' | 'removed' | 'modified';
  field: string;
  before?: string;
  after?: string;
  breaking: boolean;
  description: string;
}

/**
 * Schema comparison view manager.
 */
export class SchemaComparisonManager {
  private activePanels: Map<string, vscode.WebviewPanel> = new Map();
  private editorService: EditorService;

  constructor(editorService: EditorService) {
    this.editorService = editorService;
  }

  /**
   * Shows schema comparison for a fix.
   */
  async showComparisonForFix(fix: EnhancedFix): Promise<void> {
    const comparison = this.buildComparisonFromFix(fix);
    await this.showComparison(comparison);
  }

  /**
   * Shows schema comparison view.
   */
  async showComparison(comparison: SchemaComparison): Promise<void> {
    const panelId = `schema-comparison-${comparison.model}-${comparison.field || 'table'}`;
    
    // Check if panel already exists
    const existingPanel = this.activePanels.get(panelId);
    if (existingPanel) {
      existingPanel.reveal();
      return;
    }

    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
      'devsyncSchemaComparison',
      `Schema Comparison: ${comparison.model}${comparison.field ? `.${comparison.field}` : ''}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );

    // Set webview content
    panel.webview.html = this.generateComparisonContent(comparison, panel.webview);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'close':
            panel.dispose();
            break;
          case 'applyFix':
            await vscode.commands.executeCommand('devsync.applyFix', message.fix);
            break;
        }
      },
      undefined,
      []
    );

    // Clean up on dispose
    panel.onDidDispose(() => {
      this.activePanels.delete(panelId);
    });

    this.activePanels.set(panelId, panel);
  }

  /**
   * Builds comparison from a fix.
   */
  private buildComparisonFromFix(fix: EnhancedFix): SchemaComparison {
    const mismatch = fix.mismatch;
    const changes: SchemaChange[] = [];

    // Determine before and after states based on mismatch type
    let before: SchemaState = {};
    let after: SchemaState = {};
    let breaking = fix.breaking || false;

    switch (mismatch.type) {
      case 'missing_field':
        before = {};
        after = {
          type: 'string', // Default, would come from fix details
          nullable: true
        };
        changes.push({
          type: 'added',
          field: mismatch.field || '',
          after: `Field ${mismatch.field} added`,
          breaking: false,
          description: `Add field ${mismatch.field} to ${mismatch.model}`
        });
        break;

      case 'missing_table':
        before = {};
        after = {};
        changes.push({
          type: 'added',
          field: mismatch.model,
          after: `Table ${mismatch.model} added`,
          breaking: false,
          description: `Add table ${mismatch.model}`
        });
        break;

      case 'type_mismatch':
        before = {
          type: this.schemaValueToString(mismatch.dbValue)
        };
        after = {
          type: this.schemaValueToString(mismatch.codeValue)
        };
        breaking = true; // Type changes are usually breaking
        changes.push({
          type: 'modified',
          field: mismatch.field || '',
          before: this.schemaValueToString(mismatch.dbValue),
          after: this.schemaValueToString(mismatch.codeValue),
          breaking: true,
          description: `Change type of ${mismatch.field} from ${this.schemaValueToString(mismatch.dbValue)} to ${this.schemaValueToString(mismatch.codeValue)}`
        });
        break;

      case 'extra_field':
        before = {
          type: this.schemaValueToString(mismatch.dbValue)
        };
        after = {};
        changes.push({
          type: 'removed',
          field: mismatch.field || '',
          before: `Field ${mismatch.field} exists in database`,
          breaking: true,
          description: `Remove field ${mismatch.field} from ${mismatch.model}`
        });
        break;

      case 'constraint_mismatch':
        before = {
          constraints: [this.schemaValueToString(mismatch.dbValue)]
        };
        after = {
          constraints: [this.schemaValueToString(mismatch.codeValue)]
        };
        breaking = true;
        changes.push({
          type: 'modified',
          field: mismatch.field || mismatch.model,
          before: this.schemaValueToString(mismatch.dbValue),
          after: this.schemaValueToString(mismatch.codeValue),
          breaking: true,
          description: `Change constraint on ${mismatch.field || mismatch.model}`
        });
        break;
    }

    return {
      model: mismatch.model,
      field: 'field' in mismatch ? mismatch.field : undefined,
      before,
      after,
      changes,
      breaking
    };
  }

  /**
   * Generates comparison webview content.
   */
  private generateComparisonContent(comparison: SchemaComparison, webview: vscode.Webview): string {
    const breakingBadge = comparison.breaking 
      ? '<span class="badge badge-breaking">BREAKING</span>'
      : '<span class="badge badge-safe">NON-BREAKING</span>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Schema Comparison</title>
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
        }
        .header {
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .header h1 {
            margin: 0 0 10px 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .comparison-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 20px 0;
        }
        .comparison-panel {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 15px;
            background: var(--vscode-editor-background);
        }
        .comparison-panel h3 {
            margin: 0 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .schema-property {
            margin: 10px 0;
            padding: 8px;
            background: var(--vscode-textCodeBlock-background);
            border-radius: 4px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
        }
        .changes-list {
            margin: 20px 0;
        }
        .change-item {
            padding: 12px;
            margin: 10px 0;
            border-left: 4px solid;
            border-radius: 4px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
        }
        .change-added {
            border-left-color: #4caf50;
            background: rgba(76, 175, 80, 0.1);
        }
        .change-removed {
            border-left-color: #f44336;
            background: rgba(244, 67, 54, 0.1);
        }
        .change-modified {
            border-left-color: #ff9800;
            background: rgba(255, 152, 0, 0.1);
        }
        .change-breaking {
            border: 2px solid #d32f2f;
        }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .badge-breaking {
            background: #d32f2f;
            color: white;
        }
        .badge-safe {
            background: #4caf50;
            color: white;
        }
        .diff-view {
            margin: 15px 0;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
        }
        .diff-line {
            padding: 4px 12px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
        }
        .diff-line-added {
            background: rgba(76, 175, 80, 0.1);
            border-left: 3px solid #4caf50;
        }
        .diff-line-removed {
            background: rgba(244, 67, 54, 0.1);
            border-left: 3px solid #f44336;
        }
        .diff-line-context {
            background: var(--vscode-editor-background);
            color: var(--vscode-descriptionForeground);
        }
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            margin-top: 15px;
        }
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .alert {
            padding: 12px 16px;
            border-radius: 4px;
            margin: 15px 0;
            border-left: 4px solid;
        }
        .alert-warning {
            background: rgba(255, 152, 0, 0.1);
            border-color: #ff9800;
        }
        .alert-danger {
            background: rgba(244, 67, 54, 0.1);
            border-color: #f44336;
        }
        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>
            <span>⚖️</span>
            <span>Schema Comparison</span>
            ${breakingBadge}
        </h1>
        <p><strong>Model:</strong> ${this.escapeHtml(comparison.model)}${comparison.field ? `.${this.escapeHtml(comparison.field)}` : ''}</p>
        ${comparison.breaking ? `
        <div class="alert alert-danger">
            <strong>⚠️ Breaking Change:</strong> This schema change may break existing applications or require data migration.
        </div>
        ` : ''}
    </div>

    <div class="comparison-container">
        <div class="comparison-panel">
            <h3>📊 Current State (Database)</h3>
            ${this.renderSchemaState(comparison.before)}
        </div>
        <div class="comparison-panel">
            <h3>🎯 Target State (Code)</h3>
            ${this.renderSchemaState(comparison.after)}
        </div>
    </div>

    <div class="changes-list">
        <h2>📝 Changes Summary</h2>
        ${comparison.changes.length > 0 
          ? comparison.changes.map(change => this.renderChange(change)).join('')
          : '<div class="empty-state">No changes detected</div>'
        }
    </div>

    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid var(--vscode-panel-border);">
        <button class="btn-primary" onclick="close()">Close</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function close() {
            vscode.postMessage({ command: 'close' });
        }
    </script>
</body>
</html>`;
  }

  /**
   * Renders schema state.
   */
  private renderSchemaState(state: SchemaState): string {
    if (Object.keys(state).length === 0) {
      return '<div class="empty-state">No schema defined</div>';
    }

    let html = '';
    if (state.type) {
      html += `<div class="schema-property"><strong>Type:</strong> ${this.escapeHtml(state.type)}</div>`;
    }
    if (state.nullable !== undefined) {
      html += `<div class="schema-property"><strong>Nullable:</strong> ${state.nullable ? 'Yes' : 'No'}</div>`;
    }
    if (state.defaultValue) {
      html += `<div class="schema-property"><strong>Default:</strong> ${this.escapeHtml(state.defaultValue)}</div>`;
    }
    if (state.constraints && state.constraints.length > 0) {
      html += `<div class="schema-property"><strong>Constraints:</strong> ${state.constraints.map(c => this.escapeHtml(c)).join(', ')}</div>`;
    }
    if (state.indexes && state.indexes.length > 0) {
      html += `<div class="schema-property"><strong>Indexes:</strong> ${state.indexes.map(i => this.escapeHtml(i)).join(', ')}</div>`;
    }
    return html || '<div class="empty-state">No properties defined</div>';
  }

  /**
   * Renders a change item.
   */
  private renderChange(change: SchemaChange): string {
    const changeClass = `change-${change.type}${change.breaking ? ' change-breaking' : ''}`;
    const icon = change.type === 'added' ? '➕' : change.type === 'removed' ? '➖' : '🔄';
    
    return `
      <div class="change-item ${changeClass}">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <span>${icon}</span>
          <strong>${this.escapeHtml(change.field)}</strong>
          ${change.breaking ? '<span class="badge badge-breaking">BREAKING</span>' : ''}
        </div>
        <div style="color: var(--vscode-descriptionForeground); margin-bottom: 8px;">
          ${this.escapeHtml(change.description)}
        </div>
        ${change.before || change.after ? `
        <div class="diff-view">
          ${change.before ? `<div class="diff-line diff-line-removed">- ${this.escapeHtml(change.before)}</div>` : ''}
          ${change.after ? `<div class="diff-line diff-line-added">+ ${this.escapeHtml(change.after)}</div>` : ''}
        </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Converts schema value to string.
   */
  private schemaValueToString(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Escapes HTML special characters.
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Disposes all active panels.
   */
  dispose(): void {
    this.activePanels.forEach(panel => panel.dispose());
    this.activePanels.clear();
  }
}
