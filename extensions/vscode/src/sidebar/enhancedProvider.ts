/**
 * Enhanced sidebar provider with progress indicators, status colors, and search functionality.
 * 
 * Provides an improved user experience with:
 * - Progress bars for long-running operations
 * - Animated loading states
 * - Color-coded status indicators
 * - Expandable/collapsible sections with memory
 * - Search/filter functionality
 * - Quick actions on hover
 */

import * as vscode from 'vscode';
import { ICliRunner } from '../interfaces';
import { ScanReport, Mismatch } from '../api';
import { safeParseScanReport } from '../types/validation';
import { getScanResultsPath, getMigrationsDir, getFilesInDir, readJsonFile } from '../utils/paths';
import { formatMismatchType } from '../utils/ui';
import { EnhancedTreeItem, TreeItemStatus, ProgressInfo } from './treeItem';
import { SidebarStateManager } from './stateManager';
import { SidebarSearchFilter } from './searchFilter';

/**
 * Operation progress information.
 */
export interface OperationProgress {
  operation: 'scan' | 'migration' | 'init';
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number; // seconds
  startTime: number;
}

/**
 * Enhanced sidebar provider with UX improvements.
 */
export class EnhancedSidebarProvider implements vscode.TreeDataProvider<EnhancedTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<EnhancedTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<EnhancedTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<EnhancedTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private cliRunner: ICliRunner;
  private scanResults: ScanReport | null = null;
  private migrationHistory: string[] = [];
  private operationProgress: Map<string, OperationProgress> = new Map();
  private stateManager: SidebarStateManager;
  private searchFilter: SidebarSearchFilter;
  private searchQuery: string = '';
  private filterPreset: 'all' | 'errors' | 'warnings' | 'info';

  constructor(cliRunner: ICliRunner, context: vscode.ExtensionContext) {
    this.cliRunner = cliRunner;
    this.stateManager = new SidebarStateManager(context);
    this.searchFilter = new SidebarSearchFilter();
    this.filterPreset = this.stateManager.getFilterPreset();
    this.searchQuery = this.stateManager.getLastSearch();
    this.loadScanResults();
    this.loadMigrationHistory();
  }

  /**
   * Refreshes the sidebar tree.
   */
  refresh(): void {
    this.loadScanResults();
    this.loadMigrationHistory();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Sets the search query and filters the tree.
   */
  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.stateManager.setLastSearch(query);
    this._onDidChangeTreeData.fire();
  }

  /**
   * Sets a filter preset (severity-based) and refreshes.
   */
  setFilterPreset(preset: 'all' | 'errors' | 'warnings' | 'info'): void {
    this.filterPreset = preset;
    this.stateManager.setFilterPreset(preset);
    this._onDidChangeTreeData.fire();
  }

  /**
   * Updates progress for an operation.
   */
  updateProgress(operation: 'scan' | 'migration' | 'init', progress: number, message: string, estimatedTimeRemaining?: number): void {
    const existing = this.operationProgress.get(operation);
    const startTime = existing?.startTime || Date.now();
    
    this.operationProgress.set(operation, {
      operation,
      progress: Math.min(100, Math.max(0, progress)),
      message,
      estimatedTimeRemaining,
      startTime
    });
    
    this._onDidChangeTreeData.fire();
  }

  /**
   * Clears progress for an operation.
   */
  clearProgress(operation: 'scan' | 'migration' | 'init'): void {
    this.operationProgress.delete(operation);
    this._onDidChangeTreeData.fire();
  }

  /**
   * Gets the tree item for a given element.
   */
  getTreeItem(element: EnhancedTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Gets children for a given element.
   */
  getChildren(element?: EnhancedTreeItem): vscode.ProviderResult<EnhancedTreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }

    const children = this.getChildrenForElement(element);
    
    // Apply search filter if query exists
    if (this.searchQuery) {
      return this.searchFilter.filter(children, this.searchQuery);
    }
    
    return children;
  }

  /**
   * Gets root items.
   */
  private getRootItems(): EnhancedTreeItem[] {
    const items: EnhancedTreeItem[] = [];

    // Commands section
    const commandsExpanded = this.stateManager.isExpanded('commands');
    items.push(new EnhancedTreeItem(
      'Commands',
      vscode.TreeItemCollapsibleState.Expanded,
      'folder',
      undefined,
      'commands',
      undefined,
      undefined,
      TreeItemStatus.Normal
    ));

    // Scan Results section
    const scanResultsExpanded = this.stateManager.isExpanded('scan-results');
    const scanStatus = this.getScanResultsStatus();
    items.push(new EnhancedTreeItem(
      'Scan Results',
      scanResultsExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
      'file',
      undefined,
      'scan-results',
      this.getScanResultsDescription(),
      undefined,
      scanStatus
    ));

    // Migrations section
    const migrationsExpanded = this.stateManager.isExpanded('migrations');
    const migrationsStatus = this.migrationHistory.length > 0 ? TreeItemStatus.Success : TreeItemStatus.Normal;
    items.push(new EnhancedTreeItem(
      'Migrations',
      migrationsExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
      'file',
      undefined,
      'migrations',
      `${this.migrationHistory.length} migration${this.migrationHistory.length !== 1 ? 's' : ''}`,
      undefined,
      migrationsStatus
    ));

    // Configuration section
    const configExpanded = this.stateManager.isExpanded('config');
    items.push(new EnhancedTreeItem(
      'Configuration',
      configExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
      'settings',
      undefined,
      'config',
      undefined,
      undefined,
      TreeItemStatus.Normal
    ));

    return items;
  }

  /**
   * Gets children for a specific element.
   */
  private getChildrenForElement(element: EnhancedTreeItem): EnhancedTreeItem[] {
    const contextValue = element.contextValue;

    if (contextValue === 'commands') {
      return this.getCommandItems();
    }

    if (contextValue === 'scan-results') {
      return this.getScanResultItems();
    }

    if (contextValue === 'summary') {
      return this.getSummaryItems();
    }

    if (contextValue === 'mismatches') {
      return this.getMismatchItems();
    }

    if (contextValue?.startsWith('mismatch-')) {
      return this.getMismatchDetailItems(element);
    }

    if (contextValue === 'migrations') {
      return this.getMigrationItems();
    }

    if (contextValue === 'config') {
      return this.getConfigItems();
    }

    return [];
  }

  /**
   * Gets command items with progress indicators.
   */
  private getCommandItems(): EnhancedTreeItem[] {
    const items: EnhancedTreeItem[] = [];

    // Scan command
    const scanProgress = this.operationProgress.get('scan');
    const scanStatus = scanProgress 
      ? TreeItemStatus.Processing 
      : this.scanResults 
        ? TreeItemStatus.Success 
        : TreeItemStatus.Normal;
    
    const scanProgressInfo = scanProgress ? {
      progress: scanProgress.progress,
      message: scanProgress.message,
      estimatedTimeRemaining: scanProgress.estimatedTimeRemaining
    } : undefined;

    items.push(new EnhancedTreeItem(
      '🔍 Scan Schema',
      vscode.TreeItemCollapsibleState.None,
      'play',
      {
        command: 'devsync.sidebar.scan',
        title: 'Scan Schema',
        arguments: []
      },
      'command-scan',
      scanProgress ? scanProgress.message : undefined,
      scanProgressInfo,
      scanStatus
    ));

    // Migration command
    const migrationProgress = this.operationProgress.get('migration');
    const migrationStatus = migrationProgress 
      ? TreeItemStatus.Processing 
      : this.migrationHistory.length > 0 
        ? TreeItemStatus.Success 
        : TreeItemStatus.Normal;
    
    const migrationProgressInfo = migrationProgress ? {
      progress: migrationProgress.progress,
      message: migrationProgress.message,
      estimatedTimeRemaining: migrationProgress.estimatedTimeRemaining
    } : undefined;

    items.push(new EnhancedTreeItem(
      '🔧 Generate Migration',
      vscode.TreeItemCollapsibleState.None,
      'tools',
      {
        command: 'devsync.sidebar.migrate',
        title: 'Generate Migration',
        arguments: []
      },
      'command-migrate',
      migrationProgress ? migrationProgress.message : undefined,
      migrationProgressInfo,
      migrationStatus
    ));

    // Initialize command
    const initProgress = this.operationProgress.get('init');
    const initStatus = initProgress ? TreeItemStatus.Processing : TreeItemStatus.Normal;
    
    const initProgressInfo = initProgress ? {
      progress: initProgress.progress,
      message: initProgress.message,
      estimatedTimeRemaining: initProgress.estimatedTimeRemaining
    } : undefined;

    items.push(new EnhancedTreeItem(
      '⚙️ Initialize Project',
      vscode.TreeItemCollapsibleState.None,
      'add',
      {
        command: 'devsync.sidebar.init',
        title: 'Initialize Project',
        arguments: []
      },
      'command-init',
      initProgress ? initProgress.message : undefined,
      initProgressInfo,
      initStatus
    ));

    items.push(new EnhancedTreeItem(
      '📊 View Output',
      vscode.TreeItemCollapsibleState.None,
      'output',
      {
        command: 'devsync.sidebar.showOutput',
        title: 'View Output',
        arguments: []
      },
      'command-output',
      undefined,
      undefined,
      TreeItemStatus.Normal
    ));

    return items;
  }

  /**
   * Gets scan result items.
   */
  private getScanResultItems(): EnhancedTreeItem[] {
    if (!this.scanResults) {
      return [
        new EnhancedTreeItem(
          'No scan results found',
          vscode.TreeItemCollapsibleState.None,
          'info',
          undefined,
          'no-results',
          'Run a scan to see results',
          undefined,
          TreeItemStatus.Warning
        )
      ];
    }

    const items: EnhancedTreeItem[] = [];
    const mismatches = this.scanResults.mismatches || [];
    const filteredMismatches = this.filterMismatches(mismatches);

    // Summary
    const summaryExpanded = this.stateManager.isExpanded('summary');
    items.push(new EnhancedTreeItem(
      `Summary: ${filteredMismatches.length} mismatch${filteredMismatches.length !== 1 ? 'es' : ''}`,
      summaryExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
      'info',
      undefined,
      'summary',
      this.getSummaryDescription(filteredMismatches),
      undefined,
      this.getSummaryStatus(filteredMismatches)
    ));

    // Mismatches
    if (filteredMismatches.length > 0) {
      const mismatchesExpanded = this.stateManager.isExpanded('mismatches');
      items.push(new EnhancedTreeItem(
        'Mismatches',
        mismatchesExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
        'warning',
        undefined,
        'mismatches',
        `${filteredMismatches.length} issue${filteredMismatches.length !== 1 ? 's' : ''} found (${this.filterPreset})`,
        undefined,
        TreeItemStatus.Warning
      ));
    }

    return items;
  }

  /**
   * Gets summary items.
   */
  private getSummaryItems(): EnhancedTreeItem[] {
    const mismatches = this.scanResults?.mismatches || [];
    const errors = mismatches.filter((m: Mismatch) => m.severity === 'error').length;
    const warnings = mismatches.filter((m: Mismatch) => m.severity === 'warning').length;
    const infos = mismatches.filter((m: Mismatch) => m.severity === 'info').length;

    return [
      new EnhancedTreeItem(
        `Total: ${mismatches.length}`,
        vscode.TreeItemCollapsibleState.None,
        'info',
        undefined,
        'stat',
        undefined,
        undefined,
        TreeItemStatus.Normal
      ),
      new EnhancedTreeItem(
        `Errors: ${errors}`,
        vscode.TreeItemCollapsibleState.None,
        'error',
        undefined,
        'stat',
        undefined,
        undefined,
        errors > 0 ? TreeItemStatus.Error : TreeItemStatus.Normal
      ),
      new EnhancedTreeItem(
        `Warnings: ${warnings}`,
        vscode.TreeItemCollapsibleState.None,
        'warning',
        undefined,
        'stat',
        undefined,
        undefined,
        warnings > 0 ? TreeItemStatus.Warning : TreeItemStatus.Normal
      ),
      new EnhancedTreeItem(
        `Info: ${infos}`,
        vscode.TreeItemCollapsibleState.None,
        'info',
        undefined,
        'stat',
        undefined,
        undefined,
        TreeItemStatus.Normal
      )
    ];
  }

  /**
   * Gets mismatch items.
   */
  private getMismatchItems(): EnhancedTreeItem[] {
    const mismatches = this.filterMismatches(this.scanResults?.mismatches || []);
    return mismatches.map((mismatch: Mismatch, index: number) => {
      const icon = mismatch.severity === 'error' ? 'error' : 'warning';
      const fieldLabel = 'field' in mismatch ? mismatch.field : 'N/A';
      const typeLabel = formatMismatchType(mismatch.type);
      const label = `${typeLabel}: ${mismatch.model}.${fieldLabel}`;
      
      const status = mismatch.severity === 'error' 
        ? TreeItemStatus.Error 
        : mismatch.severity === 'warning' 
          ? TreeItemStatus.Warning 
          : TreeItemStatus.Info;
      
      return new EnhancedTreeItem(
        label,
        vscode.TreeItemCollapsibleState.Collapsed,
        icon,
        undefined,
        `mismatch-${index}`,
        mismatch.severity,
        undefined,
        status,
        mismatch
      );
    });
  }

  /**
   * Gets mismatch detail items.
   */
  private getMismatchDetailItems(element: EnhancedTreeItem): EnhancedTreeItem[] {
    const mismatch = element.mismatch;
    if (!mismatch) {
      return [];
    }

    const items: EnhancedTreeItem[] = [];
    
    items.push(new EnhancedTreeItem(
      `Type: ${mismatch.type}`,
      vscode.TreeItemCollapsibleState.None,
      'info',
      undefined,
      'mismatch-detail',
      undefined,
      undefined,
      TreeItemStatus.Normal
    ));

    items.push(new EnhancedTreeItem(
      `Model: ${mismatch.model}`,
      vscode.TreeItemCollapsibleState.None,
      'info',
      undefined,
      'mismatch-detail',
      undefined,
      undefined,
      TreeItemStatus.Normal
    ));

    if ('field' in mismatch && mismatch.field) {
      items.push(new EnhancedTreeItem(
        `Field: ${mismatch.field}`,
        vscode.TreeItemCollapsibleState.None,
        'info',
        undefined,
        'mismatch-detail',
        undefined,
        undefined,
        TreeItemStatus.Normal
      ));
    }

    if (mismatch.severity) {
      const severityStatus = mismatch.severity === 'error' 
        ? TreeItemStatus.Error 
        : mismatch.severity === 'warning' 
          ? TreeItemStatus.Warning 
          : TreeItemStatus.Info;
      
      items.push(new EnhancedTreeItem(
        `Severity: ${mismatch.severity}`,
        vscode.TreeItemCollapsibleState.None,
        mismatch.severity === 'error' ? 'error' : 'warning',
        undefined,
        'mismatch-detail',
        undefined,
        undefined,
        severityStatus
      ));
    }

    // Add jump to source option
    items.push(new EnhancedTreeItem(
      'Jump to Source',
      vscode.TreeItemCollapsibleState.None,
      'go-to-file',
      {
        command: 'devsync.sidebar.jumpToSource',
        title: 'Jump to Source',
        arguments: [mismatch]
      },
      'mismatch-jump',
      'Open source file and navigate to model/field',
      undefined,
      TreeItemStatus.Info
    ));

    if (mismatch.suggestedFix) {
      items.push(new EnhancedTreeItem(
        'View Suggested Fix',
        vscode.TreeItemCollapsibleState.None,
        'tools',
        {
          command: 'devsync.sidebar.viewFix',
          title: 'View Fix',
          arguments: [mismatch]
        },
        'mismatch-fix',
        'Click to view and apply fix',
        undefined,
        TreeItemStatus.Success
      ));
    }

    return items;
  }

  /**
   * Gets migration items.
   */
  private getMigrationItems(): EnhancedTreeItem[] {
    if (this.migrationHistory.length === 0) {
      return [
        new EnhancedTreeItem(
          'No migrations found',
          vscode.TreeItemCollapsibleState.None,
          'info',
          undefined,
          'no-migrations',
          'Generate a migration to see it here',
          undefined,
          TreeItemStatus.Warning
        )
      ];
    }

    return this.migrationHistory.map((migration, index) => {
      const fileName = migration.split(/[/\\]/).pop() || `migration-${index}`;
      return new EnhancedTreeItem(
        fileName,
        vscode.TreeItemCollapsibleState.None,
        'file',
        {
          command: 'vscode.open',
          title: 'Open Migration',
          arguments: [vscode.Uri.file(migration)]
        },
        'migration-file',
        'Click to open',
        undefined,
        TreeItemStatus.Success
      );
    });
  }

  /**
   * Gets config items.
   */
  private getConfigItems(): EnhancedTreeItem[] {
    return [
      new EnhancedTreeItem(
        'Open Config File',
        vscode.TreeItemCollapsibleState.None,
        'settings',
        {
          command: 'devsync.sidebar.openConfig',
          title: 'Open Config',
          arguments: []
        },
        'config-open',
        undefined,
        undefined,
        TreeItemStatus.Normal
      ),
      new EnhancedTreeItem(
        'Open Settings',
        vscode.TreeItemCollapsibleState.None,
        'settings',
        {
          command: 'workbench.action.openSettings',
          title: 'Open Settings',
          arguments: ['devsync']
        },
        'config-settings',
        undefined,
        undefined,
        TreeItemStatus.Normal
      )
    ];
  }

  /**
   * Gets scan results status.
   */
  private getScanResultsStatus(): TreeItemStatus {
    if (!this.scanResults) {
      return TreeItemStatus.Warning;
    }

    const mismatches = this.scanResults.mismatches || [];
    if (mismatches.length === 0) {
      return TreeItemStatus.Success;
    }

    const hasErrors = mismatches.some((m: Mismatch) => m.severity === 'error');
    if (hasErrors) {
      return TreeItemStatus.Error;
    }

    return TreeItemStatus.Warning;
  }

  /**
   * Gets scan results description.
   */
  private getScanResultsDescription(): string | undefined {
    if (!this.scanResults) {
      return 'No scan results';
    }

    const mismatches = this.scanResults.mismatches || [];
    if (mismatches.length === 0) {
      return 'No mismatches found';
    }

    const errors = mismatches.filter((m: Mismatch) => m.severity === 'error').length;
    const warnings = mismatches.filter((m: Mismatch) => m.severity === 'warning').length;

    if (errors > 0) {
      return `${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''}`;
    }

    return `${warnings} warning${warnings !== 1 ? 's' : ''}`;
  }

  /**
   * Gets summary description.
   */
  private getSummaryDescription(mismatches: Mismatch[]): string {
    const errors = mismatches.filter((m: Mismatch) => m.severity === 'error').length;
    const warnings = mismatches.filter((m: Mismatch) => m.severity === 'warning').length;
    const infos = mismatches.filter((m: Mismatch) => m.severity === 'info').length;

    const parts: string[] = [];
    if (errors > 0) parts.push(`${errors} error${errors !== 1 ? 's' : ''}`);
    if (warnings > 0) parts.push(`${warnings} warning${warnings !== 1 ? 's' : ''}`);
    if (infos > 0) parts.push(`${infos} info`);

    return parts.join(', ') || 'No issues';
  }

  /**
   * Gets summary status.
   */
  private getSummaryStatus(mismatches: Mismatch[]): TreeItemStatus {
    if (mismatches.length === 0) {
      return TreeItemStatus.Success;
    }

    const hasErrors = mismatches.some((m: Mismatch) => m.severity === 'error');
    if (hasErrors) {
      return TreeItemStatus.Error;
    }

    return TreeItemStatus.Warning;
  }

  /**
   * Filters mismatches by the current preset.
   */
  private filterMismatches(mismatches: Mismatch[]): Mismatch[] {
    switch (this.filterPreset) {
      case 'errors':
        return mismatches.filter((m) => m.severity === 'error');
      case 'warnings':
        // "Warnings + Errors" preset: show both warnings and errors
        return mismatches.filter((m) => m.severity === 'warning' || m.severity === 'error');
      case 'info':
        return mismatches.filter((m) => m.severity === 'info');
      default:
        return mismatches;
    }
  }

  /**
   * Handles tree item expansion/collapse to persist state.
   */
  handleItemExpansion(element: EnhancedTreeItem, expanded: boolean): void {
    if (element.contextValue) {
      this.stateManager.setExpanded(element.contextValue, expanded);
    }
  }

  /**
   * Loads scan results.
   */
  private async loadScanResults(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const scanResultsPath = getScanResultsPath(workspaceFolders[0]);
    const parsed = readJsonFile<unknown>(scanResultsPath);
    
    if (parsed) {
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

  /**
   * Loads migration history.
   */
  private loadMigrationHistory(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const migrationsDir = getMigrationsDir(workspaceFolders[0]);
    const files = getFilesInDir(migrationsDir, /\.sql$/);
    this.migrationHistory = files.sort().reverse();
  }
}

