/**
 * Inline help panels.
 * 
 * Provides inline help panels that can be displayed in the editor or sidebar.
 */

import * as vscode from 'vscode';
import { HelpContent } from './content';

/**
 * Help panel configuration.
 */
export interface HelpPanelConfig {
  /** Panel title */
  title: string;
  /** Panel content (markdown) */
  content: string;
  /** Optional documentation link */
  docLink?: string;
  /** Optional video link */
  videoLink?: string;
  /** Panel position */
  position?: 'editor' | 'sidebar' | 'output';
}

/**
 * Help panel manager.
 */
export class HelpPanelManager {
  private static panels: Map<string, { dispose(): void }> = new Map();

  /**
   * Shows a help panel.
   */
  static async showHelpPanel(
    context: vscode.ExtensionContext,
    panelId: string,
    config: HelpPanelConfig
  ): Promise<void> {
    // Close existing panel if open
    const existing = this.panels.get(panelId);
    if (existing && 'dispose' in existing) {
      existing.dispose();
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'devsyncHelp',
      config.title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    // Set panel content
    panel.webview.html = this.getWebviewContent(config);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'openDoc':
            if (config.docLink) {
              vscode.env.openExternal(vscode.Uri.parse(config.docLink));
            }
            break;
          case 'openVideo':
            if (config.videoLink) {
              vscode.env.openExternal(vscode.Uri.parse(config.videoLink));
            }
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    // Track panel
    this.panels.set(panelId, panel);

    // Clean up on dispose
    panel.onDidDispose(() => {
      this.panels.delete(panelId);
    });
  }

  /**
   * Shows help panel in output channel.
   */
  static showHelpInOutput(panelId: string, config: HelpPanelConfig): void {
    const outputChannel = vscode.window.createOutputChannel(`DevSync Help: ${config.title}`);
    outputChannel.appendLine(config.title);
    outputChannel.appendLine('='.repeat(50));
    outputChannel.appendLine('');
    
    // Convert markdown to plain text (simplified)
    const plainText = config.content
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    
    outputChannel.appendLine(plainText);
    
    if (config.docLink) {
      outputChannel.appendLine(`\nDocumentation: ${config.docLink}`);
    }
    if (config.videoLink) {
      outputChannel.appendLine(`Video Guide: ${config.videoLink}`);
    }
    
    outputChannel.show();
  }

  /**
   * Gets webview HTML content.
   */
  private static getWebviewContent(config: HelpPanelConfig): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        h1, h2, h3 {
            color: var(--vscode-textLink-foreground);
        }
        code {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 2px 4px;
            border-radius: 3px;
        }
        pre {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
        }
        a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .actions {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            margin-right: 10px;
            cursor: pointer;
            border-radius: 3px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div id="content">${this.markdownToHtml(config.content)}</div>
    <div class="actions">
        ${config.docLink ? `<button onclick="openDoc()">📚 Open Documentation</button>` : ''}
        ${config.videoLink ? `<button onclick="openVideo()">🎥 Watch Video Guide</button>` : ''}
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        function openDoc() {
            vscode.postMessage({ command: 'openDoc' });
        }
        function openVideo() {
            vscode.postMessage({ command: 'openVideo' });
        }
    </script>
</body>
</html>`;
  }

  /**
   * Converts markdown to HTML (simplified).
   */
  private static markdownToHtml(markdown: string): string {
    // Simple markdown to HTML conversion
    return markdown
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
      .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\n/g, '<br>');
  }
}

