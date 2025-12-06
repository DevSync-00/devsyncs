import * as vscode from 'vscode';
import { ScanReport, Migration, Mismatch } from '../api';
import { CliCommandResult, CliRunHooks } from '../cliRunner';
import type { AuthSessionState } from '../types';
import type { AiQueryResult } from '../types';

/**
 * Interface for API client operations.
 * 
 * Provides methods to interact with the DevSync API for scanning schemas,
 * generating migrations, and retrieving reports.
 * 
 * @example
 * ```typescript
 * const apiClient = container.getApiClient();
 * const report = await apiClient.scan('/path/to/project', 'postgresql://...');
 * ```
 */
export interface IApiClient {
  /**
   * Scans a project for schema mismatches between code and database.
   * 
   * @param path - The path to the project root directory
   * @param databaseConnection - Optional database connection string
   * @returns Promise resolving to a scan report with detected mismatches
   * @throws {ScanError} If the scan fails or configuration is invalid
   * 
   * @example
   * ```typescript
   * const report = await apiClient.scan(
   *   '/path/to/project',
   *   'postgresql://user:pass@localhost:5432/db'
   * );
   * console.log(`Found ${report.mismatches.length} mismatches`);
   * ```
   */
  scan(path: string, databaseConnection?: string): Promise<ScanReport>;
  
  /**
   * Retrieves a list of scan reports, optionally limited to a specific count.
   * 
   * @param limit - Maximum number of reports to retrieve (default: all)
   * @returns Promise resolving to an array of scan reports
   */
  getScanReports(limit?: number): Promise<ScanReport[]>;
  
  /**
   * Gets the most recent scan report for the current project.
   * 
   * @returns Promise resolving to the latest scan report, or null if none exists
   */
  getLatestScanReport(): Promise<ScanReport | null>;
  
  /**
   * Generates a migration file based on a scan report.
   * 
   * @param scanReportId - The ID of the scan report to use
   * @param format - Migration format (default: 'sql')
   * @returns Promise resolving to the generated migration
   * @throws {MigrationError} If migration generation fails
   */
  generateMigration(scanReportId: string, format?: string): Promise<Migration>;
  
  /**
   * Retrieves migrations associated with a scan report.
   * 
   * @param scanReportId - Optional scan report ID to filter migrations
   * @returns Promise resolving to an array of migrations
   */
  getMigrations(scanReportId?: string): Promise<Migration[]>;
  
  /**
   * Gets a single migration by ID.
   * 
   * @param migrationId - The ID of the migration to retrieve
   * @returns Promise resolving to the migration, or null if not found
   */
  getMigration(migrationId: string): Promise<Migration | null>;
  
  /**
   * Gets the dashboard URL for the current configuration.
   * 
   * @returns The dashboard URL, or empty string if not configured
   */
  getDashboardUrl(): string;
}

/**
 * Interface for CLI runner operations.
 * 
 * Handles execution of DevSync CLI commands and manages the CLI build process.
 * 
 * @example
 * ```typescript
 * const cliRunner = container.getCliRunner();
 * const available = await cliRunner.checkCliAvailable();
 * if (!available) {
 *   await cliRunner.buildCli();
 * }
 * ```
 */
export interface ICliRunner {
  /**
   * Checks if the DevSync CLI is available and built.
   * 
   * @returns Promise resolving to true if CLI is available, false otherwise
   */
  checkCliAvailable(): Promise<boolean>;
  
  /**
   * Builds the DevSync CLI from source.
   * 
   * @returns Promise resolving to the build result
   * @throws {Error} If the build process fails
   */
  buildCli(): Promise<CliCommandResult>;
  
  /**
   * Executes a DevSync CLI command.
   * 
   * @param command - The command to execute ('scan', 'migrate', or 'init')
   * @param options - Optional command-specific options
   * @param cancelToken - Optional cancellation token to abort the command
   * @param hooks - Optional hooks for stdout, stderr, and close events
   * @returns Promise resolving to the command result
   * 
   * @example
   * ```typescript
   * const result = await cliRunner.executeCliCommand('scan', {
   *   db: 'postgresql://...',
   *   output: '/path/to/output.json'
   * });
   * if (result.success) {
   *   console.log('Scan completed successfully');
   * }
   * ```
   */
  executeCliCommand(
    command: 'scan' | 'migrate' | 'init',
    options?: Record<string, any>,
    cancelToken?: vscode.CancellationToken,
    hooks?: CliRunHooks
  ): Promise<CliCommandResult>;
  
  /**
   * Cancels all currently running CLI commands.
   */
  cancelAll(): void;
  
  /**
   * Shows the CLI output channel in VS Code.
   */
  showOutput(): void;
}

/**
 * Interface for authentication management.
 * 
 * Handles OAuth device flow authentication and token management for the DevSync analyzer service.
 * 
 * @example
 * ```typescript
 * const authManager = container.getAuthManager();
 * const session = await authManager.startDeviceFlow((update) => {
 *   console.log('Auth status:', update.status);
 * });
 * ```
 */
export interface IAuthManager {
  /**
   * Event fired when the authentication session changes.
   * 
   * @readonly
   */
  get onDidChangeSession(): vscode.Event<AuthSessionState>;
  
  /**
   * Gets the current authentication session state.
   * 
   * @returns The current session state (logged in, logged out, or expired)
   */
  getSession(): AuthSessionState;
  
  /**
   * Sets the analyzer URL for authentication.
   * 
   * @param url - The base URL of the analyzer service
   */
  setAnalyzerUrl(url: string): void;
  
  /**
   * Ensures a valid access token is available, refreshing if necessary.
   * 
   * @returns Promise resolving to a valid access token
   * @throws {AuthError} If authentication fails or token cannot be obtained
   */
  ensureAccessToken(): Promise<string>;
  
  /**
   * Starts the OAuth device flow authentication process.
   * 
   * @param progress - Optional callback to receive progress updates
   * @returns Promise resolving to the authenticated session state
   * @throws {AuthError} If authentication fails
   * 
   * @example
   * ```typescript
   * const session = await authManager.startDeviceFlow((update) => {
   *   if (update.status === 'device_code') {
   *     vscode.window.showInformationMessage(
   *       `Visit ${update.verificationUri} and enter code: ${update.userCode}`
   *     );
   *   }
   * });
   * ```
   */
  startDeviceFlow(progress?: (update: import('../auth').AuthFlowUpdate) => void): Promise<AuthSessionState>;
  
  /**
   * Logs out the current user and clears stored tokens.
   * 
   * @returns Promise that resolves when logout is complete
   */
  logout(): Promise<void>;
}

/**
 * Interface for chat API client
 */
export interface IChatApiClient {
  setApiUrl(apiUrl: string): void;
  getLatestScanReport(projectId: string): Promise<ScanReport | null>;
  queryAI(question: string, scanReportId: string, signal?: AbortSignal): Promise<AiQueryResult>;
}

/**
 * Interface for diagnostics provider
 */
export interface IDiagnostics {
  checkWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<void>;
  clear(): void;
}

/**
 * Interface for DevSync command handlers.
 * 
 * Provides high-level commands that can be invoked from VS Code command palette
 * or other UI components. Commands handle error management, state updates, and
 * user feedback automatically.
 * 
 * @example
 * ```typescript
 * const commands = container.getCommands();
 * await commands.scan(); // Scans the workspace for schema mismatches
 * ```
 */
export interface ICommands {
  /**
   * Scans the workspace for schema mismatches between Prisma schema and database.
   * 
   * Displays progress in the status bar and shows diagnostics when complete.
   * 
   * @returns Promise that resolves when the scan is complete
   * @throws {ScanError} If the scan fails or configuration is invalid
   * 
   * @example
   * ```typescript
   * try {
   *   await commands.scan();
   *   vscode.window.showInformationMessage('Scan completed successfully');
   * } catch (error) {
   *   vscode.window.showErrorMessage(`Scan failed: ${error.message}`);
   * }
   * ```
   */
  scan(): Promise<void>;
  
  /**
   * Generates a migration file based on the latest scan report.
   * 
   * Opens the generated migration in a new editor tab.
   * 
   * @returns Promise that resolves when the migration is generated
   * @throws {MigrationError} If no scan report exists or generation fails
   */
  generateMigration(): Promise<void>;
  
  /**
   * Opens the latest scan report in a new editor tab.
   * 
   * @returns Promise that resolves when the report is opened
   * @throws {Error} If no scan report is available
   */
  viewReport(): Promise<void>;
  
  /**
   * Opens the DevSync dashboard in the default browser.
   * 
   * @returns Promise that resolves when the dashboard is opened
   */
  openDashboard(): Promise<void>;

  /**
   * Pauses the task queue.
   */
  pauseQueue(): void;

  /**
   * Resumes the task queue.
   */
  resumeQueue(): void;

  /**
   * Gets task queue status.
   */
  getQueueStatus(): {
    isPaused: boolean;
    queueLength: number;
    runningTask: string | null;
  };

  /**
   * Undoes the last operation.
   */
  undoLast(): Promise<void>;
}

/**
 * Interface for code actions provider
 */
export interface ICodeActions extends vscode.CodeActionProvider {}

/**
 * Configuration interface for extension
 */
export interface IExtensionConfig {
  apiUrl: string;
  apiKey: string;
  projectId: string;
  analyzerUrl: string;
  databaseConnection?: string;
  enableDiagnostics?: boolean;
  autoScan?: boolean;
}

/**
 * Interface for configuration manager
 */
export interface IConfigurationManager {
  get<K extends keyof import('../config').DevSyncConfig>(key: K): import('../config').DevSyncConfig[K];
  getAll(): import('../config').DevSyncConfig;
  getSource(key: keyof import('../config').DevSyncConfig): import('../config').ConfigSource;
  update<K extends keyof import('../config').DevSyncConfig>(
    key: K,
    value: import('../config').DevSyncConfig[K],
    target?: vscode.ConfigurationTarget
  ): Promise<void>;
  validate(): import('../config').ValidationResult;
  isValid(): boolean;
  getMissingRequired(): string[];
  onDidChangeConfig: vscode.Event<import('../config').ConfigChangeEvent>;
}

/**
 * Interface for state store
 */
export interface IStateStore {
  getState(): import('../state').AppState;
  getStateSlice<K extends keyof import('../state').AppState>(slice: K): import('../state').AppState[K];
  dispatch(action: import('../state').Action): void;
  subscribe(callback: (event: import('../state').StateChangeEvent) => void): vscode.Disposable;
  subscribeToSlice<K extends keyof import('../state').AppState>(
    slice: K,
    callback: (newValue: import('../state').AppState[K], previousValue: import('../state').AppState[K]) => void
  ): vscode.Disposable;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  reset(): void;
  onStateChange: vscode.Event<import('../state').StateChangeEvent>;
}

