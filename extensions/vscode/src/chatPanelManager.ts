import * as vscode from 'vscode';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { AuthManager, type AuthFlowUpdate } from './auth';
import { ChatApiClient } from './apiClient';
import { CliRunner, type CliRunHooks } from './cliRunner';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from './messaging';
import type {
  AiQueryResult,
  AuthSessionState,
  ChatCliCommand,
  ChatMessage,
  ChatMessageStatus,
  ChatViewConfig,
} from './types';

const MESSAGE_STORE_KEY = 'devsync.chat.messages';
const MAX_MESSAGES = 50;

interface ActiveTask {
  type: 'ai' | 'cli';
  messageId?: string;
}

export class ChatPanelManager {
  private view?: vscode.WebviewView;
  private readonly messages: ChatMessage[] = [];
  private viewReady = false;
  private activeTask?: ActiveTask;
  private chatAbortController?: AbortController;
  private cliCancellation?: vscode.CancellationTokenSource;
  private config: ChatViewConfig;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly auth: AuthManager,
    private readonly api: ChatApiClient,
    private readonly cliRunner: CliRunner
  ) {
    this.config = {
      apiUrl: '',
      projectId: undefined,
    };

    this.restoreMessages();

    this.auth.onDidChangeSession((session) => {
      this.postMessage({ type: 'session', payload: session });
    });
  }

  attachWebview(view: vscode.WebviewView, resolveHtml: () => string) {
    this.view = view;
    this.viewReady = false;

    view.webview.options = {
      ...view.webview.options,
      enableScripts: true,
    };
    view.webview.html = resolveHtml();

    view.onDidDispose(() => {
      if (this.view === view) {
        this.view = undefined;
        this.viewReady = false;
      }
    });

    view.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      this.handleMessage(message).catch((error) => {
        this.sendError(error instanceof Error ? error.message : String(error));
      });
    });
  }

  updateConfiguration(config: ChatViewConfig) {
    this.config = config;
    this.api.setApiUrl(config.apiUrl);
    if (this.viewReady) {
      this.sendInitialState();
    }
  }

  focus() {
    this.view?.show?.(true);
  }

  async showLoginFlow() {
    try {
      await this.startLoginFlow();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.sendError(message);
    }
  }

  async logout() {
    await this.auth.logout();
    this.sendInfo('Signed out of DevSync.');
  }

  async newConversation() {
    this.messages.length = 0;
    await this.persistMessages();
    if (this.viewReady) {
      this.sendInitialState();
    }
  }

  private async handleMessage(message: WebviewToExtensionMessage) {
    switch (message.type) {
      case 'ready':
        this.viewReady = true;
        this.sendInitialState();
        return;
      case 'userMessage':
        await this.handleUserMessage(message.content, message.messageId);
        return;
      case 'stop':
        this.stopActiveTask();
        return;
      case 'retry':
        await this.retryMessage(message.messageId);
        return;
      case 'runCommand':
        await this.handleRunCommand(message.command, message.requestId);
        return;
      case 'openFile':
        await this.openFile(message.path);
        return;
      case 'openUrl':
        await vscode.env.openExternal(vscode.Uri.parse(message.url));
        return;
      case 'insertCode':
        await this.insertCode(message.code);
        return;
      case 'requestLogin':
        await this.startLoginFlow();
        return;
      case 'requestLogout':
        await this.logout();
        return;
      case 'newConversation':
        await this.newConversation();
        return;
      default:
        this.sendError('Unknown message from chat panel.');
    }
  }

  private async handleUserMessage(content: string, messageId: string) {
    const trimmed = content.trim();
    if (!trimmed) {
      this.sendError('Please enter a message.');
      return;
    }

    if (this.activeTask) {
      this.sendError('Please wait for the current response to finish.');
      return;
    }

    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
      status: 'complete',
    };

    this.appendMessage(userMessage);
    await this.persistMessages();

    await this.sendAssistantResponse(trimmed);
  }

  private async retryMessage(messageId: string) {
    const original = this.messages.find((m) => m.id === messageId && m.role === 'user');
    if (!original) {
      this.sendError('Unable to retry this message.');
      return;
    }
    await this.handleUserMessage(original.content, generateId());
  }

  private async sendAssistantResponse(query: string) {
    const session = this.auth.getSession();
    if (session.status !== 'authenticated') {
      this.sendError('Sign in to DevSync to use chat.');
      return;
    }

    const projectId = this.config.projectId;
    if (!projectId) {
      this.sendError('Configure devsync.projectId in settings to use chat.');
      return;
    }

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      status: 'streaming',
      metadata: { projectId },
    };

    this.appendMessage(assistantMessage);
    this.postMessage({ type: 'aiResponseStart', payload: { message: assistantMessage } });

    const controller = new AbortController();
    this.chatAbortController = controller;
    this.activeTask = { type: 'ai', messageId: assistantMessage.id };

    try {
      const scan = await this.api.getLatestScanReport(projectId);
      if (!scan) {
        throw new Error('No scan reports found. Run a DevSync scan first.');
      }

      assistantMessage.metadata = {
        projectId,
        scanReportId: scan.id,
      };
      await this.persistMessages();

      const result = await this.api.queryAI(query, scan.id, controller.signal);
      await this.streamAssistantAnswer(assistantMessage.id, result);
      this.finalizeAssistantMessage(assistantMessage.id, 'complete');
    } catch (error) {
      if (error instanceof Error && error.message === 'Request cancelled.') {
        this.finalizeAssistantMessage(assistantMessage.id, 'cancelled');
      } else {
        this.finalizeAssistantMessage(
          assistantMessage.id,
          'error',
          error instanceof Error ? error.message : String(error)
        );
      }
    } finally {
      this.activeTask = undefined;
      this.chatAbortController = undefined;
    }
  }

  private async streamAssistantAnswer(messageId: string, result: AiQueryResult) {
    const chunkSize = Math.max(40, Math.ceil(result.answer.length / 50));

    for (let index = 0; index < result.answer.length; index += chunkSize) {
      if (!this.activeTask || this.activeTask.type !== 'ai') {
        break;
      }

      const chunk = result.answer.slice(index, index + chunkSize);
      this.appendChunk(messageId, chunk, 'aiResponseChunk');
      await delay(30);
    }
  }

  private async handleRunCommand(command: ChatCliCommand, requestId: string) {
    if (this.activeTask) {
      this.sendError('Another operation is already running.');
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this.sendError('Open a workspace folder before running DevSync commands.');
      return;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;

    let options: Record<string, any> = {};
    try {
      options = this.buildCliOptions(command, workspaceRoot);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.sendError(message);
      return;
    }

    const systemMessage: ChatMessage = {
      id: requestId,
      role: 'system',
      content: `Running devsync ${command}...\n`,
      createdAt: Date.now(),
      status: 'streaming',
      metadata: { command },
    };
    this.appendMessage(systemMessage);
    this.postMessage({ type: 'messageUpdate', payload: { message: systemMessage } });

    const cancellation = new vscode.CancellationTokenSource();
    this.cliCancellation = cancellation;
    this.activeTask = { type: 'cli', messageId: systemMessage.id };

    const hooks: CliRunHooks = {
      onStdout: (chunk) => this.appendChunk(systemMessage.id, chunk, 'messageUpdate'),
      onStderr: (chunk) => this.appendChunk(systemMessage.id, chunk, 'messageUpdate'),
      onClose: (code) => {
        const status: ChatMessageStatus = code === 0 ? 'complete' : 'error';
        const error = code === 0 ? undefined : `Command exited with code ${code ?? -1}`;
        this.finalizeCliMessage(systemMessage.id, status, error);
      },
    };

    try {
      await this.cliRunner.executeCliCommand(command, options, cancellation.token, hooks);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.appendChunk(systemMessage.id, `\n${message}\n`, 'messageUpdate');
      this.finalizeCliMessage(systemMessage.id, 'error', message);
    } finally {
      this.activeTask = undefined;
      this.cliCancellation = undefined;
    }
  }

  private finalizeAssistantMessage(messageId: string, status: ChatMessageStatus, error?: string) {
    const message = this.messages.find((m) => m.id === messageId);
    if (!message) {
      return;
    }

    message.status = status;
    message.error = error;
    this.postMessage({ type: 'aiResponseEnd', payload: { messageId, status, error } });
    void this.persistMessages();
  }

  private finalizeCliMessage(messageId: string, status: ChatMessageStatus, error?: string) {
    const message = this.messages.find((m) => m.id === messageId);
    if (!message) {
      return;
    }
    message.status = status;
    message.error = error;
    this.postMessage({ type: 'messageUpdate', payload: { message } });
    void this.persistMessages();
  }

  private appendChunk(messageId: string, chunk: string, event: 'aiResponseChunk' | 'messageUpdate') {
    const message = this.messages.find((m) => m.id === messageId);
    if (!message) {
      return;
    }
    message.content += chunk;
    if (event === 'aiResponseChunk') {
      this.postMessage({ type: 'aiResponseChunk', payload: { messageId, chunk } });
    } else {
      this.postMessage({ type: 'messageUpdate', payload: { message } });
    }
  }

  private async openFile(pathOrRelative: string) {
    if (!pathOrRelative) {
      return;
    }

    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(pathOrRelative));
      await vscode.window.showTextDocument(doc);
      this.sendInfo(`Opened ${pathOrRelative}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.sendError(`Unable to open file: ${message}`);
    }
  }

  private async insertCode(code: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.sendError('Open a text editor to insert code.');
      return;
    }

    await editor.edit((builder) => builder.replace(editor.selection, code));
    this.sendInfo('Inserted code snippet.');
  }

  private stopActiveTask() {
    if (!this.activeTask) {
      return;
    }

    if (this.activeTask.type === 'ai') {
      this.chatAbortController?.abort();
      if (this.activeTask.messageId) {
        this.finalizeAssistantMessage(this.activeTask.messageId, 'cancelled');
      }
    }

    if (this.activeTask.type === 'cli') {
      this.cliCancellation?.cancel();
      if (this.activeTask.messageId) {
        this.finalizeCliMessage(this.activeTask.messageId, 'cancelled');
      }
    }

    this.activeTask = undefined;
  }

  private async startLoginFlow() {
    const update = (payload: AuthFlowUpdate) => {
      this.postMessage({ type: 'authFlow', payload });
    };
    await this.auth.startDeviceFlow(update);
  }

  private sendInitialState() {
    if (!this.viewReady) {
      return;
    }
    const payload: ExtensionToWebviewMessage = {
      type: 'init',
      payload: {
        messages: this.messages,
        session: this.auth.getSession(),
        config: this.config,
      },
    };
    this.postMessage(payload);
  }

  private appendMessage(message: ChatMessage) {
    this.messages.push(message);
    if (this.messages.length > MAX_MESSAGES) {
      this.messages.splice(0, this.messages.length - MAX_MESSAGES);
    }
    if (this.viewReady) {
      this.postMessage({ type: 'messageUpdate', payload: { message } });
    }
  }

  private async persistMessages() {
    await this.context.workspaceState.update(MESSAGE_STORE_KEY, this.messages);
  }

  private restoreMessages() {
    const stored = this.context.workspaceState.get<ChatMessage[]>(MESSAGE_STORE_KEY);
    if (stored && Array.isArray(stored)) {
      this.messages.push(...stored.slice(-MAX_MESSAGES));
    }
  }

  private sendInfo(message: string) {
    this.postMessage({ type: 'info', payload: { message } });
  }

  private sendError(message: string) {
    this.postMessage({ type: 'error', payload: { message } });
  }

  private postMessage(message: ExtensionToWebviewMessage) {
    this.view?.webview.postMessage(message).then(
      undefined,
      () => {
        // Ignored
      }
    );
  }

  private buildCliOptions(command: ChatCliCommand, workspaceRoot: string): Record<string, any> {
    const config = vscode.workspace.getConfiguration('devsync');
    const options: Record<string, any> = {
      path: workspaceRoot,
    };

    if (command === 'scan') {
      const db = config.get<string>('databaseConnection', '');
      if (db) {
        options.db = db;
      }

      if (config.get<boolean>('aiAnalysis', false)) {
        options.aiAnalysis = true;
        const useOllama = config.get<boolean>('useOllama', false);
        if (useOllama) {
          options.useOllama = true;
          const ollamaModel = config.get<string>('ollamaModel', '');
          const ollamaUrl = config.get<string>('ollamaUrl', '');
          if (ollamaModel) {
            options.ollamaModel = ollamaModel;
          }
          if (ollamaUrl) {
            options.ollamaUrl = ollamaUrl;
          }
        } else {
          const openaiKey = config.get<string>('openaiApiKey', '');
          if (openaiKey) {
            options.openaiApiKey = openaiKey;
          }
        }
      }

      const scanResultsPath = join(workspaceRoot, '.devsync', 'scan-results.json');
      options.output = scanResultsPath;
    }

    if (command === 'migrate') {
      const db = config.get<string>('databaseConnection', '');
      if (!db) {
        throw new Error('Set devsync.databaseConnection before running migrations.');
      }
      options.db = db;

      const migrationsDir = join(workspaceRoot, '.devsync', 'migrations');
      if (!existsSync(migrationsDir)) {
        mkdirSync(migrationsDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      options.output = join(migrationsDir, `migration_${timestamp}.sql`);
      options.format = 'sql';
    }

    return options;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateId(): string {
  try {
    return randomUUID();
  } catch {
    return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }
}


