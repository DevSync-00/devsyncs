/**
 * Enhanced Fix Preview Manager
 * 
 * Shows AI-generated fixes in a rich webview with diff views, icons, severity indicators,
 * expandable details, and inline fix application capabilities.
 */

import * as vscode from 'vscode';
import { Mismatch } from '../api';
import { EditorService } from '../ui/editor';
import { DiffViewManager } from './diffView';
import { SchemaComparisonManager } from './schemaComparison';

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
  breaking?: boolean;
  estimatedTime?: string;
  affectedRows?: number;
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
  validation?: {
    valid: boolean;
    errors: Array<{
      type: string;
      severity: 'error';
      message: string;
      line?: number;
      suggestion?: string;
    }>;
    warnings: Array<{
      type: string;
      severity: 'warning';
      message: string;
      line?: number;
      suggestion?: string;
    }>;
    breakingChanges: Array<{
      type: string;
      severity: 'error' | 'warning';
      message: string;
      affectedTable?: string;
      affectedColumn?: string;
      line?: number;
      impact?: string;
      mitigation?: string;
    }>;
    summary: {
      totalIssues: number;
      errorCount: number;
      warningCount: number;
      breakingChangeCount: number;
    };
  };
}

/**
 * Fix preview manager for showing AI-generated fixes.
 */
export class FixPreviewManager {
  private editorService: EditorService;
  private diffViewManager: DiffViewManager;
  private schemaComparisonManager: SchemaComparisonManager;
  private activeWebviews: Map<string, vscode.WebviewPanel> = new Map();

  constructor(editorService: EditorService) {
    this.editorService = editorService;
    this.diffViewManager = new DiffViewManager(editorService);
    this.schemaComparisonManager = new SchemaComparisonManager(editorService);
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
            await this.handleApplyFix(preview, message.fixIndex, panel);
            break;
          case 'applyAll':
            await this.handleApplyAll(preview, panel);
            break;
          case 'previewDiff':
            await this.handlePreviewDiff(preview, message.fixIndex);
            break;
          case 'showSchemaComparison':
            await this.handleShowSchemaComparison(preview, message.fixIndex);
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
   * Generates enhanced webview HTML content with rich UI components.
   */
  private generateWebviewContent(preview: FixPreview, webview: vscode.Webview): string {
    const safeFixes = preview.fixes.filter(f => f.safety === 'safe');
    const cautionFixes = preview.fixes.filter(f => f.safety === 'caution');
    const riskyFixes = preview.fixes.filter(f => f.safety === 'risky');
    const breakingFixes = preview.fixes.filter(f => f.breaking === true);

    // Get webview URI for resources
    const webviewUri = (path: string) => {
      return webview.asWebviewUri(vscode.Uri.joinPath(
        vscode.Uri.file(__dirname), '..', '..', 'resources', path
      )).toString();
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced Fix Preview</title>
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
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .summary-item {
            padding: 15px;
            border-radius: 6px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            text-align: center;
        }
        .summary-item strong {
            display: block;
            font-size: 24px;
            margin-bottom: 5px;
        }
        .summary-item-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }
        .fix-group {
            margin: 25px 0;
        }
        .fix-group-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
            font-size: 18px;
            font-weight: 600;
        }
        .fix-item {
            padding: 20px;
            margin: 15px 0;
            border-left: 5px solid;
            border-radius: 6px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            transition: all 0.2s ease;
        }
        .fix-item:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .fix-safe { border-left-color: #4caf50; }
        .fix-caution { border-left-color: #ff9800; }
        .fix-risky { border-left-color: #f44336; }
        .fix-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
            gap: 15px;
        }
        .fix-title-section {
            flex: 1;
        }
        .fix-title {
            font-weight: 600;
            font-size: 16px;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .fix-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 10px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .fix-badges {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .fix-explanation {
            margin: 15px 0;
            color: var(--vscode-descriptionForeground);
            line-height: 1.6;
        }
        .fix-details {
            margin: 15px 0;
            padding: 15px;
            background: var(--vscode-textCodeBlock-background);
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
        }
        .fix-details-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
            font-weight: 600;
            margin-bottom: 10px;
        }
        .fix-details-content {
            display: none;
            margin-top: 10px;
        }
        .fix-details-content.expanded {
            display: block;
        }
        .fix-actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
            flex-wrap: wrap;
        }
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .btn-primary:hover:not(:disabled) {
            background: var(--vscode-button-hoverBackground);
        }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover:not(:disabled) {
            opacity: 0.8;
        }
        .btn-danger {
            background: #f44336;
            color: white;
        }
        .btn-danger:hover:not(:disabled) {
            background: #d32f2f;
        }
        .btn-success {
            background: #4caf50;
            color: white;
        }
        .migration-section {
            margin-top: 30px;
            padding: 20px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
        }
        pre {
            background: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            border: 1px solid var(--vscode-panel-border);
        }
        code {
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
        }
        .safety-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .badge-safe { background: #4caf50; color: white; }
        .badge-caution { background: #ff9800; color: white; }
        .badge-risky { background: #f44336; color: white; }
        .badge-breaking {
            background: #d32f2f;
            color: white;
        }
        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 6px;
        }
        .status-pending { background: #ff9800; }
        .status-applying { background: #2196f3; animation: pulse 1.5s infinite; }
        .status-success { background: #4caf50; }
        .status-error { background: #f44336; }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
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
        .icon {
            display: inline-block;
            width: 16px;
            height: 16px;
            vertical-align: middle;
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
            color: var(--vscode-foreground);
        }
        .alert-danger {
            background: rgba(244, 67, 54, 0.1);
            border-color: #f44336;
            color: var(--vscode-foreground);
        }
        .alert-info {
            background: rgba(33, 150, 243, 0.1);
            border-color: #2196f3;
            color: var(--vscode-foreground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>
            <span>🔧</span>
            <span>Enhanced Fix Preview</span>
        </h1>
        <p><strong>Migration:</strong> ${this.escapeHtml(preview.migration.name)}</p>
        <p><strong>Description:</strong> ${this.escapeHtml(preview.migration.description)}</p>
        ${preview.validation ? this.renderValidationSection(preview.validation) : ''}
        ${breakingFixes.length > 0 ? `
        <div class="alert alert-danger">
            <strong>⚠️ Breaking Changes Detected:</strong> ${breakingFixes.length} fix${breakingFixes.length !== 1 ? 'es' : ''} may cause breaking changes. Review carefully before applying.
        </div>
        ` : ''}
    </div>

    <div class="summary">
        <div class="summary-item">
            <strong style="color: var(--vscode-foreground)">${preview.summary.total}</strong>
            <span class="summary-item-label">Total Fixes</span>
        </div>
        <div class="summary-item">
            <strong style="color: #4caf50">${preview.summary.safe}</strong>
            <span class="summary-item-label">Safe</span>
        </div>
        <div class="summary-item">
            <strong style="color: #ff9800">${preview.summary.caution}</strong>
            <span class="summary-item-label">Caution</span>
        </div>
        <div class="summary-item">
            <strong style="color: #f44336">${preview.summary.risky}</strong>
            <span class="summary-item-label">Risky</span>
        </div>
        ${breakingFixes.length > 0 ? `
        <div class="summary-item">
            <strong style="color: #d32f2f">${breakingFixes.length}</strong>
            <span class="summary-item-label">Breaking</span>
        </div>
        ` : ''}
    </div>

    ${safeFixes.length > 0 ? this.renderFixGroup('✅ Safe Fixes', safeFixes, preview.fixes) : ''}
    ${cautionFixes.length > 0 ? this.renderFixGroup('⚠️ Caution Fixes', cautionFixes, preview.fixes) : ''}
    ${riskyFixes.length > 0 ? this.renderFixGroup('🚨 Risky Fixes', riskyFixes, preview.fixes) : ''}

    <div class="migration-section">
        <h2>📋 Migration SQL</h2>
        <button class="btn-secondary" onclick="showMigration()">Show Full Migration</button>
        <pre><code>${this.escapeHtml(preview.migration.sql)}</code></pre>
        ${preview.migration.rollback ? `
        <details style="margin-top: 15px;">
            <summary style="cursor: pointer; font-weight: 600; margin-bottom: 10px;">Rollback SQL</summary>
            <pre><code>${this.escapeHtml(preview.migration.rollback)}</code></pre>
        </details>
        ` : ''}
    </div>

    <div style="margin-top: 30px; text-align: center; padding-top: 20px; border-top: 2px solid var(--vscode-panel-border);">
        <button class="btn-primary" onclick="applyAll()" id="applyAllBtn">
            <span>✓</span>
            <span>Apply All Fixes</span>
        </button>
        <button class="btn-secondary" onclick="close()">Close</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const fixStates = new Map();
        
        function toggleDetails(index) {
            const content = document.getElementById(\`details-\${index}\`);
            const icon = document.getElementById(\`details-icon-\${index}\`);
            if (content && icon) {
                content.classList.toggle('expanded');
                icon.textContent = content.classList.contains('expanded') ? '▼' : '▶';
            }
        }
        
        function applyFix(index) {
            const fixItem = document.getElementById(\`fix-\${index}\`);
            const btn = document.getElementById(\`apply-btn-\${index}\`);
            const status = document.getElementById(\`status-\${index}\`);
            
            if (!fixItem || !btn || fixStates.has(index)) return;
            
            // Show confirmation for risky or breaking fixes
            const fix = window.fixes[index];
            if (fix && (fix.safety === 'risky' || fix.breaking)) {
                const confirmed = confirm(
                    \`⚠️ Warning: This fix is marked as \${fix.safety === 'risky' ? 'RISKY' : 'BREAKING'}.\n\n\` +
                    \`Are you sure you want to apply this fix?\n\n\` +
                    \`Fix: \${fix.mismatch.model}.\${fix.mismatch.field || 'table'}\`
                );
                if (!confirmed) return;
            }
            
            fixStates.set(index, 'applying');
            btn.disabled = true;
            btn.innerHTML = '<span class="status-indicator status-applying"></span>Applying...';
            if (status) {
                status.className = 'status-indicator status-applying';
                status.title = 'Applying fix...';
            }
            
            vscode.postMessage({ command: 'applyFix', fixIndex: index });
        }
        
        function previewDiff(index) {
            vscode.postMessage({ command: 'previewDiff', fixIndex: index });
        }
        
        function showSchemaComparison(index) {
            vscode.postMessage({ command: 'showSchemaComparison', fixIndex: index });
        }
        
        function applyAll() {
            const riskyCount = window.fixes.filter(f => f.safety === 'risky' || f.breaking).length;
            let message = \`Apply all \${window.fixes.length} fixes?\n\nThis will modify your database.\`;
            if (riskyCount > 0) {
                message += \`\n\n⚠️ Warning: \${riskyCount} fix\${riskyCount !== 1 ? 'es are' : ' is'} marked as risky or breaking.\`;
            }
            
            if (confirm(message)) {
                const btn = document.getElementById('applyAllBtn');
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<span class="status-indicator status-applying"></span>Applying All...';
                }
                vscode.postMessage({ command: 'applyAll' });
            }
        }
        
        function showMigration() {
            vscode.postMessage({ command: 'showMigration' });
        }
        
        function close() {
            vscode.postMessage({ command: 'close' });
        }
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'fixApplied':
                    const index = message.fixIndex;
                    const btn = document.getElementById(\`apply-btn-\${index}\`);
                    const status = document.getElementById(\`status-\${index}\`);
                    if (btn) {
                        btn.className = 'btn-success';
                        btn.innerHTML = '<span>✓</span> Applied';
                        btn.disabled = true;
                    }
                    if (status) {
                        status.className = 'status-indicator status-success';
                        status.title = 'Fix applied successfully';
                    }
                    fixStates.set(index, 'success');
                    break;
                case 'fixFailed':
                    const failedIndex = message.fixIndex;
                    const failedBtn = document.getElementById(\`apply-btn-\${failedIndex}\`);
                    const failedStatus = document.getElementById(\`status-\${failedIndex}\`);
                    if (failedBtn) {
                        failedBtn.disabled = false;
                        failedBtn.innerHTML = '<span>⚠</span> Retry';
                        failedBtn.className = 'btn-danger';
                    }
                    if (failedStatus) {
                        failedStatus.className = 'status-indicator status-error';
                        failedStatus.title = \`Failed: \${message.error || 'Unknown error'}\`;
                    }
                    fixStates.delete(failedIndex);
                    break;
            }
        });
        
        // Store fixes globally for access in functions
        window.fixes = ${JSON.stringify(preview.fixes)};
    </script>
</body>
</html>`;
  }

  /**
   * Renders a group of fixes with enhanced UI.
   */
  private renderFixGroup(title: string, fixes: EnhancedFix[], allFixes: EnhancedFix[]): string {
    const fixItems = fixes.map((fix, index) => {
      const globalIndex = allFixes.indexOf(fix);
      const safetyClass = `fix-${fix.safety}`;
      const badgeClass = `badge-${fix.safety}`;
      const hasCodeChanges = fix.codeChanges && fix.codeChanges.before && fix.codeChanges.after;
      
      // Generate diff view if code changes are available
      const diffView = hasCodeChanges ? this.renderDiffView(fix.codeChanges!.before, fix.codeChanges!.after) : '';
      
      // Get severity icon
      const severityIcon = fix.mismatch.severity === 'error' ? '🔴' : 
                          fix.mismatch.severity === 'warning' ? '🟡' : '🔵';
      
      // Get mismatch type icon
      const typeIcon = this.getMismatchTypeIcon(fix.mismatch.type);
      
      return `
        <div class="fix-item ${safetyClass}" id="fix-${globalIndex}">
            <div class="fix-header">
                <div class="fix-title-section">
                    <div class="fix-title">
                        <span>${typeIcon}</span>
                        <span>${this.escapeHtml(fix.mismatch.model)}.${this.escapeHtml(getMismatchFieldName(fix.mismatch))}</span>
                        <span class="safety-badge ${badgeClass}">${fix.safety.toUpperCase()}</span>
                        ${fix.breaking ? '<span class="safety-badge badge-breaking">BREAKING</span>' : ''}
                        <span class="status-indicator status-pending" id="status-${globalIndex}" title="Pending"></span>
                    </div>
                    <div class="fix-meta">
                        <span>${severityIcon} ${fix.mismatch.severity.toUpperCase()}</span>
                        <span>•</span>
                        <span>Type: ${this.formatMismatchType(fix.mismatch.type)}</span>
                        ${fix.estimatedTime ? `<span>•</span><span>⏱ ${fix.estimatedTime}</span>` : ''}
                        ${fix.affectedRows !== undefined ? `<span>•</span><span>📊 ~${fix.affectedRows} rows</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="fix-explanation">${this.escapeHtml(fix.explanation)}</div>
            ${fix.impact ? `
            <div class="alert ${fix.safety === 'risky' ? 'alert-danger' : fix.safety === 'caution' ? 'alert-warning' : 'alert-info'}">
                <strong>Impact:</strong> ${this.escapeHtml(fix.impact)}
            </div>
            ` : ''}
            ${hasCodeChanges ? `
            <div class="fix-details">
                <div class="fix-details-header" onclick="toggleDetails(${globalIndex})">
                    <span>📝 Code Changes</span>
                    <span id="details-icon-${globalIndex}">▶</span>
                </div>
                <div class="fix-details-content" id="details-${globalIndex}">
                    ${diffView}
                </div>
            </div>
            ` : ''}
            <div class="fix-details">
                <div class="fix-details-header" onclick="toggleDetails(${globalIndex + 1000})">
                    <span>💾 SQL Fix</span>
                    <span id="details-icon-${globalIndex + 1000}">▶</span>
                </div>
                <div class="fix-details-content" id="details-${globalIndex + 1000}">
                    <pre><code>${this.escapeHtml(fix.sql)}</code></pre>
                </div>
            </div>
            <div class="fix-actions">
                <button class="btn-secondary" onclick="previewDiff(${globalIndex})" title="Preview diff view">
                    <span>👁</span>
                    <span>Preview Diff</span>
                </button>
                <button class="btn-secondary" onclick="showSchemaComparison(${globalIndex})" title="Show schema comparison">
                    <span>⚖</span>
                    <span>Compare Schema</span>
                </button>
                <button class="btn-primary" id="apply-btn-${globalIndex}" onclick="applyFix(${globalIndex})" title="Apply this fix">
                    <span>✓</span>
                    <span>Apply Fix</span>
                </button>
            </div>
        </div>
      `;
    }).join('');

    return `
      <div class="fix-group">
        <div class="fix-group-header">
          <span>${title}</span>
          <span style="font-size: 14px; color: var(--vscode-descriptionForeground);">(${fixes.length})</span>
        </div>
        ${fixItems}
      </div>
    `;
  }

  /**
   * Renders a diff view for code changes.
   */
  private renderDiffView(before: string, after: string): string {
    const beforeLines = before.split('\n');
    const afterLines = after.split('\n');
    const maxLines = Math.max(beforeLines.length, afterLines.length);
    
    let diffHtml = '<div class="diff-view">';
    
    // Simple line-by-line comparison
    for (let i = 0; i < maxLines; i++) {
      const beforeLine = beforeLines[i] || '';
      const afterLine = afterLines[i] || '';
      
      if (beforeLine !== afterLine) {
        if (beforeLine && afterLine) {
          // Modified line
          diffHtml += `<div class="diff-line diff-line-removed">- ${this.escapeHtml(beforeLine)}</div>`;
          diffHtml += `<div class="diff-line diff-line-added">+ ${this.escapeHtml(afterLine)}</div>`;
        } else if (beforeLine) {
          // Removed line
          diffHtml += `<div class="diff-line diff-line-removed">- ${this.escapeHtml(beforeLine)}</div>`;
        } else if (afterLine) {
          // Added line
          diffHtml += `<div class="diff-line diff-line-added">+ ${this.escapeHtml(afterLine)}</div>`;
        }
      } else if (beforeLine) {
        // Unchanged line (show context)
        diffHtml += `<div class="diff-line diff-line-context">  ${this.escapeHtml(beforeLine)}</div>`;
      }
    }
    
    diffHtml += '</div>';
    return diffHtml;
  }

  /**
   * Gets icon for mismatch type.
   */
  private getMismatchTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'missing_table': '📋',
      'missing_field': '➕',
      'type_mismatch': '🔄',
      'extra_field': '➖',
      'constraint_mismatch': '🔒'
    };
    return icons[type] || '⚠️';
  }

  /**
   * Formats mismatch type for display.
   */
  private formatMismatchType(type: string): string {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
   * Handles applying a single fix with enhanced feedback.
   */
  private async handleApplyFix(preview: FixPreview, fixIndex: number, panel: vscode.WebviewPanel): Promise<void> {
    const fix = preview.fixes[fixIndex];
    if (!fix) {
      return;
    }

    // Show confirmation dialog with details
    const confirmMessage = fix.breaking 
      ? `⚠️ BREAKING CHANGE: This fix may cause breaking changes.\n\nApply fix for ${fix.mismatch.model}.${getMismatchFieldName(fix.mismatch)}?`
      : fix.safety === 'risky'
      ? `⚠️ RISKY: This fix is marked as risky and may have unintended consequences.\n\nApply fix for ${fix.mismatch.model}.${getMismatchFieldName(fix.mismatch)}?`
      : `Apply fix for ${fix.mismatch.model}.${getMismatchFieldName(fix.mismatch)}?`;

    const confirmed = await vscode.window.showWarningMessage(
      confirmMessage,
      { modal: true },
      'Apply',
      'Cancel'
    );

    if (confirmed === 'Apply') {
      try {
        // Send applying state to webview
        panel.webview.postMessage({
          command: 'fixApplying',
          fixIndex: fixIndex
        });

        // Execute fix via CLI
        await vscode.commands.executeCommand('devsync.applyFix', fix);

        // Send success state to webview
        panel.webview.postMessage({
          command: 'fixApplied',
          fixIndex: fixIndex
        });

        vscode.window.showInformationMessage(
          `✅ Fix applied successfully: ${fix.mismatch.model}.${getMismatchFieldName(fix.mismatch)}`
        );
      } catch (error: unknown) {
        // Send failure state to webview
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        panel.webview.postMessage({
          command: 'fixFailed',
          fixIndex: fixIndex,
          error: errorMessage
        });

        vscode.window.showErrorMessage(
          `❌ Failed to apply fix: ${errorMessage}`
        );
      }
    }
  }

  /**
   * Handles applying all fixes with enhanced feedback.
   */
  private async handleApplyAll(preview: FixPreview, panel: vscode.WebviewPanel): Promise<void> {
    const riskyCount = preview.fixes.filter(f => f.safety === 'risky' || f.breaking).length;
    const confirmMessage = riskyCount > 0
      ? `Apply all ${preview.fixes.length} fixes?\n\n⚠️ Warning: ${riskyCount} fix${riskyCount !== 1 ? 'es are' : ' is'} marked as risky or breaking.\n\nThis will modify your database.`
      : `Apply all ${preview.fixes.length} fixes? This will modify your database.`;

    const confirmed = await vscode.window.showWarningMessage(
      confirmMessage,
      { modal: true },
      'Apply All',
      'Cancel'
    );

    if (confirmed === 'Apply All') {
      try {
        // Apply fixes one by one with progress
        const progressOptions: vscode.ProgressOptions = {
          location: vscode.ProgressLocation.Notification,
          title: 'Applying Fixes',
          cancellable: false
        };

        await vscode.window.withProgress(progressOptions, async (progress) => {
          let successCount = 0;
          let failureCount = 0;

          for (let i = 0; i < preview.fixes.length; i++) {
            const fix = preview.fixes[i];
            progress.report({
              increment: 100 / preview.fixes.length,
              message: `Applying fix ${i + 1}/${preview.fixes.length}: ${fix.mismatch.model}.${getMismatchFieldName(fix.mismatch)}`
            });

            try {
              await vscode.commands.executeCommand('devsync.applyFix', fix);
              successCount++;
              
              // Update webview
              panel.webview.postMessage({
                command: 'fixApplied',
                fixIndex: i
              });
            } catch (error: unknown) {
              failureCount++;
              
              // Update webview
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              panel.webview.postMessage({
                command: 'fixFailed',
                fixIndex: i,
                error: errorMessage
              });
            }
          }

          // Show summary
          if (failureCount === 0) {
            vscode.window.showInformationMessage(
              `✅ Successfully applied all ${successCount} fixes!`
            );
          } else {
            vscode.window.showWarningMessage(
              `⚠️ Applied ${successCount} fixes, ${failureCount} failed. Check the preview for details.`
            );
          }
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(
          `❌ Failed to apply fixes: ${errorMessage}`
        );
      }
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
   * Handles showing schema comparison view.
   */
  private async handleShowSchemaComparison(preview: FixPreview, fixIndex: number): Promise<void> {
    const fix = preview.fixes[fixIndex];
    if (!fix) {
      return;
    }

    // Show schema comparison using the comparison manager
    await this.schemaComparisonManager.showComparisonForFix(fix);
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
   * Renders validation section in webview.
   */
  private renderValidationSection(validation: NonNullable<FixPreview['validation']>): string {
    if (!validation) {
      return '';
    }

    const isValid = validation.valid;
    const hasErrors = validation.errors.length > 0;
    const hasWarnings = validation.warnings.length > 0;
    const hasBreakingChanges = validation.breakingChanges.length > 0;

    let html = '<div class="validation-section" style="margin: 20px 0; padding: 15px; border-radius: 6px; border: 2px solid; ';
    html += isValid && !hasErrors ? 'border-color: #4caf50; background: rgba(76, 175, 80, 0.1);' : 'border-color: #f44336; background: rgba(244, 67, 54, 0.1);';
    html += '">';
    
    html += `<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">`;
    html += isValid && !hasErrors 
      ? '<span style="font-size: 24px;">✅</span><h2 style="margin: 0;">Validation Passed</h2>'
      : '<span style="font-size: 24px;">❌</span><h2 style="margin: 0;">Validation Failed</h2>';
    html += `</div>`;

    html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 15px;">`;
    html += `<div><strong>${validation.summary.errorCount}</strong> Errors</div>`;
    html += `<div><strong>${validation.summary.warningCount}</strong> Warnings</div>`;
    html += `<div><strong>${validation.summary.breakingChangeCount}</strong> Breaking Changes</div>`;
    html += `</div>`;

    if (hasErrors) {
      html += '<div style="margin-top: 15px;"><h3 style="color: #f44336; margin-bottom: 10px;">❌ Errors</h3>';
      validation.errors.forEach((error) => {
        html += `<div class="validation-item" style="padding: 10px; margin: 8px 0; background: rgba(244, 67, 54, 0.1); border-left: 3px solid #f44336; border-radius: 4px;">`;
        html += `<div style="font-weight: 600; margin-bottom: 5px;">${this.escapeHtml(error.message)}</div>`;
        if (error.line) {
          html += `<div style="font-size: 12px; color: var(--vscode-descriptionForeground);">Line ${error.line}</div>`;
        }
        if (error.suggestion) {
          html += `<div style="font-size: 12px; margin-top: 5px; color: var(--vscode-descriptionForeground);"><strong>Suggestion:</strong> ${this.escapeHtml(error.suggestion)}</div>`;
        }
        html += `</div>`;
      });
      html += '</div>';
    }

    if (hasWarnings) {
      html += '<div style="margin-top: 15px;"><h3 style="color: #ff9800; margin-bottom: 10px;">⚠️ Warnings</h3>';
      validation.warnings.forEach((warning) => {
        html += `<div class="validation-item" style="padding: 10px; margin: 8px 0; background: rgba(255, 152, 0, 0.1); border-left: 3px solid #ff9800; border-radius: 4px;">`;
        html += `<div style="font-weight: 600; margin-bottom: 5px;">${this.escapeHtml(warning.message)}</div>`;
        if (warning.line) {
          html += `<div style="font-size: 12px; color: var(--vscode-descriptionForeground);">Line ${warning.line}</div>`;
        }
        if (warning.suggestion) {
          html += `<div style="font-size: 12px; margin-top: 5px; color: var(--vscode-descriptionForeground);"><strong>Suggestion:</strong> ${this.escapeHtml(warning.suggestion)}</div>`;
        }
        html += `</div>`;
      });
      html += '</div>';
    }

    if (hasBreakingChanges) {
      html += '<div style="margin-top: 15px;"><h3 style="color: #d32f2f; margin-bottom: 10px;">🚨 Breaking Changes</h3>';
      validation.breakingChanges.forEach((change) => {
        html += `<div class="validation-item" style="padding: 10px; margin: 8px 0; background: rgba(211, 47, 47, 0.1); border-left: 3px solid #d32f2f; border-radius: 4px;">`;
        html += `<div style="font-weight: 600; margin-bottom: 5px;">${this.escapeHtml(change.message)}</div>`;
        if (change.affectedTable) {
          html += `<div style="font-size: 12px; color: var(--vscode-descriptionForeground);">Table: ${this.escapeHtml(change.affectedTable)}${change.affectedColumn ? `, Column: ${this.escapeHtml(change.affectedColumn)}` : ''}</div>`;
        }
        if (change.impact) {
          html += `<div style="font-size: 12px; margin-top: 5px; color: var(--vscode-descriptionForeground);"><strong>Impact:</strong> ${this.escapeHtml(change.impact)}</div>`;
        }
        if (change.mitigation) {
          html += `<div style="font-size: 12px; margin-top: 5px; color: var(--vscode-descriptionForeground);"><strong>Mitigation:</strong> ${this.escapeHtml(change.mitigation)}</div>`;
        }
        html += `</div>`;
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
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

