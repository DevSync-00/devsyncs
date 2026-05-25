/**
 * FAQ (Frequently Asked Questions) system.
 * 
 * Provides a searchable FAQ section with common questions and answers.
 */

import * as vscode from 'vscode';
import { HelpContent } from './content';

/**
 * FAQ item.
 */
export interface FAQItem {
  /** Question */
  question: string;
  /** Answer (markdown) */
  answer: string;
  /** Tags for categorization */
  tags: string[];
  /** Related documentation link */
  docLink?: string;
}

/**
 * FAQ manager.
 */
export class FAQManager {
  private static faqItems: FAQItem[] = [];

  /**
   * Registers FAQ items.
   */
  static registerFAQ(items: FAQItem[]): void {
    this.faqItems.push(...items);
  }

  /**
   * Shows FAQ panel.
   */
  static async showFAQ(context: vscode.ExtensionContext, searchQuery?: string): Promise<void> {
    const filteredItems = searchQuery
      ? this.searchFAQ(searchQuery)
      : this.faqItems;

    // Create quick pick for FAQ items
    const items = filteredItems.map((item) => ({
      label: item.question,
      description: item.tags.join(', '),
      detail: item.answer.substring(0, 100) + '...',
      item,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Search FAQ or select a question',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (selected) {
      await this.showFAQAnswer(context, selected.item);
    }
  }

  /**
   * Shows FAQ answer in a panel.
   */
  private static async showFAQAnswer(
    context: vscode.ExtensionContext,
    item: FAQItem
  ): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'devsyncFAQ',
      item.question,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = this.getFAQContent(item);

    panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.command === 'openDoc' && item.docLink) {
          vscode.env.openExternal(vscode.Uri.parse(item.docLink));
        }
      },
      undefined,
      context.subscriptions
    );
  }

  /**
   * Searches FAQ items.
   */
  static searchFAQ(query: string): FAQItem[] {
    const queryLower = query.toLowerCase();
    return this.faqItems.filter(
      (item) =>
        item.question.toLowerCase().includes(queryLower) ||
        item.answer.toLowerCase().includes(queryLower) ||
        item.tags.some((tag) => tag.toLowerCase().includes(queryLower))
    );
  }

  /**
   * Gets FAQ content HTML.
   */
  private static getFAQContent(item: FAQItem): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${item.question}</title>
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
        .tags {
            margin: 10px 0;
        }
        .tag {
            display: inline-block;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 3px;
            margin-right: 5px;
            font-size: 12px;
        }
        .answer {
            margin-top: 20px;
            line-height: 1.6;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            margin-top: 20px;
            cursor: pointer;
            border-radius: 3px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <h1>${item.question}</h1>
    <div class="tags">
        ${item.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
    </div>
    <div class="answer">${this.markdownToHtml(item.answer)}</div>
    ${item.docLink ? `<button onclick="openDoc()">📚 Read Full Documentation</button>` : ''}
    <script>
        const vscode = acquireVsCodeApi();
        function openDoc() {
            vscode.postMessage({ command: 'openDoc' });
        }
    </script>
</body>
</html>`;
  }

  /**
   * Converts markdown to HTML (simplified).
   */
  private static markdownToHtml(markdown: string): string {
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

  /**
   * Initializes default FAQ items.
   */
  static initializeDefaultFAQ(): void {
    this.registerFAQ([
      {
        question: 'How do I scan my Prisma schema?',
        answer: 'You can scan your schema by clicking the "Scan Schema" button in the DevSync sidebar, or by using the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and selecting "DevSync: Scan Schema".',
        tags: ['scan', 'getting-started'],
        docLink: 'https://docs.Dev-Sync.dev/scanning',
      },
      {
        question: 'What types of mismatches can DevSync detect?',
        answer: 'DevSync can detect:\n- Missing tables\n- Missing fields\n- Type mismatches\n- Extra fields\n- Constraint mismatches',
        tags: ['mismatches', 'features'],
        docLink: 'https://docs.Dev-Sync.dev/mismatches',
      },
      {
        question: 'How do I generate a migration?',
        answer: 'After running a scan, click "Generate Migration" in the sidebar or use the command palette. DevSync will create SQL migration files based on the detected mismatches.',
        tags: ['migration', 'getting-started'],
        docLink: 'https://docs.Dev-Sync.dev/migrations',
      },
      {
        question: 'How do I configure DevSync?',
        answer: 'Open VS Code settings and search for "devsync". You can configure:\n- API URL\n- API Key\n- Project ID\n- Database connection string\n- Auto-scan on save',
        tags: ['configuration', 'setup'],
        docLink: 'https://docs.Dev-Sync.dev/configuration',
      },
      {
        question: 'What is the difference between error, warning, and info severity?',
        answer: '- **Error**: Critical issues that must be fixed (e.g., missing required fields)\n- **Warning**: Issues that should be addressed (e.g., type mismatches)\n- **Info**: Informational messages (e.g., optional fields)',
        tags: ['severity', 'mismatches'],
      },
    ]);
  }
}

