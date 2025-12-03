import * as vscode from 'vscode';
import { CliCommandResult } from './cliRunner';
import { ICliRunner } from './interfaces';
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

  constructor(cliRunner: ICliRunner, context?: vscode.ExtensionContext) {
    this.cliRunner = cliRunner;
    this.context = context;
    if (context) {
      this.enhancedProvider = new EnhancedSidebarProvider(cliRunner, context);
      // Forward events from enhanced provider
      this.enhancedProvider.onDidChangeTreeData(() => {
        this._onDidChangeTreeData.fire();
      });
    }
    this.loadScanResults();
    this.loadMigrationHistory();
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

  refresh(): void {
    this.loadScanResults();
    this.loadMigrationHistory();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DevSyncTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DevSyncTreeItem): vscode.ProviderResult<DevSyncTreeItem[]> {
    if (!element) {
      // Root items
      return Promise.resolve([
        new DevSyncTreeItem(
          'Commands',
          vscode.TreeItemCollapsibleState.Expanded,
          'folder',
          undefined,
          'commands'
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

