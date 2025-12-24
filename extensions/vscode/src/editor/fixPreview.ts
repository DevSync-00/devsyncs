/**
 * Fix Preview Manager
 * 
 * Shows AI-generated fixes in a webview with preview and apply options.
 */

import * as vscode from 'vscode';
import { Mismatch } from '../api';
import { EditorService } from '../ui/editor';
import { DiffViewManager } from './diffView';

export interface EnhancedFix {
  mismatch: Mismatch;
  explanation: string;
  sql: string;
  safety: 'safe' | 'caution' | 'risky' | 'unknown';
  impact?: string;
  codeChanges?: {
    file: string;
    before: string;
    after: string;
  };
}

/**
 * Helper function to safely get field name from mismatch.
 */
function getMismatchFieldName(mismatch: Mismatch): string {
  if ('field' in mismatch && mismatch.field) {
    return mismatch.field;
  }
  return 'table';
}

export interface FixPreview {
  fixes: EnhancedFix[];
  migration: {
    id: string;
    name: string;
    sql: string;
    rollback?: string;
    description: string;
  };
  summary: {
    total: number;
    safe: number;
    caution: number;
    risky: number;
  };
}

/**
 * Fix preview manager for showing AI-generated fixes.
 */
export class FixPreviewManager {
  private editorService: EditorService;
  private diffViewManager: DiffViewManager;
  private activeWebviews: Map<string, vscode.WebviewPanel> = new Map();

  constructor(editorService: EditorService) {
    this.editorService = editorService;
    this.diffViewManager = new DiffViewManager(editorService);
  }

  /**
   * Shows fix preview in a webview panel.
   */
  async showFixPreview(preview: FixPreview): Promise<void> {
    const panelId = `fix-preview-${preview.migration.id}`;
    
    // Check if panel already exists
    const existingPanel = this.activeWebviews.get(panelId);
    if (existingPanel) {
      existingPanel.reveal();
      return;
    }

    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
      'devsyncFixPreview',
      `Fix Preview: ${preview.migration.name}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );

    // Set webview content
    panel.webview.html = this.generateWebviewContent(preview, panel.webview);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'applyFix':
            await this.handleApplyFix(preview, message.fixIndex);
            break;
          case 'applyAll':
            await this.handleApplyAll(preview);
            break;
          case 'previewDiff':
            await this.handlePreviewDiff(preview, message.fixIndex);
            break;
          case 'showMigration':
            await this.showMigrationSQL(preview.migration);
            break;
          case 'close':
            panel.dispose();
            break;
        }
      },
      undefined,
      []
    );

    // Clean up on dispose
    panel.onDidDispose(() => {
      this.activeWebviews.delete(panelId);
    });

    this.activeWebviews.set(panelId, panel);
  }

  /**
   * Shows fix preview in a simple document view.
   */
  async showFixPreviewSimple(preview: FixPreview): Promise<void> {
    const content = this.formatFixPreviewAsMarkdown(preview);
    
    await this.editorService.openDocument(
      `Fix Preview: ${preview.migration.name}`,
      content,
      'markdown'
    );
  }

  /**
   * Generates webview HTML content.
   */
  private generateWebviewContent(preview: FixPreview, webview: vscode.Webview): string {
    const safeFixes = preview.fixes.filter(f => f.safety === 'safe');
    const cautionFixes = preview.fixes.filter(f => f.safety === 'caution');
    const riskyFixes = preview.fixes.filter(f => f.safety === 'risky');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fix Preview</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .header {
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .summary {
            display: flex;
            gap: 20px;
            margin: 20px 0;
        }
        .summary-item {
            padding: 10px;
            border-radius: 4px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
        }
        .fix-group {
            margin: 20px 0;
        }
        .fix-item {
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid;
            border-radius: 4px;
            background: var(--vscode-editor-background);
        }
        .fix-safe { border-color: #4caf50; }
        .fix-caution { border-color: #ff9800; }
        .fix-risky { border-color: #f44336; }
        .fix-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .fix-title {
            font-weight: bold;
            font-size: 1.1em;
        }
        .fix-explanation {
            margin: 10px 0;
            color: var(--vscode-descriptionForeground);
        }
        .fix-actions {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-danger {
            background: #f44336;
            color: white;
        }
        button:hover {
            opacity: 0.8;
        }
        .migration-section {
            margin-top: 30px;
            padding: 20px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
        }
        .safety-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge-safe { background: #4caf50; color: white; }
        .badge-caution { background: #ff9800; color: white; }
        .badge-risky { background: #f44336; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔧 Fix Preview</h1>
        <p><strong>Migration:</strong> ${preview.migration.name}</p>
        <p><strong>Description:</strong> ${preview.migration.description}</p>
    </div>

    <div class="summary">
        <div class="summary-item">
            <strong>Total:</strong> ${preview.summary.total}
        </div>
        <div class="summary-item">
            <strong>Safe:</strong> <span style="color: #4caf50">${preview.summary.safe}</span>
        </div>
        <div class="summary-item">
            <strong>Caution:</strong> <span style="color: #ff9800">${preview.summary.caution}</span>
        </div>
        <div class="summary-item">
            <strong>Risky:</strong> <span style="color: #f44336">${preview.summary.risky}</span>
        </div>
    </div>

    ${safeFixes.length > 0 ? this.renderFixGroup('Safe Fixes', safeFixes, preview.fixes) : ''}
    ${cautionFixes.length > 0 ? this.renderFixGroup('Caution Fixes', cautionFixes, preview.fixes) : ''}
    ${riskyFixes.length > 0 ? this.renderFixGroup('Risky Fixes', riskyFixes, preview.fixes) : ''}

    <div class="migration-section">
        <h2>Migration SQL</h2>
        <button class="btn-secondary" onclick="showMigration()">Show Full Migration</button>
        <pre><code>${this.escapeHtml(preview.migration.sql)}</code></pre>
    </div>

    <div style="margin-top: 20px; text-align: center;">
        <button class="btn-primary" onclick="applyAll()">Apply All Fixes</button>
        <button class="btn-secondary" onclick="close()">Close</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function applyFix(index) {
            vscode.postMessage({ command: 'applyFix', fixIndex: index });
        }
        
        function previewDiff(index) {
            vscode.postMessage({ command: 'previewDiff', fixIndex: index });
        }
        
        function applyAll() {
            if (confirm('Are you sure you want to apply all fixes? This will modify your database.')) {
                vscode.postMessage({ command: 'applyAll' });
            }
        }
        
        function showMigration() {
            vscode.postMessage({ command: 'showMigration' });
        }
        
        function close() {
            vscode.postMessage({ command: 'close' });
        }
    </script>
</body>
</html>`;
  }

  /**
   * Renders a group of fixes.
   */
  private renderFixGroup(title: string, fixes: EnhancedFix[], allFixes: EnhancedFix[]): string {
    const fixItems = fixes.map((fix, index) => {
      const globalIndex = allFixes.indexOf(fix);
      const safetyClass = `fix-${fix.safety}`;
      const badgeClass = `badge-${fix.safety}`;
      
      return `
        <div class="fix-item ${safetyClass}">
            <div class="fix-header">
                <div class="fix-title">
                    ${fix.mismatch.model}.${getMismatchFieldName(fix.mismatch)}
                    <span class="safety-badge ${badgeClass}">${fix.safety.toUpperCase()}</span>
                </div>
            </div>
            <div class="fix-explanation">${this.escapeHtml(fix.explanation)}</div>
            ${fix.impact ? `<div style="margin-top: 5px; font-size: 0.9em; color: var(--vscode-descriptionForeground);">Impact: ${this.escapeHtml(fix.impact)}</div>` : ''}
            <div class="fix-actions">
                <button class="btn-secondary" onclick="previewDiff(${globalIndex})">Preview Diff</button>
                <button class="btn-primary" onclick="applyFix(${globalIndex})">Apply Fix</button>
            </div>
        </div>
      `;
    }).join('');

    return `
      <div class="fix-group">
        <h2>${title} (${fixes.length})</h2>
        ${fixItems}
      </div>
    `;
  }

  /**
   * Formats fix preview as markdown.
   */
  private formatFixPreviewAsMarkdown(preview: FixPreview): string {
    let markdown = `# Fix Preview\n\n`;
    markdown += `**Migration:** ${preview.migration.name}\n`;
    markdown += `**Description:** ${preview.migration.description}\n\n`;

    markdown += `## Summary\n\n`;
    markdown += `- **Total Fixes:** ${preview.summary.total}\n`;
    markdown += `- **Safe:** ${preview.summary.safe}\n`;
    markdown += `- **Caution:** ${preview.summary.caution}\n`;
    markdown += `- **Risky:** ${preview.summary.risky}\n\n`;

    const safeFixes = preview.fixes.filter(f => f.safety === 'safe');
    const cautionFixes = preview.fixes.filter(f => f.safety === 'caution');
    const riskyFixes = preview.fixes.filter(f => f.safety === 'risky');

    if (safeFixes.length > 0) {
      markdown += `## ✅ Safe Fixes (${safeFixes.length})\n\n`;
      for (const fix of safeFixes) {
        markdown += this.formatFixAsMarkdown(fix);
      }
    }

    if (cautionFixes.length > 0) {
      markdown += `## ⚠️ Caution Fixes (${cautionFixes.length})\n\n`;
      for (const fix of cautionFixes) {
        markdown += this.formatFixAsMarkdown(fix);
      }
    }

    if (riskyFixes.length > 0) {
      markdown += `## ⚠️ Risky Fixes (${riskyFixes.length})\n\n`;
      for (const fix of riskyFixes) {
        markdown += this.formatFixAsMarkdown(fix);
      }
    }

    markdown += `## Migration SQL\n\n`;
    markdown += `\`\`\`sql\n${preview.migration.sql}\n\`\`\`\n`;

    if (preview.migration.rollback) {
      markdown += `## Rollback SQL\n\n`;
      markdown += `\`\`\`sql\n${preview.migration.rollback}\n\`\`\`\n`;
    }

    return markdown;
  }

  /**
   * Formats a single fix as markdown.
   */
  private formatFixAsMarkdown(fix: EnhancedFix): string {
    let md = `### ${fix.mismatch.model}.${getMismatchFieldName(fix.mismatch)}\n\n`;
    md += `**Type:** ${fix.mismatch.type}\n`;
    md += `**Safety:** ${fix.safety}\n`;
    md += `**Severity:** ${fix.mismatch.severity}\n\n`;
    md += `**Explanation:** ${fix.explanation}\n\n`;
    
    if (fix.impact) {
      md += `**Impact:** ${fix.impact}\n\n`;
    }

    md += `**SQL:**\n\`\`\`sql\n${fix.sql}\n\`\`\`\n\n`;
    
    return md;
  }

  /**
   * Handles applying a single fix.
   */
  private async handleApplyFix(preview: FixPreview, fixIndex: number): Promise<void> {
    const fix = preview.fixes[fixIndex];
    if (!fix) {
      return;
    }

    const confirmed = await vscode.window.showWarningMessage(
      `Apply fix for ${fix.mismatch.model}.${getMismatchFieldName(fix.mismatch)}?`,
      { modal: true },
      'Apply',
      'Cancel'
    );

    if (confirmed === 'Apply') {
      // Execute fix via CLI
      vscode.commands.executeCommand('devsync.applyFix', fix);
    }
  }

  /**
   * Handles applying all fixes.
   */
  private async handleApplyAll(preview: FixPreview): Promise<void> {
    const confirmed = await vscode.window.showWarningMessage(
      `Apply all ${preview.fixes.length} fixes? This will modify your database.`,
      { modal: true },
      'Apply All',
      'Cancel'
    );

    if (confirmed === 'Apply All') {
      vscode.commands.executeCommand('devsync.batchApplyFixes', preview.fixes);
    }
  }

  /**
   * Handles previewing diff for a fix.
   */
  private async handlePreviewDiff(preview: FixPreview, fixIndex: number): Promise<void> {
    const fix = preview.fixes[fixIndex];
    if (!fix || !fix.codeChanges) {
      vscode.window.showInformationMessage('No code changes available for this fix.');
      return;
    }

    // Try to open the file and show diff
    try {
      const document = await vscode.workspace.openTextDocument(fix.codeChanges.file);
      await this.diffViewManager.showDiffView(
        document,
        fix.codeChanges.after,
        `Preview Fix: ${fix.mismatch.model}.${getMismatchFieldName(fix.mismatch)}`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show diff: ${error}`);
    }
  }

  /**
   * Shows migration SQL in a document.
   */
  private async showMigrationSQL(migration: { sql: string; rollback?: string }): Promise<void> {
    let content = `# Migration SQL\n\n`;
    content += `\`\`\`sql\n${migration.sql}\n\`\`\`\n`;

    if (migration.rollback) {
      content += `\n## Rollback SQL\n\n`;
      content += `\`\`\`sql\n${migration.rollback}\n\`\`\`\n`;
    }

    await this.editorService.openDocument('Migration SQL', content, 'markdown');
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
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Disposes all active webviews.
   */
  dispose(): void {
    this.activeWebviews.forEach(panel => panel.dispose());
    this.activeWebviews.clear();
  }
}
