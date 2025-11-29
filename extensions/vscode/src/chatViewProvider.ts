import * as vscode from 'vscode';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ChatPanelManager } from './chatPanelManager';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'devsyncChat';

  constructor(private readonly context: vscode.ExtensionContext, private readonly manager: ChatPanelManager) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    const htmlResolver = () => this.getHtml(webviewView.webview);
    this.manager.attachWebview(webviewView, htmlResolver);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = generateNonce();
    const cspSource = webview.cspSource;
    
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'webview'),
        vscode.Uri.joinPath(this.context.extensionUri, 'node_modules'),
      ],
      enableCommandUris: false,
    };

    const resources = {
      chatCss: this.getResourceUri(webview, 'webview', 'chat.css'),
      chatJs: this.getResourceUri(webview, 'webview', 'chat.js'),
      react: this.getResourceUri(webview, 'node_modules', 'react', 'umd', 'react.production.min.js'),
      reactDom: this.getResourceUri(webview, 'node_modules', 'react-dom', 'umd', 'react-dom.production.min.js'),
      marked: this.getResourceUri(webview, 'node_modules', 'marked', 'marked.min.js'),
      dompurify: this.getResourceUri(webview, 'node_modules', 'dompurify', 'dist', 'purify.min.js'),
      prism: this.getResourceUri(webview, 'node_modules', 'prismjs', 'prism.js'),
      prismCss: this.getResourceUri(webview, 'node_modules', 'prismjs', 'themes', 'prism-okaidia.css'),
    };

    const templatePath = join(this.context.extensionUri.fsPath, 'webview', 'chat.html');
    const rawHtml = readFileSync(templatePath, 'utf-8');

    return rawHtml
      .replace(/{{nonce}}/g, nonce)
      .replace(/{{cspSource}}/g, webview.cspSource)
      .replace(/{{styleUri}}/g, resources.chatCss)
      .replace(/{{scriptUri}}/g, resources.chatJs)
      .replace(/{{reactUri}}/g, resources.react)
      .replace(/{{reactDomUri}}/g, resources.reactDom)
      .replace(/{{markedUri}}/g, resources.marked)
      .replace(/{{dompurifyUri}}/g, resources.dompurify)
      .replace(/{{prismJsUri}}/g, resources.prism)
      .replace(/{{prismCssUri}}/g, resources.prismCss);
  }

  private getResourceUri(webview: vscode.Webview, ...pathSegments: string[]) {
    const uri = vscode.Uri.joinPath(this.context.extensionUri, ...pathSegments);
    return webview.asWebviewUri(uri).toString();
  }
}

function generateNonce(): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 })
    .map(() => possible.charAt(Math.floor(Math.random() * possible.length)))
    .join('');
}


