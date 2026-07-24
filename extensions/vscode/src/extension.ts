import * as vscode from 'vscode';
import { StartupOptimizer, InitPriority } from './performance';
import { DevSyncCodeActions, applyFix } from './codeActions';
import { DevSyncSidebarProvider } from './sidebarProvider';
import { SidebarCommands } from './sidebarCommands';
import { ChatPanelManager } from './chatPanelManager';
import { ChatViewProvider } from './chatViewProvider';
import { ContainerFactory } from './di/factory';
import { EditorService } from './ui/editor';
import { SchemaStatusBarManager } from './ui/schemaStatusBar';
import { FixPreviewManager } from './editor/fixPreview';
import { Mismatch } from './api';
import { getModelInfoFromConfig } from './utils/aiModelInfo';
import { ErdPanel } from './erd/panel';
import { registerErdCommands } from './erd/commands';
import { ErdSnapshotWatcher } from './erd/watcher';
import { detectProjectInfo } from './utils/project-detector';

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
export async function activate(context: vscode.ExtensionContext) {
  console.log('DevSync extension is now active!');

  // Initialize startup optimizer first
  StartupOptimizer.initialize(context);

  // CRITICAL: Initialize dependency injection container (must be immediate)
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

  // Initialize security manager through DI container
  await container.initializeSecurityManager();
  const securityManager = container.getSecurityManager();
  context.subscriptions.push(securityManager);
  
  // HIGH PRIORITY: Initialize basic editor service (needed for code actions)
  const editorService = new EditorService();
  
  // HIGH PRIORITY: Initialize schema status bar manager
  const schemaStatusBar = new SchemaStatusBarManager(context);
  
  // HIGH PRIORITY: Initialize fix preview manager
  const fixPreviewManager = new FixPreviewManager(editorService);
  context.subscriptions.push(fixPreviewManager);
  
  // Register enhanced editor features as progressive (load on demand)
  StartupOptimizer.registerFeature({
    name: 'enhancedCodeActions',
    load: async () => {
      const { EnhancedCodeActions } = await import('./editor');
      return new EnhancedCodeActions(apiClient, diagnostics);
    },
    activateOn: ['onCommand:devsync.previewFix', 'onCommand:devsync.showDiff'],
  });

  StartupOptimizer.registerFeature({
    name: 'migrationPreview',
    load: async () => {
      const { MigrationPreviewManager } = await import('./editor');
      return new MigrationPreviewManager(editorService);
    },
    activateOn: ['onCommand:devsync.previewMigrationImpact'],
  });

  StartupOptimizer.registerFeature({
    name: 'schemaComparison',
    load: async () => {
      const { SchemaComparisonManager } = await import('./editor');
      return new SchemaComparisonManager(editorService);
    },
    activateOn: ['onCommand:devsync.showSchemaComparison'],
  });

  // NORMAL PRIORITY: Schema annotations (deferred)
  StartupOptimizer.registerDeferredTask(
    'schemaAnnotations',
    InitPriority.NORMAL,
    async () => {
      const { SchemaAnnotationManager } = await import('./editor');
      const schemaAnnotations = new SchemaAnnotationManager();
      schemaAnnotations.registerHoverProvider(context);
    }
  );

  // NORMAL PRIORITY: Migration history (deferred)
  StartupOptimizer.registerDeferredTask(
    'migrationHistory',
    InitPriority.NORMAL,
    async () => {
      const { MigrationHistoryManager } = await import('./editor');
      new MigrationHistoryManager(editorService);
    }
  );

  // Create basic code actions (critical for diagnostics)
  const enhancedCodeActions = new DevSyncCodeActions(apiClient, diagnostics);

  // Initialize sidebar with enhanced features
  const sidebarProvider = new DevSyncSidebarProvider(cliRunner, context, authManager);
  const sidebarCommands = new SidebarCommands(sidebarProvider, cliRunner);

  // Register tree data provider for sidebar
  const treeView = vscode.window.createTreeView('devsyncSidebar', {
    treeDataProvider: sidebarProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  // Chat assistant setup
  const chatManager = new ChatPanelManager(context, authManager, chatApiClient, cliRunner, pluginRegistry);
  chatManager.updateConfiguration({
    apiUrl: config.apiUrl,
    analyzerUrl: config.analyzerUrl,
    projectId: config.projectId || undefined,
  });
  const chatViewProvider = new ChatViewProvider(context, chatManager);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, chatViewProvider, {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    })
  );

  // ERD Panel command
  context.subscriptions.push(
    vscode.commands.registerCommand('devsync.openERD', () => {
      ErdPanel.createOrShow(context);
    }),
  );
  registerErdCommands(context);

  // Setup ERD snapshot watcher for CLI integration
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    const erdWatcher = new ErdSnapshotWatcher(workspaceRoot);
    context.subscriptions.push(erdWatcher);
  }

  // Register code action provider (basic - critical for diagnostics)
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

  // Register plugin command handlers (before built-in commands)
  const pluginCommands = pluginRegistry.getAllCommandHandlers();
  pluginCommands.forEach((cmd) => {
    const disposable = vscode.commands.registerCommand(cmd.command, cmd.handler);
    context.subscriptions.push(disposable);
  });

  // Register commands (scan command will be registered separately to update status bar)
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
  const undoLastCommand = vscode.commands.registerCommand(
    'devsync.undoLast',
    () => commands.undoLast()
  );

  // NORMAL PRIORITY: Help system (deferred until idle)
  StartupOptimizer.registerDeferredTask(
    'helpSystem',
    InitPriority.NORMAL,
    async () => {
      const { initializeHelpSystem } = await import('./help');
      initializeHelpSystem(context);
    }
  );

  // Register help commands (lazy load help modules)
  const showFAQCommand = vscode.commands.registerCommand(
    'devsync.help.showFAQ',
    async () => {
      const { FAQManager } = await import('./help');
      await FAQManager.showFAQ(context);
    }
  );
  const startTutorialCommand = vscode.commands.registerCommand(
    'devsync.help.startTutorial',
    async () => {
      const { TutorialManager } = await import('./help');
      await TutorialManager.startTutorial(context, 'getting-started');
    }
  );
  const communityCommand = vscode.commands.registerCommand(
    'devsync.help.community',
    async () => {
      const { CommunityManager } = await import('./help');
      await CommunityManager.showCommunityPanel(context);
    }
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
  const statusCommand = vscode.commands.registerCommand(
    'devsync.status',
    () => sidebarCommands.status()
  );
  const fixCommand = vscode.commands.registerCommand(
    'devsync.fix',
    () => sidebarCommands.fix()
  );
  const applyCommand = vscode.commands.registerCommand(
    'devsync.apply',
    () => sidebarCommands.apply()
  );

  // Register sidebar commands
  const sidebarScanCommand = vscode.commands.registerCommand(
    'devsync.sidebar.scan',
    () => commands.scan()
  );
  const sidebarMigrateCommand = vscode.commands.registerCommand(
    'devsync.sidebar.migrate',
    () => commands.generateMigration()
  );
  const sidebarInitCommand = vscode.commands.registerCommand(
    'devsync.sidebar.init',
    () => vscode.commands.executeCommand('devsync.createProject')
  );
  const sidebarShowOutputCommand = vscode.commands.registerCommand(
    'devsync.sidebar.showOutput',
    () => sidebarCommands.showOutput()
  );
  const sidebarViewFixCommand = vscode.commands.registerCommand(
    'devsync.sidebar.viewFix',
    (mismatch) => {
      return sidebarCommands.viewFix(mismatch);
    }
  );
  const sidebarJumpToSourceCommand = vscode.commands.registerCommand(
    'devsync.sidebar.jumpToSource',
    (mismatch) => {
      return sidebarCommands.jumpToSource(mismatch);
    }
  );
  const sidebarOpenConfigCommand = vscode.commands.registerCommand(
    'devsync.sidebar.openConfig',
    () => sidebarCommands.openConfig()
  );
  const sidebarStatusCommand = vscode.commands.registerCommand(
    'devsync.sidebar.status',
    () => sidebarCommands.status()
  );
  const sidebarFixCommand = vscode.commands.registerCommand(
    'devsync.sidebar.fix',
    () => sidebarCommands.fix()
  );
  const sidebarApplyCommand = vscode.commands.registerCommand(
    'devsync.sidebar.apply',
    () => sidebarCommands.apply()
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

  const sidebarFilterPresetCommand = vscode.commands.registerCommand(
    'devsync.sidebar.filterPreset',
    async () => {
      const choice = await vscode.window.showQuickPick(
        [
          { label: 'All severities', value: 'all' },
          { label: 'Errors only', value: 'errors' },
          { label: 'Warnings + Errors', value: 'warnings' },
          { label: 'Info only', value: 'info' },
        ],
        {
          placeHolder: 'Filter mismatches by severity',
          ignoreFocusOut: true,
        }
      );
      if (choice) {
        sidebarProvider.setFilterPreset(choice.value as 'all' | 'errors' | 'warnings' | 'info');
        vscode.window.showInformationMessage(`DevSync sidebar filter set to ${choice.label}`);
      }
    }
  );
  
  const focusChatCommand = vscode.commands.registerCommand('devsync.chat.focus', () => chatManager.focus());
  const newConversationCommand = vscode.commands.registerCommand('devsync.chat.newConversation', () =>
    chatManager.newConversation()
  );
  const chatLoginCommand = vscode.commands.registerCommand('devsync.chat.login', () => chatManager.showLoginFlow());
  const chatLogoutCommand = vscode.commands.registerCommand('devsync.chat.logout', () => chatManager.logout());
  const selectProjectCommand = vscode.commands.registerCommand('devsync.selectProject', async () => {
    try {
      const projects = await apiClient.listProjects();
      if (projects.length === 0) {
        const action = await vscode.window.showInformationMessage(
          'No DevSync projects are available for this account.',
          'Open Dashboard'
        );
        if (action === 'Open Dashboard') {
          await vscode.env.openExternal(vscode.Uri.parse(`${configManager.get('apiUrl')}/dashboard`));
        }
        return;
      }

      const selected = await vscode.window.showQuickPick(
        projects.map((project) => ({
          label: project.name,
          description: project.schemaType || project.schema_type || 'Project',
          detail: project.id,
          projectId: project.id,
        })),
        { placeHolder: 'Select the DevSync project for this workspace', matchOnDetail: true }
      );
      if (!selected) return;

      await configManager.update('projectId', selected.projectId, vscode.ConfigurationTarget.Workspace);
      if (typeof (apiClient as any).setProjectId === 'function') {
        (apiClient as any).setProjectId(selected.projectId);
      }
      sidebarProvider.refresh();
      await vscode.window.showInformationMessage(`DevSync project selected: ${selected.label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const action = await vscode.window.showErrorMessage(
        `Unable to load DevSync projects: ${message}`,
        'Sign In'
      );
      if (action === 'Sign In') {
        await vscode.commands.executeCommand('devsync.chat.login');
      }
    }
  });
  const createProjectCommand = vscode.commands.registerCommand('devsync.createProject', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      await vscode.window.showErrorMessage('Open a project folder before creating a DevSync project.');
      return;
    }

    const detected = detectProjectInfo(folder.uri.fsPath);
    const name = await vscode.window.showInputBox({
      title: 'Create DevSync Project',
      prompt: 'Project name',
      value: detected.name,
      validateInput: (value) => value.trim() ? undefined : 'A project name is required',
    });
    if (!name) return;

    const schemaTypes = ['prisma', 'supabase', 'typeorm', 'kysely', 'sequelize', 'drizzle', 'django', 'sqlalchemy', 'raw-sql'];
    const schemaType = await vscode.window.showQuickPick(schemaTypes, {
      title: 'Create DevSync Project',
      placeHolder: 'Select the schema type',
      ...(detected.schemaType ? { activeItem: detected.schemaType } : {}),
    });
    if (!schemaType) return;

    const configUri = vscode.Uri.joinPath(folder.uri, '.devsync', 'config.json');
    let localConfig: any = {};
    try {
      localConfig = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(configUri)));
    } catch {
      // A new local project starts from conservative, read-only defaults.
    }
    localConfig = {
      version: localConfig.version || '1.0',
      ...localConfig,
      project: { ...(localConfig.project || {}), name: name.trim(), schemaType },
      database: localConfig.database || { mode: 'auto', connectionString: '', writeAccess: false },
      safety: localConfig.safety || { allowWrites: false, allowDbWrites: false, requirePlanApproval: true },
      paths: localConfig.paths || { ignores: [] },
    };
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(folder.uri, '.devsync'));
    await vscode.workspace.fs.writeFile(configUri, new TextEncoder().encode(JSON.stringify(localConfig, null, 2)));

    if (localConfig.project.id) {
      await configManager.update('projectId', localConfig.project.id, vscode.ConfigurationTarget.Workspace);
      sidebarProvider.refresh();
      await vscode.window.showInformationMessage(`DevSync project is already connected: ${name.trim()}`);
      return;
    }

    try {
      const project = await apiClient.createProject({
        name: name.trim(),
        schemaType,
        codebase: { type: 'cli', url: detected.gitRemote },
      });
      localConfig.project.id = project.id;
      await vscode.workspace.fs.writeFile(configUri, new TextEncoder().encode(JSON.stringify(localConfig, null, 2)));
      await configManager.update('projectId', project.id, vscode.ConfigurationTarget.Workspace);
      if (typeof (apiClient as any).setProjectId === 'function') {
        (apiClient as any).setProjectId(project.id);
      }
      sidebarProvider.refresh();
      await vscode.window.showInformationMessage(`Created and connected DevSync project: ${project.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const action = await vscode.window.showWarningMessage(
        `Created the local project, but it could not be connected: ${message}`,
        'Sign In'
      );
      if (action === 'Sign In') {
        await vscode.commands.executeCommand('devsync.chat.login');
      }
    }
  });
  const localScanCommand = vscode.commands.registerCommand('devsync.scanLocal', async () => {
    if (!vscode.workspace.workspaceFolders?.length) {
      await vscode.window.showErrorMessage('Open a project folder before running a local scan.');
      return;
    }
    if (!(await cliRunner.checkCliAvailable())) {
      await vscode.window.showErrorMessage('The DevSync CLI is required for offline scans. Install it with `npm install --global @devsync/cli`.');
      return;
    }
    cliRunner.showOutput();
    const result = await cliRunner.executeCliCommand('scan', { local: true, format: 'table' });
    if (result.success) {
      await vscode.window.showInformationMessage('DevSync local scan completed.');
    } else {
      await vscode.window.showErrorMessage(`DevSync local scan failed: ${result.error || 'Unknown error'}`);
    }
  });
  
  // Enhanced editor commands (load on demand)
  const previewFixCommand = vscode.commands.registerCommand(
    'devsync.previewFix',
    async (document: vscode.TextDocument, diagnostic: vscode.Diagnostic, suggestedFix: string) => {
      // Load enhanced code actions on demand
      await StartupOptimizer.getProgressiveEnhancement().loadFeature('enhancedCodeActions');
      const { EnhancedCodeActions } = await import('./editor');
      const enhancedActions = new EnhancedCodeActions(apiClient, container.getDiagnostics());
      
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === document) {
        // Extract mismatch info from diagnostic (simplified - would need full mismatch object)
        const mismatch: Mismatch = { type: 'missing_field', model: 'Unknown', field: 'unknown', severity: 'error' };
        enhancedActions.getPreviewManager().showInlinePreview(
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
      // Load enhanced code actions on demand
      await StartupOptimizer.getProgressiveEnhancement().loadFeature('enhancedCodeActions');
      const { EnhancedCodeActions } = await import('./editor');
      const enhancedActions = new EnhancedCodeActions(apiClient, container.getDiagnostics());
      
      await enhancedActions.getDiffViewManager().showRangeDiff(
        document,
        diagnostic.range,
        suggestedFix
      );
    }
  );
  
  const batchApplyFixesCommand = vscode.commands.registerCommand(
    'devsync.batchApplyFixes',
    async (document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]) => {
      // Load enhanced code actions on demand
      await StartupOptimizer.getProgressiveEnhancement().loadFeature('enhancedCodeActions');
      const { EnhancedCodeActions } = await import('./editor');
      const enhancedActions = new EnhancedCodeActions(apiClient, container.getDiagnostics());
      
      const fixes = diagnostics.map((diagnostic) => {
        const suggestedFix = extractSuggestedFix(diagnostic.message) || '';
        const mismatch: Mismatch = { type: 'missing_field', model: 'Unknown', field: 'unknown', severity: 'error' };
        return {
          mismatch,
          diagnostic,
          fix: suggestedFix,
        };
      });
      
      await enhancedActions.getBatchApplyManager().applyBatchFixes(
        document,
        fixes,
        true // preview
      );
    }
  );
  
  const previewMigrationImpactCommand = vscode.commands.registerCommand(
    'devsync.previewMigrationImpact',
    async () => {
      // Load migration preview on demand
      await StartupOptimizer.getProgressiveEnhancement().loadFeature('migrationPreview');
      const { MigrationPreviewManager } = await import('./editor');
      const migrationPreview = new MigrationPreviewManager(editorService);
      
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
  
  // Note: devsync.showStatus command is registered by SchemaStatusBarManager
  // No need to register it here to avoid duplicate command error
  // Note: devsync.fix is already registered above, so we skip duplicate registration here

  // Update status bar when scan completes
  const originalScan = commands.scan.bind(commands);
  commands.scan = async function() {
    try {
      // Show AI model info if AI analysis is enabled
      const config = vscode.workspace.getConfiguration('devsync');
      if (config.get<boolean>('aiAnalysis', false)) {
        const modelInfo = getModelInfoFromConfig(vscode);
        const outputChannel = vscode.window.createOutputChannel('DevSync');
        outputChannel.appendLine(`🤖 Using AI Model: ${modelInfo.displayName}`);
        outputChannel.appendLine(`   Provider: ${modelInfo.provider} | Model: ${modelInfo.model}`);
        outputChannel.show(true);
      }
      
      schemaStatusBar.showScanning();
      const result = await originalScan();
      
      // Get latest scan report to update status bar
      try {
        const scanReport = await apiClient.getLatestScanReport();
        if (scanReport) {
          schemaStatusBar.updateFromMismatches(scanReport.mismatches, new Date(scanReport.completed_at || scanReport.created_at));
        }
      } catch (error) {
        // Ignore errors getting scan report
      }
      
      return result;
    } catch (error) {
      schemaStatusBar.showError(error instanceof Error ? error.message : 'Scan failed');
      throw error;
    }
  };

  const showSchemaComparisonCommand = vscode.commands.registerCommand(
    'devsync.showSchemaComparison',
    async (fix?: any) => {
      // Load schema comparison on demand
      const { SchemaComparisonManager } = await import('./editor/schemaComparison');
      const schemaComparison = new SchemaComparisonManager(editorService);
      
      if (fix) {
        // Show comparison for a specific fix
        await schemaComparison.showComparisonForFix(fix);
      } else {
        // Show comparison for latest scan report
        const scanReport = await apiClient.getLatestScanReport();
        if (!scanReport) {
          vscode.window.showWarningMessage('No scan report found. Run a scan first.');
          return;
        }
        
        // For now, show a message - full scan report comparison would need more implementation
        vscode.window.showInformationMessage('Schema comparison: Select a fix to view detailed comparison.');
      }
    }
  );
  
  const showMigrationHistoryCommand = vscode.commands.registerCommand(
    'devsync.showMigrationHistory',
    async (modelName?: string, fieldName?: string) => {
      // Load migration history on demand
      const { MigrationHistoryManager } = await import('./editor');
      const migrationHistory = new MigrationHistoryManager(editorService);
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
    sidebarScanCommand,
    sidebarMigrateCommand,
    sidebarInitCommand,
    sidebarShowOutputCommand,
    sidebarOpenConfigCommand,
    sidebarStatusCommand,
    sidebarFixCommand,
    sidebarApplyCommand,
    sidebarRefreshCommand,
    sidebarSearchCommand,
    sidebarClearSearchCommand,
    sidebarFilterPresetCommand,
    sidebarViewFixCommand,
    sidebarJumpToSourceCommand,
    focusChatCommand,
    newConversationCommand,
    chatLoginCommand,
    chatLogoutCommand,
    selectProjectCommand,
    localScanCommand,
    createProjectCommand,
    previewFixCommand,
    showDiffCommand,
    batchApplyFixesCommand,
    previewMigrationImpactCommand,
    showSchemaComparisonCommand,
    showMigrationHistoryCommand,
    // showStatusCommand is registered by SchemaStatusBarManager, don't add it here
    fixCommand
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

  // Initial diagnostics check (deferred - background)
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    // Defer diagnostics check to background
    StartupOptimizer.registerDeferredTask(
      'initialDiagnostics',
      InitPriority.NORMAL,
      async () => {
        await diagnostics.checkWorkspace(workspaceFolders[0]);
        // Annotate schema with database state after diagnostics are loaded
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'prisma') {
          const scanReport = await apiClient.getLatestScanReport();
          if (scanReport) {
            // Load schema annotations on demand
            const { SchemaAnnotationManager } = await import('./editor');
            const schemaAnnotations = new SchemaAnnotationManager();
            schemaAnnotations.annotateSchema(editor, scanReport);
          }
        }
      }
    );
  }
  
  // Update annotations when editor changes (load on demand)
  const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (editor && editor.document.languageId === 'prisma') {
      // Load schema annotations on demand
      const { SchemaAnnotationManager } = await import('./editor');
      const schemaAnnotations = new SchemaAnnotationManager();
      const scanReport = await apiClient.getLatestScanReport();
      if (scanReport) {
        schemaAnnotations.annotateSchema(editor, scanReport);
      }
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
      analyzerUrl: updatedConfig.analyzerUrl,
      projectId: updatedConfig.projectId || undefined,
    });
  });
  context.subscriptions.push(configChangeListener);

  // Lazy load onboarding components
  const getOnboardingComponents = async () => {
    const { PrismaSchemaDetector, DatabaseConnectionTester, OnboardingWizard, QuickStartManager } = await import('./onboarding');
    const schemaDetector = new PrismaSchemaDetector();
    const connectionTester = new DatabaseConnectionTester();
    const onboardingWizard = new OnboardingWizard(
      context,
      configManager,
      schemaDetector,
      connectionTester
    );
    const quickStartManager = new QuickStartManager();
    return { schemaDetector, connectionTester, onboardingWizard, quickStartManager };
  };

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
        const { onboardingWizard } = await getOnboardingComponents();
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
    async () => {
      const { onboardingWizard } = await getOnboardingComponents();
      await onboardingWizard.start();
    }
  );
  const restartOnboardingCommand = vscode.commands.registerCommand(
    'devsync.onboarding.restart',
    async () => {
      await context.globalState.update('devsync.onboarding.completed', false);
      const { onboardingWizard } = await getOnboardingComponents();
      await onboardingWizard.start();
    }
  );
  const quickStartCommand = vscode.commands.registerCommand(
    'devsync.onboarding.quickStart',
    async () => {
      const { quickStartManager } = await getOnboardingComponents();
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
    resumeQueueCommand,
    undoLastCommand,
    showFAQCommand,
    startTutorialCommand,
    communityCommand
  );

  // Execute critical initialization tasks
  await StartupOptimizer.executeCritical();

  // High priority tasks execute automatically after a short delay
  // Normal priority tasks execute after 2 seconds (idle)
  // Low priority tasks execute when features are accessed
}

/**
 * Deactivates the DevSync VS Code extension.
 * 
 * Called by VS Code when the extension is being deactivated. 
 * 
 * Session lifecycle: Sessions are lifecycle-based and persist across reloads.
 * Sessions only terminate on explicit logout or when VS Code window is closed.
 * 
 * @example
 * This function is called automatically when:
 * - VS Code window is closed (session ends)
 * - The extension is disabled (session ends)
 * - The extension is being reloaded (session persists - tokens are restored)
 */
export function deactivate() {
  console.log('DevSync extension is now deactivated!');
  // Cleanup is handled automatically through VS Code's subscription system
  // All disposables registered with context.subscriptions are automatically disposed
  // 
  // Note: Session tokens are preserved in VS Code's secure storage.
  // On reload, tokens are restored and session continues.
  // Sessions only end on explicit logout or window close.
}

