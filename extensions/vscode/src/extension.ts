import * as vscode from 'vscode';
import { DevSyncDiagnostics } from './diagnostics';
import { DevSyncApiClient } from './api';
import { DevSyncCommands } from './commands';
import { DevSyncCodeActions, applyFix } from './codeActions';

export function activate(context: vscode.ExtensionContext) {
  console.log('DevSync extension is now active!');

  // Initialize components
  const config = vscode.workspace.getConfiguration('devsync');
  const apiClient = new DevSyncApiClient(
    config.get<string>('apiUrl', 'http://localhost:3000'),
    config.get<string>('apiKey', ''),
    config.get<string>('projectId', '')
  );

  const diagnostics = new DevSyncDiagnostics(apiClient, context);
  const commands = new DevSyncCommands(apiClient, diagnostics);
  const codeActions = new DevSyncCodeActions(apiClient, diagnostics);

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

  context.subscriptions.push(
    codeActionProvider,
    scanCommand,
    generateMigrationCommand,
    viewReportCommand,
    openDashboardCommand,
    applyFixCommand
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
}

export function deactivate() {
  console.log('DevSync extension is now deactivated!');
}

