import * as vscode from 'vscode';
import { DevSyncDiagnostics } from './diagnostics';
import { DevSyncApiClient } from './api';
import { DevSyncCommands } from './commands';
import { DevSyncCodeActions, applyFix } from './codeActions';
import { DevSyncSidebarProvider } from './sidebarProvider';
import { CliRunner } from './cliRunner';
import { SidebarCommands } from './sidebarCommands';
import { AuthManager } from './auth';
import { ChatApiClient } from './apiClient';
import { ChatPanelManager } from './chatPanelManager';
import { ChatViewProvider } from './chatViewProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('DevSync extension is now active!');

  // Initialize components
  const config = vscode.workspace.getConfiguration('devsync');
  const apiUrl = config.get<string>('apiUrl', 'http://localhost:3000');
  const apiKey = config.get<string>('apiKey', '');
  const projectId = config.get<string>('projectId', '');
  const analyzerUrl = config.get<string>('analyzerUrl', 'http://localhost:4000');

  const apiClient = new DevSyncApiClient(apiUrl, apiKey, projectId);

  // Create output channel for CLI commands
  const outputChannel = vscode.window.createOutputChannel('DevSync CLI');
  context.subscriptions.push(outputChannel);

  // Initialize CLI runner and sidebar
  const cliRunner = new CliRunner(outputChannel);
  const sidebarProvider = new DevSyncSidebarProvider(cliRunner);
  const sidebarCommands = new SidebarCommands(sidebarProvider, cliRunner);

  // Register tree data provider for sidebar
  const treeView = vscode.window.createTreeView('devsyncSidebar', {
    treeDataProvider: sidebarProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  const diagnostics = new DevSyncDiagnostics(apiClient, context);
  const commands = new DevSyncCommands(apiClient, diagnostics);
  const codeActions = new DevSyncCodeActions(apiClient, diagnostics);

  // Chat assistant setup
  const authManager = new AuthManager(context, analyzerUrl);
  const chatApiClient = new ChatApiClient(apiUrl, authManager);
  const chatManager = new ChatPanelManager(context, authManager, chatApiClient, cliRunner);
  chatManager.updateConfiguration({ apiUrl, projectId: projectId || undefined });
  const chatViewProvider = new ChatViewProvider(context, chatManager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatViewProvider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );

  // Register code action provider
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    [
      { scheme: 'file', language: 'prisma' },
      { scheme: 'file', language: 'typescript' },
      { scheme: 'file', language: 'javascript' },
    ],
    codeActions,
    {
      providedCodeActionKinds: [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.Empty,
      ],
    }
  );

  // Register commands
  const scanCommand = vscode.commands.registerCommand('devsync.scan', commands.scan.bind(commands));
  const generateMigrationCommand = vscode.commands.registerCommand(
    'devsync.generateMigration',
    commands.generateMigration.bind(commands)
  );
  const viewReportCommand = vscode.commands.registerCommand(
    'devsync.viewReport',
    commands.viewReport.bind(commands)
  );
  const openDashboardCommand = vscode.commands.registerCommand(
    'devsync.openDashboard',
    commands.openDashboard.bind(commands)
  );
  const applyFixCommand = vscode.commands.registerCommand(
    'devsync.applyFix',
    (document, diagnostic, suggestedFix) => applyFix(document, diagnostic, suggestedFix)
  );

  // Register sidebar commands
  const sidebarScanCommand = vscode.commands.registerCommand(
    'devsync.sidebar.scan',
    () => sidebarCommands.scan()
  );
  const sidebarMigrateCommand = vscode.commands.registerCommand(
    'devsync.sidebar.migrate',
    () => sidebarCommands.migrate()
  );
  const sidebarInitCommand = vscode.commands.registerCommand(
    'devsync.sidebar.init',
    () => sidebarCommands.init()
  );
  const sidebarShowOutputCommand = vscode.commands.registerCommand(
    'devsync.sidebar.showOutput',
    () => sidebarCommands.showOutput()
  );
  const sidebarViewFixCommand = vscode.commands.registerCommand(
    'devsync.sidebar.viewFix',
    (mismatch) => sidebarCommands.viewFix(mismatch)
  );
  const sidebarOpenConfigCommand = vscode.commands.registerCommand(
    'devsync.sidebar.openConfig',
    () => sidebarCommands.openConfig()
  );
  const sidebarRefreshCommand = vscode.commands.registerCommand(
    'devsync.sidebar.refresh',
    () => sidebarProvider.refresh()
  );
  const focusChatCommand = vscode.commands.registerCommand('devsync.chat.focus', () => chatManager.focus());
  const newConversationCommand = vscode.commands.registerCommand('devsync.chat.newConversation', () =>
    chatManager.newConversation()
  );
  const chatLoginCommand = vscode.commands.registerCommand('devsync.chat.login', () => chatManager.showLoginFlow());
  const chatLogoutCommand = vscode.commands.registerCommand('devsync.chat.logout', () => chatManager.logout());

  context.subscriptions.push(
    codeActionProvider,
    scanCommand,
    generateMigrationCommand,
    viewReportCommand,
    openDashboardCommand,
    applyFixCommand,
    sidebarScanCommand,
    sidebarMigrateCommand,
    sidebarInitCommand,
    sidebarShowOutputCommand,
    sidebarViewFixCommand,
    sidebarOpenConfigCommand,
    sidebarRefreshCommand,
    focusChatCommand,
    newConversationCommand,
    chatLoginCommand,
    chatLogoutCommand
  );

  // Auto-scan on file save (if enabled)
  if (config.get<boolean>('autoScan', false)) {
    const watcher = vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (document.languageId === 'prisma' || document.fileName.endsWith('schema.prisma')) {
        await commands.scan();
      }
    });
    context.subscriptions.push(watcher);
  }

  // Initial diagnostics check
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    diagnostics.checkWorkspace(workspaceFolders[0]);
  }

  const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (!event.affectsConfiguration('devsync')) {
      return;
    }

    const updated = vscode.workspace.getConfiguration('devsync');
    const updatedApiUrl = updated.get<string>('apiUrl', apiUrl);
    const updatedProjectId = updated.get<string>('projectId', projectId);
    const updatedAnalyzerUrl = updated.get<string>('analyzerUrl', analyzerUrl);

    authManager.setAnalyzerUrl(updatedAnalyzerUrl);
    chatApiClient.setApiUrl(updatedApiUrl);
    chatManager.updateConfiguration({ apiUrl: updatedApiUrl, projectId: updatedProjectId || undefined });
  });
  context.subscriptions.push(configListener);
}

export function deactivate() {
  console.log('DevSync extension is now deactivated!');
}

