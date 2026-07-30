import * as vscode from 'vscode';
import { CliCommandResult } from './cliRunner';
import { IApiClient, IAuthManager, ICliRunner } from './interfaces';
import { ScanReport, Mismatch } from './api';
import { safeParseScanReport } from './types/validation';
import { getScanResultsPath, getMigrationsDir, getFilesInDir, readJsonFile } from './utils/paths';
import { formatMismatchType } from './utils/ui';
import { EnhancedSidebarProvider, OperationProgress } from './sidebar';

/**
 * DevSync sidebar provider with enhanced UX features.
 * 
 * Wraps the enhanced provider to maintain backward compatibility while adding:
 * - Progress indicators
 * - Color-coded status
 * - Expandable/collapsible sections with memory
 * - Search/filter functionality
 */
export class DevSyncSidebarProvider implements vscode.TreeDataProvider<DevSyncTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DevSyncTreeItem | undefined | null | void> = new vscode.EventEmitter<DevSyncTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DevSyncTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private cliRunner: ICliRunner;
  private scanResults: ScanReport | null = null;
  private migrationHistory: string[] = [];
  private isScanning: boolean = false;
  private isMigrating: boolean = false;
  private enhancedProvider?: EnhancedSidebarProvider;
  private context?: vscode.ExtensionContext;
  private authManager?: IAuthManager;
  private apiClient?: IApiClient;
  private dashboardSync = 0;

  constructor(
    cliRunner: ICliRunner,
    context?: vscode.ExtensionContext,
    authManager?: IAuthManager,
    apiClient?: IApiClient
  ) {
    this.cliRunner = cliRunner;
    this.context = context;
    this.authManager = authManager;
    this.apiClient = apiClient;
    if (context) {
      this.enhancedProvider = new EnhancedSidebarProvider(cliRunner, context);
      // Forward events from enhanced provider
      this.enhancedProvider.onDidChangeTreeData(() => {
        this._onDidChangeTreeData.fire();
      });
      if (authManager) {
        context.subscriptions.push(authManager.onDidChangeSession(() => this.refresh()));
      }
    }
    this.loadScanResults();
    this.loadMigrationHistory();
    void this.syncDashboardState();
  }

  /**
   * Gets the enhanced provider if available.
   */
  getEnhancedProvider(): EnhancedSidebarProvider | undefined {
    return this.enhancedProvider;
  }

  /**
   * Updates progress for an operation (enhanced feature).
   */
  updateProgress(operation: 'scan' | 'migration' | 'init', progress: number, message: string, estimatedTimeRemaining?: number): void {
    if (this.enhancedProvider) {
      this.enhancedProvider.updateProgress(operation, progress, message, estimatedTimeRemaining);
    }
  }

  /**
   * Clears progress for an operation (enhanced feature).
   */
  clearProgress(operation: 'scan' | 'migration' | 'init'): void {
    if (this.enhancedProvider) {
      this.enhancedProvider.clearProgress(operation);
    }
  }

  /**
   * Sets search query (enhanced feature).
   */
  setSearchQuery(query: string): void {
    if (this.enhancedProvider) {
      this.enhancedProvider.setSearchQuery(query);
    }
  }

  /**
   * Sets filter preset (enhanced feature).
   */
  setFilterPreset(preset: 'all' | 'errors' | 'warnings' | 'info'): void {
    if (this.enhancedProvider) {
      this.enhancedProvider.setFilterPreset(preset);
    }
  }

  refresh(): void {
    this.loadScanResults();
    this.loadMigrationHistory();
    this._onDidChangeTreeData.fire();
    void this.syncDashboardState();
  }

  private async syncDashboardState(): Promise<void> {
    const sync = ++this.dashboardSync;
    const projectId = vscode.workspace.getConfiguration('devsync').get<string>('projectId', '').trim();
    if (!projectId || !this.apiClient || this.authManager?.getSession().status !== 'authenticated') {
      return;
    }
    try {
      const report = await this.apiClient.getLatestScanReport();
      if (sync === this.dashboardSync && report) {
        this.scanResults = report;
        this._onDidChangeTreeData.fire();
      }
    } catch {
      // Keep local results visible when the dashboard is temporarily unavailable.
    }
  }

  getTreeItem(element: DevSyncTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DevSyncTreeItem): vscode.ProviderResult<DevSyncTreeItem[]> {
    if (!element) {
      // Root items
      return Promise.resolve([
        new DevSyncTreeItem(
          'Account',
          vscode.TreeItemCollapsibleState.Expanded,
          'account',
          undefined,
          'account'
        ),
        new DevSyncTreeItem(
          'Project',
          vscode.TreeItemCollapsibleState.Expanded,
          'folder-opened',
          undefined,
          'project'
        ),
        new DevSyncTreeItem(
          'Schema Workflow',
          vscode.TreeItemCollapsibleState.Expanded,
          'database',
          undefined,
          'workflow'
        ),
        new DevSyncTreeItem(
          'Scan Results',
          this.scanResults ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
          'file',
          undefined,
          'scan-results'
        ),
        new DevSyncTreeItem(
          'Migrations',
          this.migrationHistory.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
          'file',
          undefined,
          'migrations'
        ),
        new DevSyncTreeItem(
          'Configuration',
          vscode.TreeItemCollapsibleState.Collapsed,
          'settings',
          undefined,
          'config'
        )
      ]);
    }

    if (element.contextValue === 'account') {
      const session = this.authManager?.getSession();
      const authenticated = session?.status === 'authenticated';
      const items = [
        new DevSyncTreeItem(
          authenticated ? 'Connected to Dev-Sync' : session?.status === 'authenticating' ? 'Connecting to Dev-Sync...' : 'Sign in to Dev-Sync',
          vscode.TreeItemCollapsibleState.None,
          authenticated ? 'verified-filled' : session?.status === 'authenticating' ? 'loading~spin' : 'sign-in',
          authenticated ? undefined : {
            command: 'devsync.chat.login',
            title: 'Sign in to Dev-Sync',
            arguments: []
          },
          authenticated ? 'account-connected' : 'account-sign-in',
          authenticated && session.userId ? session.userId : undefined
        ),
        new DevSyncTreeItem(
          'Open Dashboard',
          vscode.TreeItemCollapsibleState.None,
          'link-external',
          {
            command: 'devsync.openDashboard',
            title: 'Open Dashboard',
            arguments: []
          },
          'account-dashboard'
        )
      ];

      if (authenticated) {
        items.push(new DevSyncTreeItem(
          'Sign out',
          vscode.TreeItemCollapsibleState.None,
          'sign-out',
          {
            command: 'devsync.chat.logout',
            title: 'Sign out',
            arguments: []
          },
          'account-sign-out'
        ));
      }
      return Promise.resolve(items);
    }

    if (element.contextValue === 'project') {
      const projectId = vscode.workspace.getConfiguration('devsync').get<string>('projectId', '').trim();
      const projectName = this.context?.workspaceState.get<string>('devsync.selectedProjectName');
      const items: DevSyncTreeItem[] = [
        projectId
          ? new DevSyncTreeItem(
              projectName || 'Connected project',
              vscode.TreeItemCollapsibleState.None,
              'pass-filled',
              undefined,
              'project-connected',
              projectName ? projectId : 'Connected to dashboard'
            )
          : new DevSyncTreeItem(
              'No project selected',
              vscode.TreeItemCollapsibleState.None,
              'warning',
              undefined,
              'project-missing'
            ),
        new DevSyncTreeItem(
          'Create Project',
          vscode.TreeItemCollapsibleState.None,
          'new-folder',
          {
            command: 'devsync.createProject',
            title: 'Create Project',
            arguments: []
          },
          'project-create'
        ),
        new DevSyncTreeItem(
          projectId ? 'Switch Project' : 'Select Project',
          vscode.TreeItemCollapsibleState.None,
          'folder-opened',
          {
            command: 'devsync.selectProject',
            title: 'Select Project',
            arguments: []
          },
          'project-select'
        )
      ];
      return Promise.resolve(items);
    }

    if (element.contextValue === 'workflow') {
      return Promise.resolve([
        new DevSyncTreeItem(
          'Scan Schema',
          vscode.TreeItemCollapsibleState.None,
          'search',
          {
            command: 'devsync.sidebar.scan',
            title: 'Scan Schema',
            arguments: []
          },
          'workflow-scan',
          this.isScanning ? '$(sync~spin) Scanning...' : undefined
        ),
        new DevSyncTreeItem(
          'View Latest Report',
          vscode.TreeItemCollapsibleState.None,
          'preview',
          {
            command: 'devsync.viewReport',
            title: 'View Latest Report',
            arguments: []
          },
          'workflow-report'
        ),
        new DevSyncTreeItem(
          'Generate Migration',
          vscode.TreeItemCollapsibleState.None,
          'tools',
          {
            command: 'devsync.sidebar.migrate',
            title: 'Generate Migration',
            arguments: []
          },
          'workflow-migrate',
          this.isMigrating ? '$(sync~spin) Generating...' : undefined
        ),
        new DevSyncTreeItem(
          'Scan Locally (Offline)',
          vscode.TreeItemCollapsibleState.None,
          'device-desktop',
          {
            command: 'devsync.scanLocal',
            title: 'Scan Locally',
            arguments: []
          },
          'workflow-scan-local'
        ),
        new DevSyncTreeItem(
          'View Output',
          vscode.TreeItemCollapsibleState.None,
          'output',
          {
            command: 'devsync.sidebar.showOutput',
            title: 'View Output',
            arguments: []
          },
          'workflow-output'
        )
      ]);
    }

    if (element.contextValue === 'commands') {
      return Promise.resolve([
        new DevSyncTreeItem(
          '🔍 Scan Schema',
          vscode.TreeItemCollapsibleState.None,
          'play',
          {
            command: 'devsync.sidebar.scan',
            title: 'Scan Schema',
            arguments: []
          },
          'command-scan',
          this.isScanning ? '$(sync~spin) Scanning...' : undefined
        ),
        new DevSyncTreeItem(
          '🔧 Generate Migration',
          vscode.TreeItemCollapsibleState.None,
          'tools',
          {
            command: 'devsync.sidebar.migrate',
            title: 'Generate Migration',
            arguments: []
          },
          'command-migrate',
          this.isMigrating ? '$(sync~spin) Generating...' : undefined
        ),
        new DevSyncTreeItem(
          '⚙️ Initialize Project',
          vscode.TreeItemCollapsibleState.None,
          'add',
          {
            command: 'devsync.sidebar.init',
            title: 'Initialize Project',
            arguments: []
          },
          'command-init'
        ),
        new DevSyncTreeItem(
          '📊 View Output',
          vscode.TreeItemCollapsibleState.None,
          'output',
          {
            command: 'devsync.sidebar.showOutput',
            title: 'View Output',
            arguments: []
          },
          'command-output'
        )
      ]);
    }

    if (element.contextValue === 'scan-results') {
      if (!this.scanResults) {
        return Promise.resolve([
          new DevSyncTreeItem(
            'No scan results found',
            vscode.TreeItemCollapsibleState.None,
            'info',
            undefined,
            'no-results'
          )
        ]);
      }

      const items: DevSyncTreeItem[] = [];
      
      // Summary
      const mismatches = this.scanResults.mismatches || [];
      const summary = new DevSyncTreeItem(
        `Summary: ${mismatches.length} mismatch${mismatches.length !== 1 ? 'es' : ''}`,
        vscode.TreeItemCollapsibleState.Collapsed,
        'info',
        undefined,
        'summary'
      );
      items.push(summary);

      // Mismatches
      if (mismatches.length > 0) {
        const mismatchesItem = new DevSyncTreeItem(
          'Mismatches',
          vscode.TreeItemCollapsibleState.Expanded,
          'warning',
          undefined,
          'mismatches'
        );
        items.push(mismatchesItem);
      }

      return Promise.resolve(items);
    }

    if (element.contextValue === 'summary') {
      const mismatches = this.scanResults?.mismatches || [];
      const errors = mismatches.filter((m: Mismatch) => m.severity === 'error').length;
      const warnings = mismatches.filter((m: Mismatch) => m.severity === 'warning').length;

      return Promise.resolve([
        new DevSyncTreeItem(
          `Total: ${mismatches.length}`,
          vscode.TreeItemCollapsibleState.None,
          'info',
          undefined,
          'stat'
        ),
        new DevSyncTreeItem(
          `Errors: ${errors}`,
          vscode.TreeItemCollapsibleState.None,
          'error',
          undefined,
          'stat'
        ),
        new DevSyncTreeItem(
          `Warnings: ${warnings}`,
          vscode.TreeItemCollapsibleState.None,
          'warning',
          undefined,
          'stat'
        )
      ]);
    }

    if (element.contextValue === 'mismatches') {
      const mismatches = this.scanResults?.mismatches || [];
      return Promise.resolve(
        mismatches.map((mismatch: Mismatch, index: number) => {
          const icon = mismatch.severity === 'error' ? 'error' : 'warning';
          const fieldLabel = 'field' in mismatch ? mismatch.field : 'N/A';
          const typeLabel = formatMismatchType(mismatch.type);
          const label = `${typeLabel}: ${mismatch.model}.${fieldLabel}`;
          
          return new DevSyncTreeItem(
            label,
            vscode.TreeItemCollapsibleState.Collapsed,
            icon,
            undefined,
            `mismatch-${index}`,
            undefined,
            mismatch
          );
        })
      );
    }

    if (element.contextValue?.startsWith('mismatch-')) {
      const mismatch = element.mismatch;
      if (!mismatch) {
        return Promise.resolve([]);
      }

      const items: DevSyncTreeItem[] = [];
      
      items.push(new DevSyncTreeItem(
        `Type: ${mismatch.type}`,
        vscode.TreeItemCollapsibleState.None,
        'info',
        undefined,
        'mismatch-detail'
      ));

      items.push(new DevSyncTreeItem(
        `Model: ${mismatch.model}`,
        vscode.TreeItemCollapsibleState.None,
        'info',
        undefined,
        'mismatch-detail'
      ));

      if ('field' in mismatch && mismatch.field) {
        items.push(new DevSyncTreeItem(
          `Field: ${mismatch.field}`,
          vscode.TreeItemCollapsibleState.None,
          'info',
          undefined,
          'mismatch-detail'
        ));
      }

      if (mismatch.severity) {
        items.push(new DevSyncTreeItem(
          `Severity: ${mismatch.severity}`,
          vscode.TreeItemCollapsibleState.None,
          mismatch.severity === 'error' ? 'error' : 'warning',
          undefined,
          'mismatch-detail'
        ));
      }

      // Add jump to source option
      items.push(new DevSyncTreeItem(
        'Jump to Source',
        vscode.TreeItemCollapsibleState.None,
        'go-to-file',
        {
          command: 'devsync.sidebar.jumpToSource',
          title: 'Jump to Source',
          arguments: [mismatch]
        },
        'mismatch-jump'
      ));

      if (mismatch.suggestedFix) {
        items.push(new DevSyncTreeItem(
          'View Suggested Fix',
          vscode.TreeItemCollapsibleState.None,
          'tools',
          {
            command: 'devsync.sidebar.viewFix',
            title: 'View Fix',
            arguments: [mismatch]
          },
          'mismatch-fix'
        ));
      }

      return Promise.resolve(items);
    }

    if (element.contextValue === 'migrations') {
      if (this.migrationHistory.length === 0) {
        return Promise.resolve([
          new DevSyncTreeItem(
            'No migrations found',
            vscode.TreeItemCollapsibleState.None,
            'info',
            undefined,
            'no-migrations'
          )
        ]);
      }

      return Promise.resolve(
        this.migrationHistory.map((migration, index) => {
          const fileName = migration.split(/[/\\]/).pop() || `migration-${index}`;
          return new DevSyncTreeItem(
            fileName,
            vscode.TreeItemCollapsibleState.None,
            'file',
            {
              command: 'vscode.open',
              title: 'Open Migration',
              arguments: [vscode.Uri.file(migration)]
            },
            'migration-file'
          );
        })
      );
    }

    if (element.contextValue === 'config') {
      return Promise.resolve([
        new DevSyncTreeItem(
          'Open Config File',
          vscode.TreeItemCollapsibleState.None,
          'settings',
          {
            command: 'devsync.sidebar.openConfig',
            title: 'Open Config',
            arguments: []
          },
          'config-open'
        ),
        new DevSyncTreeItem(
          'Open Settings',
          vscode.TreeItemCollapsibleState.None,
          'settings',
          {
            command: 'workbench.action.openSettings',
            title: 'Open Settings',
            arguments: ['devsync']
          },
          'config-settings'
        )
      ]);
    }

    return Promise.resolve([]);
  }

  async setScanning(isScanning: boolean): Promise<void> {
    this.isScanning = isScanning;
    this._onDidChangeTreeData.fire();
  }

  async setMigrating(isMigrating: boolean): Promise<void> {
    this.isMigrating = isMigrating;
    this._onDidChangeTreeData.fire();
  }

  private async loadScanResults(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const scanResultsPath = getScanResultsPath(workspaceFolders[0]);
    const parsed = readJsonFile<unknown>(scanResultsPath);
    
    if (parsed) {
      // Validate with runtime validation
      const result = safeParseScanReport(parsed);
      if (result.success) {
        this.scanResults = result.data;
      } else {
        console.warn('Invalid scan results format:', result.error);
        this.scanResults = null;
      }
    } else {
      this.scanResults = null;
    }
  }

  private loadMigrationHistory(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const migrationsDir = getMigrationsDir(workspaceFolders[0]);
    const files = getFilesInDir(migrationsDir, /\.sql$/);
    this.migrationHistory = files.sort().reverse(); // Most recent first
  }
}

export class DevSyncTreeItem extends vscode.TreeItem {
  public readonly mismatch?: Mismatch;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly icon: string,
    public readonly command?: vscode.Command,
    contextValue?: string,
    description?: string,
    mismatch?: Mismatch
  ) {
    super(label, collapsibleState);

    this.tooltip = this.label;
    if (description) {
      this.description = description;
    }
    this.mismatch = mismatch;

    // Set icon
    if (icon) {
      this.iconPath = new vscode.ThemeIcon(icon);
    }

    // Set context value for menu contributions
    if (contextValue) {
      this.contextValue = contextValue;
    }
  }
}

