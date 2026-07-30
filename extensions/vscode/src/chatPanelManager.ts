import * as vscode from 'vscode';
import { join } from 'path';
import type { AuthFlowUpdate } from './auth';
import type { CliRunHooks } from './cliRunner';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from './messaging';
import type {
  AiQueryResult,
  AuthSessionState,
  ChatCliCommand,
  ChatMessage,
  ChatMessageStatus,
  ChatViewConfig,
} from './types';
import { IAuthManager, IChatApiClient, ICliRunner } from './interfaces';
import { PluginRegistry, IAiProviderPlugin } from './plugins';
import { EnhancedChatManager } from './chat/enhancedManager';
import { CodeBlockActions } from './chat/codeBlockActions';
import { ErrorRecovery } from './chat/errorRecovery';
import { EditorService } from './ui/editor';

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

  private aiProvider?: IAiProviderPlugin;
  private enhancedManager?: EnhancedChatManager;
  private codeBlockActions?: CodeBlockActions;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly auth: IAuthManager,
    private readonly api: IChatApiClient,
    private readonly cliRunner: ICliRunner,
    private readonly pluginRegistry?: PluginRegistry
  ) {
    // Initialize enhanced features
    this.enhancedManager = new EnhancedChatManager(context, this);
    const editorService = new EditorService();
    this.codeBlockActions = new CodeBlockActions(editorService);
    this.config = {
      apiUrl: '',
      analyzerUrl: 'https://dev-sync.dev',
      projectId: undefined,
    };

    this.restoreMessages();

    this.auth.onDidChangeSession((session) => {
      this.postMessage({ type: 'session', payload: session });
    });

    // Get default AI provider from plugin registry if available
    // This is done lazily - provider will be retrieved when first needed
    // to avoid blocking initialization
    if (this.pluginRegistry) {
      // Try to get provider immediately, but it's OK if not ready yet
      // (will be retrieved again when needed)
      this.aiProvider = this.pluginRegistry.getDefaultAiProvider();
    }
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
    this.sendInfo('Signed out of Dev-Sync.');
  }

  async newConversation() {
    if (this.enhancedManager) {
      const conversationId = this.enhancedManager.createConversation();
      this.messages.length = 0;
      await this.persistMessages();
      if (this.viewReady) {
        this.sendInitialState();
        this.sendConversationsUpdate();
      }
    } else {
      this.messages.length = 0;
      await this.persistMessages();
      if (this.viewReady) {
        this.sendInitialState();
      }
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
      case 'openUrl': {
        const url = message.url?.trim();
        if (!url || url.includes('undefined') || url.includes('null/')) {
          this.sendError(
            'Invalid verification URL. Set "devsync.analyzerUrl" to your dashboard (e.g. https://dev-sync.dev) and run login again.'
          );
          return;
        }
        try {
          const parsed = new URL(url);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('URL must use http or https');
          }
          await vscode.env.openExternal(vscode.Uri.parse(parsed.toString()));
        } catch {
          this.sendError(`Could not open verification URL: ${url}`);
        }
        return;
      }
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
      case 'runCode':
        if (this.codeBlockActions) {
          await this.codeBlockActions.runCode(message.code, message.language);
        }
        return;
      case 'applyCode':
        if (this.codeBlockActions) {
          await this.codeBlockActions.applyToFile(message.code, message.language);
        }
        return;
      case 'showDiff':
        if (this.codeBlockActions) {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            await this.codeBlockActions.showDiff(editor.document, message.code);
          }
        }
        return;
      case 'exportConversation':
        if (this.enhancedManager) {
          const conversationId = this.enhancedManager.getCurrentConversationId();
          if (conversationId) {
            const exported = this.enhancedManager.exportConversation(conversationId, message.format);
            if (exported) {
              await this.saveExportedConversation(exported, message.format);
            }
          }
        }
        return;
      case 'searchConversations':
        if (this.enhancedManager) {
          const results = this.enhancedManager.searchConversations(message.query);
          this.postMessage({ type: 'searchResults', payload: { results, query: message.query } });
        }
        return;
      case 'createBranch':
        if (this.enhancedManager) {
          const branchId = this.enhancedManager.createBranch(message.messageId);
          if (branchId) {
            this.sendInfo(`Created branch: ${branchId}`);
          }
        }
        return;
      case 'switchConversation':
        if (this.enhancedManager) {
          const switched = this.enhancedManager.switchConversation(message.conversationId);
          if (switched) {
            this.sendInitialState();
            this.sendConversationsUpdate();
          }
        }
        return;
      case 'switchBranch':
        if (this.enhancedManager) {
          const switched = this.enhancedManager.switchBranch(message.branchId);
          if (switched) {
            this.sendInitialState();
          }
        }
        return;
      case 'deleteConversation':
        if (this.enhancedManager) {
          const deleted = this.enhancedManager.deleteConversation(message.conversationId);
          if (deleted) {
            this.sendConversationsUpdate();
          }
        }
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
    
    // Notify enhanced manager
    if (this.enhancedManager) {
      this.enhancedManager.onMessageAdded(userMessage);
    }
    
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
      this.sendError('Sign in to Dev-Sync to use chat.');
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
        throw new Error('No scan reports found. Run a Dev-Sync scan first.');
      }

      assistantMessage.metadata = {
        projectId,
        scanReportId: scan.id,
      };
      await this.persistMessages();

      // Use AI provider plugin if available, otherwise fall back to API client
      // Try to get provider if not already cached (handles lazy initialization)
      if (!this.aiProvider && this.pluginRegistry) {
        this.aiProvider = this.pluginRegistry.getDefaultAiProvider();
      }

      // Show AI model info in chat
      const config = vscode.workspace.getConfiguration('devsync');
      const provider = (config.get<string>('ai.provider', 'puter') || 'puter') as any;
      const { getModelInfo } = await import('./utils/aiModelInfo');
      const modelInfo = getModelInfo(provider);
      
      // Log model info to output channel (only show once per session)
      if (!this.view?.visible) {
        const outputChannel = vscode.window.createOutputChannel('Dev-Sync Chat');
        outputChannel.appendLine(`🤖 AI Model: ${modelInfo.displayName} (${modelInfo.provider})`);
      }
      
      // Add model info to assistant message metadata
      assistantMessage.metadata = {
        ...assistantMessage.metadata,
        aiModel: modelInfo.displayName,
        aiProvider: modelInfo.provider
      };
      
      let result: AiQueryResult;
      if (this.aiProvider) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        result = await this.aiProvider.query(
          query,
          {
            scanReportId: scan.id,
            projectId,
            workspaceFolder,
          },
          controller.signal
        );
      } else {
        // Fallback to direct API call
        result = await this.api.queryAI(query, scan.id, controller.signal);
      }
      
      // Add model info to result metadata
      if (!result.metadata) {
        result.metadata = {};
      }
      result.metadata.aiModel = modelInfo.displayName;
      result.metadata.aiProvider = modelInfo.provider;
      await this.streamAssistantAnswer(assistantMessage.id, result);
      this.finalizeAssistantMessage(assistantMessage.id, 'complete');
    } catch (error) {
      if (error instanceof Error && error.message === 'Request cancelled.') {
        this.finalizeAssistantMessage(assistantMessage.id, 'cancelled');
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.finalizeAssistantMessage(assistantMessage.id, 'error', errorMessage);
        
        // Show enhanced error recovery
        if (this.enhancedManager) {
          const errorForRecovery: Error | string = error instanceof Error ? error : errorMessage;
          await ErrorRecovery.showErrorWithRetry({
            message: 'Failed to get AI response',
            error: errorForRecovery,
            messageId: assistantMessage.id,
            retryAction: async () => {
              await this.retryMessage(assistantMessage.id);
            },
            alternativeActions: ErrorRecovery.getRecoverySuggestions(errorForRecovery),
          });
        }
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
      this.sendError('Open a workspace folder before running Dev-Sync commands.');
      return;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;

    let options: Record<string, any> = {};
    try {
      options = await this.buildCliOptions(command, workspaceRoot);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.sendError(message);
      return;
    }

    const systemMessage: ChatMessage = {
      id: requestId,
      role: 'system',
      content: `🔍 Running devsync ${command}...\n\n`,
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
      onStdout: (chunk) => {
        // Append chunk immediately for real-time display
        this.appendChunk(systemMessage.id, chunk, 'messageUpdate');
      },
      onStderr: (chunk) => {
        // Append stderr chunks as well for complete output
        this.appendChunk(systemMessage.id, chunk, 'messageUpdate');
      },
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
    
    // Send enhanced features data
    if (this.enhancedManager) {
      this.sendConversationsUpdate();
      this.sendSuggestedPrompts();
    }
  }

  /**
   * Sends conversations update to webview.
   */
  private sendConversationsUpdate(): void {
    if (!this.enhancedManager || !this.viewReady) {
      return;
    }
    
    const conversations = this.enhancedManager.getAllConversations();
    const currentId = this.enhancedManager.getCurrentConversationId();
    
    this.postMessage({
      type: 'conversations',
      payload: { conversations, currentId },
    });
  }

  /**
   * Sends suggested prompts to webview.
   */
  private sendSuggestedPrompts(): void {
    if (!this.enhancedManager || !this.viewReady) {
      return;
    }
    
    const prompts = this.enhancedManager.getSuggestedPrompts();
    this.postMessage({
      type: 'suggestedPrompts',
      payload: { prompts },
    });
  }

  /**
   * Saves exported conversation to a file.
   */
  private async saveExportedConversation(content: string, format: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const extension = format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt';
    const fileName = `conversation-${Date.now()}.${extension}`;
    
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.joinPath(workspaceFolders[0].uri, fileName),
      filters: {
        'Text Files': ['txt'],
        'Markdown': ['md'],
        'JSON': ['json'],
      },
    });

    if (uri) {
      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
      vscode.window.showInformationMessage(`Conversation exported to ${uri.fsPath}`);
    }
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

  private async buildCliOptions(command: ChatCliCommand, workspaceRoot: string): Promise<Record<string, any>> {
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
        const aiProvider = config.get<string>('ai.provider', 'puter');
        const useOllama = config.get<boolean>('useOllama', false);
        const useDeepSeek = config.get<boolean>('useDeepSeek', false) || aiProvider === 'deepseek';
        
        if (useOllama || aiProvider === 'ollama') {
          options.useOllama = true;
          const ollamaModel = config.get<string>('ollamaModel', '');
          const ollamaUrl = config.get<string>('ollamaUrl', '');
          if (ollamaModel) {
            options.ollamaModel = ollamaModel;
          }
          if (ollamaUrl) {
            options.ollamaUrl = ollamaUrl;
          }
        } else if (useDeepSeek || aiProvider === 'deepseek') {
          options.useDeepSeek = true;
          const deepseekKey = config.get<string>('deepseekApiKey', '');
          const deepseekModel = config.get<string>('deepseekModel', '');
          const deepseekUrl = config.get<string>('deepseekUrl', '');
          if (deepseekKey) {
            options.deepseekApiKey = deepseekKey;
          }
          if (deepseekModel) {
            options.deepseekModel = deepseekModel;
          }
          if (deepseekUrl) {
            options.deepseekUrl = deepseekUrl;
          }
        } else {
          const openaiKey = config.get<string>('openaiApiKey', '');
          if (openaiKey) {
            options.openaiApiKey = openaiKey;
          }
        }
      }

      const { getScanResultsPath } = await import('./utils/paths');
      const workspaceFolder = { uri: { fsPath: workspaceRoot } } as vscode.WorkspaceFolder;
      options.output = getScanResultsPath(workspaceFolder);
    }

    if (command === 'migrate') {
      const db = config.get<string>('databaseConnection', '');
      if (!db) {
        throw new Error('Set devsync.databaseConnection before running migrations.');
      }
      options.db = db;

      const { ensureMigrationsDir } = await import('./utils/paths');
      const { generateMigrationFilename } = await import('./utils/id');
      const workspaceFolder = { uri: { fsPath: workspaceRoot } } as vscode.WorkspaceFolder;
      const migrationsDir = ensureMigrationsDir(workspaceFolder);
      options.output = join(migrationsDir, generateMigrationFilename('sql'));
      options.format = 'sql';
    }

    return options;
  }
}

import { delay, generateId } from './utils';


