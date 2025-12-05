import * as vscode from 'vscode';
import {
  IApiClient,
  ICliRunner,
  IAuthManager,
  IChatApiClient,
  IDiagnostics,
  ICommands,
  ICodeActions,
  IExtensionConfig,
  IConfigurationManager,
} from '../interfaces';
import { DevSyncApiClient } from '../api';
import { CliRunner } from '../cliRunner';
import { AuthManager } from '../auth';
import { ChatApiClient } from '../apiClient';
import { DevSyncDiagnostics } from '../diagnostics';
import { DevSyncCommands } from '../commands';
import { DevSyncCodeActions } from '../codeActions';
import { ErrorLogger } from '../errors/logger';
import { ConfigurationManager } from '../config';
import { StateStore } from '../state';
import {
  IScanService,
  IMigrationService,
  IReportService,
  IScanRepository,
  IMigrationRepository,
} from '../services';
import {
  ScanService,
  MigrationService,
  ReportService,
  ScanRepository,
  MigrationRepository,
} from '../services';
import { PluginRegistry, PluginLoader, DefaultAiProviderPlugin } from '../plugins';

/**
 * Dependency Injection Container
 * Manages creation and lifecycle of all components
 */
export class DIContainer {
  private services: Map<string, any> = new Map();
  private context: vscode.ExtensionContext;
  private configManager: ConfigurationManager;
  private pluginRegistry?: PluginRegistry;

  constructor(context: vscode.ExtensionContext, configManager: ConfigurationManager) {
    this.context = context;
    this.configManager = configManager;
  }

  /**
   * Register a service instance
   */
  register<T>(key: string, instance: T): void {
    this.services.set(key, instance);
  }

  /**
   * Get a service instance
   */
  get<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service ${key} not found in container`);
    }
    return service as T;
  }

  /**
   * Check if a service is registered
   */
  has(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * Get or create Configuration Manager
   */
  getConfigurationManager(): IConfigurationManager {
    return this.configManager;
  }

  /**
   * Get or create API client
   */
  getApiClient(): IApiClient {
    const key = 'apiClient';
    if (!this.has(key)) {
      const config = this.configManager.getAll();
      const client = new DevSyncApiClient(
        config.apiUrl,
        config.apiKey,
        config.projectId
      );
      this.register(key, client);
    }
    return this.get<IApiClient>(key);
  }

  /**
   * Get or create CLI runner
   */
  getCliRunner(): ICliRunner {
    const key = 'cliRunner';
    if (!this.has(key)) {
      const outputChannel = vscode.window.createOutputChannel('DevSync CLI');
      this.context.subscriptions.push(outputChannel);
      const runner = new CliRunner(outputChannel);
      this.register(key, runner);
    }
    return this.get<ICliRunner>(key);
  }

  /**
   * Get or create Auth Manager
   */
  getAuthManager(): IAuthManager {
    const key = 'authManager';
    if (!this.has(key)) {
      const config = this.configManager.getAll();
      const manager = new AuthManager(this.context, config.analyzerUrl);
      this.register(key, manager);
    }
    return this.get<IAuthManager>(key);
  }

  /**
   * Get or create Chat API Client
   */
  getChatApiClient(): IChatApiClient {
    const key = 'chatApiClient';
    if (!this.has(key)) {
      const config = this.configManager.getAll();
      const authManager = this.getAuthManager();
      const client = new ChatApiClient(config.apiUrl, authManager);
      this.register(key, client);
    }
    return this.get<IChatApiClient>(key);
  }

  /**
   * Get or create Diagnostics
   */
  getDiagnostics(): IDiagnostics {
    const key = 'diagnostics';
    if (!this.has(key)) {
      const apiClient = this.getApiClient();
      const diagnostics = new DevSyncDiagnostics(apiClient, this.context);
      this.register(key, diagnostics);
    }
    return this.get<IDiagnostics>(key);
  }

  /**
   * Get or create Commands
   */
  getCommands(): ICommands {
    const key = 'commands';
    if (!this.has(key)) {
      const scanService = this.getScanService();
      const migrationService = this.getMigrationService();
      const diagnostics = this.getDiagnostics();
      const errorLogger = this.getErrorLogger();
      const configManager = this.getConfigurationManager();
      const stateStore = this.getStateStore();
      const pluginRegistry = this.getPluginRegistry();
      // Get security manager if available (optional)
      const securityManager = this.has('securityManager')
        ? this.get<import('../security/integration').SecurityManager>('securityManager')
        : undefined;
      const commands = new DevSyncCommands(
        scanService,
        migrationService,
        diagnostics,
        errorLogger,
        configManager,
        stateStore,
        pluginRegistry,
        securityManager
      );
      this.register(key, commands);
    }
    return this.get<ICommands>(key);
  }

  /**
   * Get or create Code Actions
   */
  getCodeActions(): ICodeActions {
    const key = 'codeActions';
    if (!this.has(key)) {
      const apiClient = this.getApiClient();
      const diagnostics = this.getDiagnostics();
      const codeActions = new DevSyncCodeActions(apiClient, diagnostics);
      this.register(key, codeActions);
    }
    return this.get<ICodeActions>(key);
  }

  /**
   * Get or create Error Logger
   */
  getErrorLogger(): ErrorLogger {
    const key = 'errorLogger';
    if (!this.has(key)) {
      const logger = new ErrorLogger('DevSync Errors');
      this.context.subscriptions.push(logger);
      this.register(key, logger);
    }
    return this.get<ErrorLogger>(key);
  }

  /**
   * Get or create State Store
   */
  getStateStore(): import('../interfaces').IStateStore {
    const key = 'stateStore';
    if (!this.has(key)) {
      const store = new StateStore(this.context);
      this.context.subscriptions.push({ dispose: () => store.dispose() });
      this.register(key, store);
    }
    return this.get<import('../interfaces').IStateStore>(key);
  }

  /**
   * Get or create Scan Service
   */
  getScanService(): IScanService {
    const key = 'scanService';
    if (!this.has(key)) {
      const apiClient = this.getApiClient();
      const configManager = this.getConfigurationManager();
      const service = new ScanService(apiClient, configManager);
      this.register(key, service);
    }
    return this.get<IScanService>(key);
  }

  /**
   * Get or create Migration Service
   */
  getMigrationService(): IMigrationService {
    const key = 'migrationService';
    if (!this.has(key)) {
      const apiClient = this.getApiClient();
      const service = new MigrationService(apiClient);
      this.register(key, service);
    }
    return this.get<IMigrationService>(key);
  }

  /**
   * Get or create Report Service
   */
  getReportService(): IReportService {
    const key = 'reportService';
    if (!this.has(key)) {
      const apiClient = this.getApiClient();
      const service = new ReportService(apiClient);
      this.register(key, service);
    }
    return this.get<IReportService>(key);
  }

  /**
   * Get or create Scan Repository
   */
  getScanRepository(): IScanRepository {
    const key = 'scanRepository';
    if (!this.has(key)) {
      const apiClient = this.getApiClient();
      const repository = new ScanRepository(apiClient);
      this.register(key, repository);
    }
    return this.get<IScanRepository>(key);
  }

  /**
   * Get or create Migration Repository
   */
  getMigrationRepository(): IMigrationRepository {
    const key = 'migrationRepository';
    if (!this.has(key)) {
      const apiClient = this.getApiClient();
      const repository = new MigrationRepository(apiClient);
      this.register(key, repository);
    }
    return this.get<IMigrationRepository>(key);
  }

  /**
   * Update configuration and refresh dependent services
   */
  updateConfig(_config: Partial<import('../config').DevSyncConfig>): void {
    // Configuration updates are handled by ConfigurationManager
    // This method is kept for backward compatibility
    
    // Update services that depend on config
    if (_config.analyzerUrl && this.has('authManager')) {
      const authManager = this.get<IAuthManager>('authManager');
      if (typeof _config.analyzerUrl === 'string') {
        authManager.setAnalyzerUrl(_config.analyzerUrl);
      }
    }

    if (_config.apiUrl && this.has('chatApiClient')) {
      const chatApiClient = this.get<IChatApiClient>('chatApiClient');
      if (typeof _config.apiUrl === 'string') {
        chatApiClient.setApiUrl(_config.apiUrl);
      }
    }
  }

  /**
   * Get current configuration (for backward compatibility)
   */
  getConfig(): IExtensionConfig {
    const config = this.configManager.getAll();
    return {
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      projectId: config.projectId,
      analyzerUrl: config.analyzerUrl,
      databaseConnection: config.databaseConnection,
      enableDiagnostics: config.enableDiagnostics,
      autoScan: config.autoScan,
    };
  }

  /**
   * Get or create Plugin Registry
   */
  getPluginRegistry(): PluginRegistry {
    const key = 'pluginRegistry';
    if (!this.has(key)) {
      const registry = new PluginRegistry(this.context);
      
      // Register default AI provider first (synchronously available)
      // This ensures the default provider is always available immediately
      const chatApiClient = this.getChatApiClient();
      const defaultProvider = new DefaultAiProviderPlugin(chatApiClient);
      // Register synchronously - default provider activation is fast and non-blocking
      registry.registerPlugin(defaultProvider).catch((error) => {
        console.error('Failed to register default AI provider:', error);
      });
      
      // Load other plugins asynchronously (non-blocking)
      const loader = new PluginLoader(this.context);
      loader.loadPlugins(registry).catch((error) => {
        console.error('Failed to load plugins:', error);
      });
      
      this.register(key, registry);
      this.pluginRegistry = registry;
    }
    return this.get<PluginRegistry>(key);
  }

  /**
   * Get or create Security Manager
   * Note: This requires authManager to be initialized first
   */
  getSecurityManager(): import('../security/integration').SecurityManager {
    const key = 'securityManager';
    if (!this.has(key)) {
      throw new Error('SecurityManager not initialized. Call initializeSecurityManager() first.');
    }
    return this.get<import('../security/integration').SecurityManager>(key);
  }

  /**
   * Initialize Security Manager (must be called after authManager is created)
   */
  async initializeSecurityManager(): Promise<void> {
    const key = 'securityManager';
    if (this.has(key)) {
      return; // Already initialized
    }

    const authManager = this.getAuthManager();
    const { createSecurityManager } = await import('../security/integration');
    const securityManager = await createSecurityManager(this.context, authManager);
    this.register(key, securityManager);
  }

  /**
   * Dispose all services
   */
  async dispose(): Promise<void> {
    if (this.pluginRegistry) {
      await this.pluginRegistry.dispose();
    }
    if (this.has('securityManager')) {
      const securityManager = this.get<import('../security/integration').SecurityManager>('securityManager');
      securityManager.dispose();
    }
    this.services.clear();
  }
}

