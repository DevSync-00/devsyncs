import * as vscode from 'vscode';
import { CliRunner, CliCommandResult } from './cliRunner';
import { join } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';

export class DevSyncSidebarProvider implements vscode.TreeDataProvider<DevSyncTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DevSyncTreeItem | undefined | null | void> = new vscode.EventEmitter<DevSyncTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DevSyncTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private cliRunner: CliRunner;
  private scanResults: any = null;
  private migrationHistory: any[] = [];
  private isScanning: boolean = false;
  private isMigrating: boolean = false;

  constructor(cliRunner: CliRunner) {
    this.cliRunner = cliRunner;
    this.loadScanResults();
    this.loadMigrationHistory();
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
      const errors = mismatches.filter((m: any) => m.severity === 'error').length;
      const warnings = mismatches.filter((m: any) => m.severity === 'warning').length;

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
        mismatches.map((mismatch: any, index: number) => {
          const icon = mismatch.severity === 'error' ? 'error' : 'warning';
          const label = `${mismatch.type || 'Mismatch'}: ${mismatch.model || 'Unknown'}.${mismatch.field || 'N/A'}`;
          
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
      
      if (mismatch.type) {
        items.push(new DevSyncTreeItem(
          `Type: ${mismatch.type}`,
          vscode.TreeItemCollapsibleState.None,
          'info',
          undefined,
          'mismatch-detail'
        ));
      }

      if (mismatch.model) {
        items.push(new DevSyncTreeItem(
          `Model: ${mismatch.model}`,
          vscode.TreeItemCollapsibleState.None,
          'info',
          undefined,
          'mismatch-detail'
        ));
      }

      if (mismatch.field) {
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

  private loadScanResults(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const scanResultsPath = join(workspaceFolders[0].uri.fsPath, '.devsync', 'scan-results.json');
    if (existsSync(scanResultsPath)) {
      try {
        const content = readFileSync(scanResultsPath, 'utf-8');
        this.scanResults = JSON.parse(content);
      } catch (error) {
        // Ignore parse errors
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

    const migrationsDir = join(workspaceFolders[0].uri.fsPath, '.devsync', 'migrations');
    if (existsSync(migrationsDir)) {
      try {
        const files = readdirSync(migrationsDir)
          .filter((f: string) => f.endsWith('.sql'))
          .map((f: string) => join(migrationsDir, f))
          .sort()
          .reverse(); // Most recent first
        
        this.migrationHistory = files;
      } catch (error) {
        this.migrationHistory = [];
      }
    } else {
      this.migrationHistory = [];
    }
  }
}

export class DevSyncTreeItem extends vscode.TreeItem {
  public readonly mismatch?: any;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly icon: string,
    public readonly command?: vscode.Command,
    contextValue?: string,
    description?: string,
    mismatch?: any
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

