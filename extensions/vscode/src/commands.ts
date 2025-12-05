import * as vscode from 'vscode';
import { ICommands, IDiagnostics, IConfigurationManager, IStateStore } from './interfaces';
import { IScanService, IMigrationService } from './services';
import { ScanError, MigrationError } from './errors';
import { ErrorLogger } from './errors/logger';
import { ErrorBoundary } from './errors/boundary';
import { EnhancedRecovery } from './errors/enhancedRecovery';
import { scanActions, migrationActions } from './state';
import { NotificationService, StatusBarService, EditorService } from './ui';
import { PluginRegistry } from './plugins';
import {
  ProgressTracker,
  TaskQueue,
  PreviewManager,
  StatusReporter,
  StatusLevel,
} from './execution';
import type { SecurityManager } from './security';

/**
 * Handles DevSync extension commands.
 * 
 * Provides high-level command implementations that integrate with VS Code's
 * command system. Commands automatically handle error management, state updates,
 * user feedback, and diagnostics refresh.
 * 
 * All commands are wrapped with error boundaries to ensure consistent error
 * handling and user-friendly error messages.
 * 
 * @example
 * ```typescript
 * const commands = new DevSyncCommands(
 *   apiClient,
 *   diagnostics,
 *   errorLogger,
 *   configManager,
 *   stateStore
 * );
 * await commands.scan();
 * ```
 */
export class DevSyncCommands implements ICommands {
  private errorBoundary: ErrorBoundary;
  private enhancedRecovery: EnhancedRecovery;
  private notifications: NotificationService;
  private statusBar: StatusBarService;
  private editor: EditorService;
  private taskQueue: TaskQueue;
  private previewManager: PreviewManager;
  private statusReporter: StatusReporter;
  private securityManager?: SecurityManager;

  /**
   * Creates a new commands handler instance.
   * 
   * Uses service layer for business logic and UI layer for presentation.
   * This separation allows business logic to be tested independently.
   * 
   * @param scanService - Service for scan operations
   * @param migrationService - Service for migration operations
   * @param diagnostics - Diagnostics provider for showing mismatches
   * @param errorLogger - Error logger for tracking errors
   * @param configManager - Configuration manager for accessing settings
   * @param stateStore - State store for managing application state
   * @param pluginRegistry - Optional plugin registry
   * @param securityManager - Optional security manager for permission checks
   */
  constructor(
    private scanService: IScanService,
    private migrationService: IMigrationService,
    private diagnostics: IDiagnostics,
    private errorLogger: ErrorLogger,
    private configManager: IConfigurationManager,
    private stateStore: IStateStore,
    private pluginRegistry?: PluginRegistry,
    securityManager?: SecurityManager
  ) {
    this.securityManager = securityManager;
    this.errorBoundary = new ErrorBoundary(errorLogger);
    this.enhancedRecovery = new EnhancedRecovery(stateStore);
    this.notifications = new NotificationService();
    this.statusBar = new StatusBarService();
    this.editor = new EditorService();
    this.taskQueue = new TaskQueue();
    this.previewManager = new PreviewManager();
    this.statusReporter = new StatusReporter();

    // Set up task queue event handlers
    this.setupTaskQueueHandlers();
  }

  /**
   * Sets up task queue event handlers.
   */
  private setupTaskQueueHandlers(): void {
    this.taskQueue.onTaskStarted(({ taskId, task }) => {
      this.statusReporter.report({
        level: StatusLevel.INFO,
        message: `Starting: ${task.name}`,
        details: task.description,
      });
    });

    this.taskQueue.onTaskCompleted((result) => {
      const task = this.taskQueue.getRunningTask();
      if (task) {
        this.statusReporter.reportCompletion(
          `${task.name} completed`,
          result.duration
        );
      }
    });

    this.taskQueue.onTaskFailed((result) => {
      this.statusReporter.reportError(
        `Task failed: ${result.taskId}`,
        result.error
      );
    });
  }

  /**
   * Scans the workspace for schema mismatches.
   * 
   * This command:
   * 1. Validates configuration (API URL, API key, project ID)
   * 2. Dispatches scan start action to state store
   * 3. Triggers scan via API client
   * 4. Updates diagnostics with detected mismatches
   * 5. Dispatches scan complete action
   * 6. Shows status bar feedback and completion message
   * 
   * @returns Promise that resolves when scan is complete
   * @throws {ScanError} If configuration is invalid or scan fails
   */
  async scan() {
    return this.errorBoundary.wrap(async () => {
      // Check permission
      if (this.securityManager) {
        if (!this.securityManager.checkPermission('scan', 'execute')) {
          await this.notifications.showError('Permission denied: You do not have permission to execute scans.');
          throw ScanError.fromError(new Error('Permission denied'), { operation: 'scan' });
        }
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw ScanError.noWorkspace();
      }

      const workspaceFolder = workspaceFolders[0];
      const databaseConnection = this.configManager.get('databaseConnection') || '';

      // Create progress tracker
      const progressTracker = new ProgressTracker();
      const startTime = Date.now();

      // Set up progress reporting
      const progressDisposable = progressTracker.onProgressUpdate((update) => {
        this.statusReporter.reportProgress(update);
      });

      try {
        // Step 1: Validate scan
        progressTracker.start(4, 'Validating configuration...');
        const validation = this.scanService.validateScan(workspaceFolder.uri.fsPath);
        if (!validation.valid) {
          this.stateStore.dispatch(scanActions.fail('Invalid configuration'));
          throw ScanError.invalidConfig(validation.missingFields || []);
        }
        progressTracker.nextStep('Configuration validated');

        // Step 2: Dispatch scan start action
        this.stateStore.dispatch(scanActions.start());
        progressTracker.nextStep('Starting scan...');

        // Step 3: Execute scan via service
        progressTracker.update(50, 'Scanning schema...');
        const result = await this.scanService.executeScan(workspaceFolder.uri.fsPath, databaseConnection);

        if (!result.success) {
          this.stateStore.dispatch(scanActions.fail(result.error || 'Scan failed'));
          throw ScanError.fromError(new Error(result.error || 'Scan failed'), {
            workspacePath: workspaceFolder.uri.fsPath,
          });
        }
        progressTracker.nextStep('Scan completed');

        // Step 4: Process results
        progressTracker.update(90, 'Processing results...');
        this.stateStore.dispatch(scanActions.complete(result.report));

        // Execute extension point for scan completion
        if (this.pluginRegistry) {
          await this.pluginRegistry.executeExtensionPoint('devsync.scan.complete', result.report);
        }

        // Refresh diagnostics
        await this.diagnostics.checkWorkspace(workspaceFolder);

        const duration = Date.now() - startTime;
        progressTracker.complete('Scan complete');
        this.statusReporter.reportCompletion(
          `Scan complete! Found ${result.report.mismatches.length} mismatch(es)`,
          duration
        );
      } catch (error) {
        progressTracker.complete('Scan failed');
        this.stateStore.dispatch(scanActions.fail(error instanceof Error ? error.message : String(error)));
        this.statusReporter.reportError(
          'Scan failed',
          error instanceof Error ? error : new Error(String(error)),
          ['Retry', 'Dismiss']
        );
        throw ScanError.fromError(error instanceof Error ? error : new Error(String(error)), {
          workspacePath: workspaceFolder.uri.fsPath,
        });
      } finally {
        progressDisposable.dispose();
      }
    }, { operation: 'scan' });
  }

  async generateMigration() {
    return this.errorBoundary.wrap(async () => {
      // Check permission
      if (this.securityManager) {
        if (!this.securityManager.checkPermission('migrate', 'execute')) {
          await this.notifications.showError('Permission denied: You do not have permission to generate migrations.');
          throw MigrationError.fromError(new Error('Permission denied'), { operation: 'generateMigration' });
        }
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw MigrationError.fromError(new Error('No workspace folder open'));
      }

      try {
        // Business Logic: Get latest scan report
        const scanReport = await this.scanService.getLatestScanReport();

        if (!scanReport) {
          this.stateStore.dispatch(migrationActions.fail('No scan report found'));
          throw MigrationError.noScanReport();
        }

        // Business Logic: Validate migration
        const validation = await this.migrationService.validateMigration(scanReport.id);
        if (!validation.valid) {
          if (validation.error?.includes('No mismatches')) {
            // UI: Show info message for no mismatches
            await this.notifications.showInfo('DevSync: No mismatches found. Everything is in sync!');
            return;
          }
          this.stateStore.dispatch(migrationActions.fail(validation.error || 'Validation failed'));
          throw MigrationError.fromError(new Error(validation.error || 'Validation failed'));
        }

        // Business Logic: Dispatch migration start action
        this.stateStore.dispatch(migrationActions.start());

        // Business Logic: Generate migration via service
        const result = await this.migrationService.generateMigration(scanReport.id);

        if (!result.success) {
          this.stateStore.dispatch(migrationActions.fail(result.error || 'Migration generation failed'));
          throw MigrationError.fromError(new Error(result.error || 'Migration generation failed'));
        }

        // Business Logic: Dispatch migration complete action
        this.stateStore.dispatch(migrationActions.complete(result.migration));

        // Execute extension point for migration generation
        if (this.pluginRegistry) {
          await this.pluginRegistry.executeExtensionPoint('devsync.migration.generated', result.migration);
        }

        // UI: Show migration in editor
        await this.editor.openDocument('Migration generated', result.migration.content, 'sql');

        // UI: Show completion message
        await this.notifications.showInfo('DevSync: Migration generated! Review and apply manually.');
      } catch (error) {
        this.stateStore.dispatch(migrationActions.fail(error instanceof Error ? error.message : String(error)));
        if (error instanceof MigrationError) {
          throw error;
        }
        throw MigrationError.fromError(error instanceof Error ? error : new Error(String(error)));
      }
    }, { operation: 'generateMigration' });
  }

  async viewReport() {
    return this.errorBoundary.wrap(async () => {
      // Check permission
      if (this.securityManager) {
        if (!this.securityManager.checkPermission('view_reports', 'read')) {
          await this.notifications.showError('Permission denied: You do not have permission to view reports.');
          throw ScanError.fromError(new Error('Permission denied'), { operation: 'viewReport' });
        }
      }

      try {
        // Business Logic: Get latest scan report
        const scanReport = await this.scanService.getLatestScanReport();

        if (!scanReport) {
          // UI: Show warning and offer to run scan
          const action = await this.notifications.showWarning(
            'No scan report found. Run a scan first.',
            'Run Scan',
            'Dismiss'
          );

          if (action === 'Run Scan') {
            await this.scan();
          }
          return;
        }

        // UI: Open dashboard in browser
        const dashboardUrl = this.scanService.getDashboardUrl();
        await this.notifications.openExternal(dashboardUrl);
      } catch (error) {
        throw ScanError.fromError(error instanceof Error ? error : new Error(String(error)), {
          operation: 'viewReport',
        });
      }
    }, { operation: 'viewReport' });
  }

  async openDashboard() {
    // UI: Open dashboard
    const dashboardUrl = this.scanService.getDashboardUrl();
    await this.notifications.openExternal(dashboardUrl);
  }

  /**
   * Pauses the task queue.
   */
  pauseQueue(): void {
    this.taskQueue.pause();
    this.statusReporter.report({
      level: StatusLevel.INFO,
      message: 'Task queue paused',
    });
  }

  /**
   * Resumes the task queue.
   */
  resumeQueue(): void {
    this.taskQueue.resume();
    this.statusReporter.report({
      level: StatusLevel.INFO,
      message: 'Task queue resumed',
    });
  }

  /**
   * Gets task queue status.
   */
  getQueueStatus(): {
    isPaused: boolean;
    queueLength: number;
    runningTask: string | null;
  } {
    const status = this.taskQueue.getStatus();
    return {
      isPaused: status.isPaused,
      queueLength: status.queueLength,
      runningTask: status.runningTask?.name || null,
    };
  }

  /**
   * Undoes the last operation.
   */
  async undoLast(): Promise<void> {
    await this.enhancedRecovery.undoLast();
    this.statusReporter.report({
      level: StatusLevel.INFO,
      message: 'Last operation undone',
    });
  }
}

