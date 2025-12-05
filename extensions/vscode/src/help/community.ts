/**
 * Community forum integration.
 * 
 * Provides integration with community forum for support and discussions.
 */

import * as vscode from 'vscode';
import { HelpContent } from './content';

/**
 * Community manager.
 */
export class CommunityManager {
  /**
   * Opens community forum.
   */
  static async openForum(): Promise<void> {
    const forumLink = HelpContent.getForumLink();
    await vscode.env.openExternal(vscode.Uri.parse(forumLink));
  }

  /**
   * Opens forum search.
   */
  static async searchForum(query: string): Promise<void> {
    const forumLink = HelpContent.getForumLink();
    const searchUrl = `${forumLink}/search?q=${encodeURIComponent(query)}`;
    await vscode.env.openExternal(vscode.Uri.parse(searchUrl));
  }

  /**
   * Opens forum topic.
   */
  static async openTopic(topicId: string): Promise<void> {
    const forumLink = HelpContent.getForumLink();
    const topicUrl = `${forumLink}/t/${topicId}`;
    await vscode.env.openExternal(vscode.Uri.parse(topicUrl));
  }

  /**
   * Shows community panel with quick links.
   */
  static async showCommunityPanel(context: vscode.ExtensionContext): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'devsyncCommunity',
      'DevSync Community',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = this.getCommunityContent();

    panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'openForum':
            this.openForum();
            break;
          case 'searchForum':
            if (message.query) {
              this.searchForum(message.query);
            }
            break;
          case 'openTopic':
            if (message.topicId) {
              this.openTopic(message.topicId);
            }
            break;
        }
      },
      undefined,
      context.subscriptions
    );
  }

  /**
   * Gets community panel HTML content.
   */
  private static getCommunityContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DevSync Community</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        h1 {
            color: var(--vscode-textLink-foreground);
        }
        .section {
            margin: 20px 0;
            padding: 15px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            margin: 5px;
            cursor: pointer;
            border-radius: 3px;
            width: 100%;
            text-align: left;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        input {
            width: 100%;
            padding: 8px;
            margin: 10px 0;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
        }
    </style>
</head>
<body>
    <h1>🌐 DevSync Community</h1>
    <p>Connect with other developers, ask questions, and share your experience.</p>
    
    <div class="section">
        <h2>Quick Actions</h2>
        <button onclick="openForum()">📚 Open Community Forum</button>
        <button onclick="openDiscussions()">💬 Browse Discussions</button>
        <button onclick="openSupport()">🆘 Get Support</button>
    </div>
    
    <div class="section">
        <h2>Search Forum</h2>
        <input type="text" id="searchInput" placeholder="Search for topics...">
        <button onclick="searchForum()">🔍 Search</button>
    </div>
    
    <div class="section">
        <h2>Popular Topics</h2>
        <button onclick="openTopic('getting-started')">🚀 Getting Started</button>
        <button onclick="openTopic('migrations')">🔧 Migrations</button>
        <button onclick="openTopic('troubleshooting')">🐛 Troubleshooting</button>
        <button onclick="openTopic('feature-requests')">💡 Feature Requests</button>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        function openForum() {
            vscode.postMessage({ command: 'openForum' });
        }
        function openDiscussions() {
            vscode.postMessage({ command: 'openForum' });
        }
        function openSupport() {
            vscode.postMessage({ command: 'openForum' });
        }
        function searchForum() {
            const query = document.getElementById('searchInput').value;
            if (query) {
                vscode.postMessage({ command: 'searchForum', query });
            }
        }
        function openTopic(topicId) {
            vscode.postMessage({ command: 'openTopic', topicId });
        }
    </script>
</body>
</html>`;
  }
}

