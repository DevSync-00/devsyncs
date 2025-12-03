import * as vscode from 'vscode';
import { DevSyncCodeActions, applyFix } from './codeActions';
import { DevSyncSidebarProvider } from './sidebarProvider';
import { SidebarCommands } from './sidebarCommands';
import { ChatPanelManager } from './chatPanelManager';
import { ChatViewProvider } from './chatViewProvider';
import { ContainerFactory } from './di/factory';
import {
  EnhancedCodeActions,
  BatchApplyManager,
  DiffViewManager,
  MigrationPreviewManager,
  SchemaComparisonManager,
  SchemaAnnotationManager,
  MigrationHistoryManager,
} from './editor';
import { EditorService } from './ui/editor';
import { Mismatch } from './api';
import {
  OnboardingWizard,
  PrismaSchemaDetector,
  DatabaseConnectionTester,
  QuickStartManager,
} from './onboarding';

/**
 * Activates the DevSync VS Code extension.
 * 
 * This is the main entry point called by VS Code when the extension is activated.
 * It initializes the dependency injection container, registers all commands,
 * sets up the sidebar, chat panel, and code actions, and configures event listeners.
 * 
 * @param context - VS Code extension context for managing subscriptions and state
 * 
 * @example
 * The extension is automatically activated when:
 * - A Prisma schema file is opened
 * - A DevSync command is invoked
 * - The extension is explicitly enabled
 * 
 * @see https://code.visualstudio.com/api/references/vscode-api#ExtensionContext
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('DevSync extension is now active!');

  // Initialize dependency injection container
  const container = ContainerFactory.create(context);
  context.subscriptions.push({ 
    dispose: async () => {
      await container.dispose();
    }
  });
  
  // Initialize plugin system
  const pluginRegistry = container.getPluginRegistry();

  // Get services from container
  const apiClient = container.getApiClient();
  const cliRunner = container.getCliRunner();
  const authManager = container.getAuthManager();
  const chatApiClient = container.getChatApiClient();
  const diagnostics = container.getDiagnostics();
  const commands = container.getCommands();
  const codeActions = container.getCodeActions();
  const config = container.getConfig();
  
  // Initialize enhanced editor features
  const editorService = new EditorService();
  const enhancedCodeActions = new EnhancedCodeActions(
    apiClient,
    diagnostics
  );
  const migrationPreview = new MigrationPreviewManager(editorService);
  const schemaComparison = new SchemaComparisonManager(editorService);
  const schemaAnnotations = new SchemaAnnotationManager();
  const migrationHistory = new MigrationHistoryManager(editorService);

  // Initialize sidebar with enhanced features
  const sidebarProvider = new DevSyncSidebarProvider(cliRunner, context);
  const sidebarCommands = new SidebarCommands(sidebarProvider, cliRunner);

  // Register tree data provider for sidebar
  const treeView = vscode.window.createTreeView('devsyncSidebar', {
    treeDataProvider: sidebarProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  // Chat assistant setup
  const chatManager = new ChatPanelManager(context, authManager, chatApiClient, cliRunner, pluginRegistry);
  chatManager.updateConfiguration({ apiUrl: config.apiUrl, projectId: config.projectId || undefined });
  const chatViewProvider = new ChatViewProvider(context, chatManager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatViewProvider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );

  // Register code action provider (enhanced)
  const codeActionProvider = vscode.languages.registerCodeActionsProvider(
    [
      { scheme: 'file', language: 'prisma' },
      { scheme: 'file', language: 'typescript' },
      { scheme: 'file', language: 'javascript' },
    ],
    enhancedCodeActions,
    {
      providedCodeActionKinds: [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.Empty,
      ],
    }
  );
  
  // Register schema annotations hover provider
  schemaAnnotations.registerHoverProvider(context);

  // Register plugin command handlers (before built-in commands)
  const pluginCommands = pluginRegistry.getAllCommandHandlers();
  pluginCommands.forEach((cmd) => {
    const disposable = vscode.commands.registerCommand(cmd.command, cmd.handler);
    context.subscriptions.push(disposable);
  });

  // Register commands
  const scanCommand = vscode.commands.registerCommand('devsync.scan', commands.scan.bind(commands));
  const generateMigrationCommand = vscode.commands.registerCommand(
    'devsync.generateMigration',
    commands.generateMigration.bind(commands)
  );
  
  // Register execution control commands
  const pauseQueueCommand = vscode.commands.registerCommand(
    'devsync.queue.pause',
    () => commands.pauseQueue()
  );
  const resumeQueueCommand = vscode.commands.registerCommand(
    'devsync.queue.resume',
    () => commands.resumeQueue()
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
  
  // Enhanced sidebar commands
  const sidebarSearchCommand = vscode.commands.registerCommand(
    'devsync.sidebar.search',
    async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search in sidebar',
        placeHolder: 'Enter search query...',
        ignoreFocusOut: true
      });
      if (query !== undefined) {
        sidebarProvider.setSearchQuery(query);
      }
    }
  );
  
  const sidebarClearSearchCommand = vscode.commands.registerCommand(
    'devsync.sidebar.clearSearch',
    () => {
      sidebarProvider.setSearchQuery('');
    }
  );
  
  const focusChatCommand = vscode.commands.registerCommand('devsync.chat.focus', () => chatManager.focus());
  const newConversationCommand = vscode.commands.registerCommand('devsync.chat.newConversation', () =>
    chatManager.newConversation()
  );
  const chatLoginCommand = vscode.commands.registerCommand('devsync.chat.login', () => chatManager.showLoginFlow());
  const chatLogoutCommand = vscode.commands.registerCommand('devsync.chat.logout', () => chatManager.logout());
  
  // Enhanced editor commands
  const previewFixCommand = vscode.commands.registerCommand(
    'devsync.previewFix',
    async (document: vscode.TextDocument, diagnostic: vscode.Diagnostic, suggestedFix: string) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === document) {
        // Extract mismatch info from diagnostic (simplified - would need full mismatch object)
        const mismatch: Mismatch = { type: 'missing_field', model: 'Unknown', field: 'unknown', severity: 'error' };
        enhancedCodeActions.getPreviewManager().showInlinePreview(
          editor,
          diagnostic.range,
          mismatch,
          suggestedFix
        );
      }
    }
  );
  
  const showDiffCommand = vscode.commands.registerCommand(
    'devsync.showDiff',
    async (document: vscode.TextDocument, diagnostic: vscode.Diagnostic, suggestedFix: string) => {
      await enhancedCodeActions.getDiffViewManager().showRangeDiff(
        document,
        diagnostic.range,
        suggestedFix
      );
    }
  );
  
  const batchApplyFixesCommand = vscode.commands.registerCommand(
    'devsync.batchApplyFixes',
    async (document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) => {
      const fixes = diagnostics.map((diagnostic) => {
        const suggestedFix = extractSuggestedFix(diagnostic.message) || '';
        const mismatch: Mismatch = { type: 'missing_field', model: 'Unknown', field: 'unknown', severity: 'error' };
        return {
          mismatch,
          diagnostic,
          fix: suggestedFix,
        };
      });
      
      await enhancedCodeActions.getBatchApplyManager().applyBatchFixes(
        document,
        fixes,
        true // preview
      );
    }
  );
  
  const previewMigrationImpactCommand = vscode.commands.registerCommand(
    'devsync.previewMigrationImpact',
    async () => {
      const scanReport = await apiClient.getLatestScanReport();
      if (!scanReport) {
        vscode.window.showWarningMessage('No scan report found. Run a scan first.');
        return;
      }
      
      const migrations = await apiClient.getMigrations(scanReport.id);
      if (migrations.length === 0) {
        vscode.window.showWarningMessage('No migrations found.');
        return;
      }
      
      await migrationPreview.previewMigrationImpact(migrations[0], scanReport);
    }
  );
  
  const showSchemaComparisonCommand = vscode.commands.registerCommand(
    'devsync.showSchemaComparison',
    async () => {
      const scanReport = await apiClient.getLatestScanReport();
      if (!scanReport) {
        vscode.window.showWarningMessage('No scan report found. Run a scan first.');
        return;
      }
      
      await schemaComparison.showComparison(scanReport);
    }
  );
  
  const showMigrationHistoryCommand = vscode.commands.registerCommand(
    'devsync.showMigrationHistory',
    async (modelName?: string, fieldName?: string) => {
      await migrationHistory.showMigrationHistory(modelName, fieldName);
    }
  );
  
  // Helper function to extract suggested fix
  function extractSuggestedFix(message: string): string | null {
    const match = message.match(/Suggested Fix:\s*(.+)/s);
    return match ? match[1].trim() : null;
  }

  context.subscriptions.push(
    codeActionProvider,
    sidebarSearchCommand,
    sidebarClearSearchCommand,
    previewFixCommand,
    showDiffCommand,
    batchApplyFixesCommand,
    previewMigrationImpactCommand,
    showSchemaComparisonCommand,
    showMigrationHistoryCommand
  );

  // Auto-scan on file save (if enabled)
  const configManager = container.getConfigurationManager();
  if (configManager.get('autoScan')) {
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
    diagnostics.checkWorkspace(workspaceFolders[0]).then(() => {
      // Annotate schema with database state after diagnostics are loaded
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'prisma') {
        apiClient.getLatestScanReport().then(scanReport => {
          if (scanReport) {
            schemaAnnotations.annotateSchema(editor, scanReport);
          }
        });
      }
    });
  }
  
  // Update annotations when editor changes
  const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && editor.document.languageId === 'prisma') {
      apiClient.getLatestScanReport().then(scanReport => {
        if (scanReport) {
          schemaAnnotations.annotateSchema(editor, scanReport);
        }
      });
    }
  });
  context.subscriptions.push(editorChangeListener);

  // Configuration changes are now handled automatically by ConfigurationManager
  // Listen to configuration changes and update services
  const configChangeListener = configManager.onDidChangeConfig(() => {
    const updatedConfig = configManager.getAll();
    
    // Update chat manager with new configuration
    chatManager.updateConfiguration({ 
      apiUrl: updatedConfig.apiUrl, 
      projectId: updatedConfig.projectId || undefined 
    });
  });
  context.subscriptions.push(configChangeListener);

  // Initialize onboarding system
  const schemaDetector = new PrismaSchemaDetector();
  const connectionTester = new DatabaseConnectionTester();
  const onboardingWizard = new OnboardingWizard(
    context,
    configManager,
    schemaDetector,
    connectionTester
  );
  const quickStartManager = new QuickStartManager();

  // Check if onboarding is needed
  const onboardingCompleted = context.globalState.get<boolean>('devsync.onboarding.completed', false);
  if (!onboardingCompleted) {
    // Show onboarding after a short delay to let extension fully initialize
    const onboardingTimeout = setTimeout(async () => {
      const shouldStart = await vscode.window.showInformationMessage(
        'Welcome to DevSync! Would you like to run the setup wizard?',
        'Start Setup',
        'Skip'
      );
      if (shouldStart === 'Start Setup') {
        await onboardingWizard.start();
      }
    }, 2000);
    // Store timeout for cleanup (though it will complete before deactivation)
    context.subscriptions.push({
      dispose: () => clearTimeout(onboardingTimeout),
    });
  }

  // Register onboarding commands
  const startOnboardingCommand = vscode.commands.registerCommand(
    'devsync.onboarding.start',
    () => onboardingWizard.start()
  );
  const restartOnboardingCommand = vscode.commands.registerCommand(
    'devsync.onboarding.restart',
    async () => {
      await context.globalState.update('devsync.onboarding.completed', false);
      await onboardingWizard.start();
    }
  );
  const quickStartCommand = vscode.commands.registerCommand(
    'devsync.onboarding.quickStart',
    async () => {
      const template = await quickStartManager.showTemplateSelection();
      if (template) {
        await quickStartManager.applyTemplate(template);
      }
    }
  );

  context.subscriptions.push(
    startOnboardingCommand,
    restartOnboardingCommand,
    quickStartCommand,
    pauseQueueCommand,
    resumeQueueCommand
  );
}

/**
 * Deactivates the DevSync VS Code extension.
 * 
 * Called by VS Code when the extension is being deactivated. All cleanup
 * is handled automatically through VS Code's subscription system, so this
 * function primarily logs the deactivation.
 * 
 * @example
 * This function is called automatically when:
 * - VS Code is shutting down
 * - The extension is disabled
 * - The extension is being reloaded
 */
export function deactivate() {
  console.log('DevSync extension is now deactivated!');
  // Cleanup is handled automatically through VS Code's subscription system
  // All disposables registered with context.subscriptions are automatically disposed
}

