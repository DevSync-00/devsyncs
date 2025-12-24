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
        progressTracker.start(5, 'Validating configuration...');
        this.statusReporter.report({ level: StatusLevel.INFO, message: 'Preparing to scan...' });
        const validation = this.scanService.validateScan(workspaceFolder.uri.fsPath);
        if (!validation.valid) {
          const missingFields = validation.missingFields || [];
          const errorMsg = missingFields.length > 0 
            ? `Missing required configuration: ${missingFields.join(', ')}. Please configure these settings in VS Code settings.`
            : 'Invalid configuration. Please check your DevSync settings.';
          this.stateStore.dispatch(scanActions.fail(errorMsg));
          await this.notifications.showError(errorMsg, 'Open Settings', 'Dismiss').then(action => {
            if (action === 'Open Settings') {
              vscode.commands.executeCommand('workbench.action.openSettings', 'devsync');
            }
          });
          throw ScanError.invalidConfig(missingFields);
        }
        progressTracker.nextStep('Configuration validated ✓');

        // Step 2: Auto-detect project if needed
        progressTracker.update(20, 'Detecting project...');
        this.statusReporter.report({ level: StatusLevel.INFO, message: 'Detecting project...' });
        
        // Step 3: Dispatch scan start action
        this.stateStore.dispatch(scanActions.start());
        progressTracker.update(30, 'Starting scan...');
        this.statusReporter.report({ level: StatusLevel.INFO, message: 'Starting scan...' });

        // Step 4: Execute scan via service
        progressTracker.update(50, 'Scanning codebase and database...');
        this.statusReporter.report({ level: StatusLevel.INFO, message: 'Scanning codebase and database... This may take a minute.' });
        const result = await this.scanService.executeScan(workspaceFolder.uri.fsPath, databaseConnection);

        if (!result.success) {
          const errorMsg = result.error || 'Scan failed';
          this.stateStore.dispatch(scanActions.fail(errorMsg));
          
          // Provide helpful error message with actionable steps
          const isAuthError = errorMsg.includes('Authentication') || errorMsg.includes('Unauthorized') || errorMsg.includes('sign in');
          const isNetworkError = errorMsg.includes('network') || errorMsg.includes('connection') || errorMsg.includes('timeout');
          
          if (isAuthError) {
            await this.notifications.showError(
              'Authentication required. Please sign in to continue.',
              'Sign In',
              'Dismiss'
            ).then(action => {
              if (action === 'Sign In') {
                vscode.commands.executeCommand('devsync.chat.login');
              }
            });
          } else if (isNetworkError) {
            await this.notifications.showError(
              'Network error. Please check your connection and try again.',
              'Retry',
              'Dismiss'
            ).then(action => {
              if (action === 'Retry') {
                this.scan();
              }
            });
          } else {
            await this.notifications.showError(errorMsg, 'View Details', 'Dismiss');
          }
          
          throw ScanError.fromError(new Error(errorMsg), {
            workspacePath: workspaceFolder.uri.fsPath,
          });
        }
        progressTracker.nextStep('Scan completed ✓');

        // Step 5: Process results
        progressTracker.update(90, 'Processing results...');
        this.statusReporter.report({ level: StatusLevel.INFO, message: 'Processing scan results...' });
        this.stateStore.dispatch(scanActions.complete(result.report));

        // Execute extension point for scan completion
        if (this.pluginRegistry) {
          await this.pluginRegistry.executeExtensionPoint('devsync.scan.complete', result.report);
        }

        // Refresh diagnostics
        await this.diagnostics.checkWorkspace(workspaceFolder);

        const duration = Date.now() - startTime;
        progressTracker.complete('Scan complete ✓');
        
        // Show user-friendly success message
        const mismatchCount = result.report.mismatches.length;
        const successMessage = mismatchCount === 0
          ? '✅ Scan complete! No mismatches found. Your schema is in sync!'
          : `✅ Scan complete! Found ${mismatchCount} mismatch${mismatchCount === 1 ? '' : 'es'}.`;
        
        this.statusReporter.reportCompletion(successMessage, duration);
        
        // Show notification with actionable options
        if (mismatchCount > 0) {
          await this.notifications.showInfo(
            successMessage,
            'View Report',
            'Generate Migration',
            'Dismiss'
          ).then(action => {
            if (action === 'View Report') {
              this.viewReport();
            } else if (action === 'Generate Migration') {
              this.generateMigration();
            }
          });
        } else {
          await this.notifications.showInfo(successMessage);
        }
      } catch (error) {
        progressTracker.complete('Scan failed ✗');
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.stateStore.dispatch(scanActions.fail(errorMessage));
        
        // Provide user-friendly error message
        let userMessage = 'Scan failed. ';
        if (errorMessage.includes('timeout')) {
          userMessage += 'The scan took too long. Try scanning a smaller portion of your codebase or check your network connection.';
        } else if (errorMessage.includes('Authentication') || errorMessage.includes('Unauthorized')) {
          userMessage += 'Please sign in to DevSync to continue.';
        } else {
          userMessage += errorMessage;
        }
        
        this.statusReporter.reportError(
          userMessage,
          error instanceof Error ? error : new Error(String(error)),
          ['Retry', 'View Details', 'Dismiss']
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

        // Show validation results if available
        if (result.migration.validation) {
          const validation = result.migration.validation;
          if (!validation.valid) {
            const errorCount = validation.summary.errorCount;
            const warningCount = validation.summary.warningCount;
            const breakingCount = validation.summary.breakingChangeCount;
            
            await this.notifications.showWarning(
              `Migration generated with ${errorCount} error${errorCount !== 1 ? 's' : ''}, ${warningCount} warning${warningCount !== 1 ? 's' : ''}, ${breakingCount} breaking change${breakingCount !== 1 ? 's' : ''}. Review validation results.`,
              'View Details',
              'Dismiss'
            );
          } else if (validation.summary.warningCount > 0 || validation.summary.breakingChangeCount > 0) {
            await this.notifications.showWarning(
              `Migration generated with ${validation.summary.warningCount} warning${validation.summary.warningCount !== 1 ? 's' : ''} and ${validation.summary.breakingChangeCount} breaking change${validation.summary.breakingChangeCount !== 1 ? 's' : ''}. Review before applying.`,
              'View Details',
              'Dismiss'
            );
          } else {
            await this.notifications.showInfo('DevSync: Migration generated and validated successfully!');
          }
        } else {
          await this.notifications.showInfo('DevSync: Migration generated! Review and apply manually.');
        }

        // UI: Show migration in editor
        await this.editor.openDocument('Migration generated', result.migration.content, 'sql');
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

