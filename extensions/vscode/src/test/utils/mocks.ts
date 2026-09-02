/**
 * Mock utilities for unit testing.
 * 
 * Provides mock implementations of VS Code APIs and extension interfaces
 * for isolated unit testing.
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'vscode';
import { ConfigSource } from '../../config';
import type {
  IApiClient,
  ICliRunner,
  IAuthManager,
  IChatApiClient,
  IDiagnostics,
  IConfigurationManager,
  IStateStore,
} from '../../interfaces';
import type { AuthSessionState } from '../../types';
import type { AuthFlowUpdate } from '../../auth';

/**
 * Mock VS Code ExtensionContext
 */
export function createMockExtensionContext(): vscode.ExtensionContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscriptions: vscode.Disposable[] = [];
  const secrets: Map<string, string> = new Map();
  const globalState: Map<string, unknown> = new Map();
  const workspaceState: Map<string, unknown> = new Map();

  return {
    subscriptions,
    workspaceState: {
      get: (key: string) => workspaceState.get(key),
      update: async (key: string, value: unknown) => {
        workspaceState.set(key, value);
        return Promise.resolve();
      },
      keys: () => Array.from(workspaceState.keys()),
    },
    globalState: {
      get: (key: string) => globalState.get(key),
      update: async (key: string, value: unknown) => {
        globalState.set(key, value);
        return Promise.resolve();
      },
      keys: () => Array.from(globalState.keys()),
      setKeysForSync: () => {},
    },
    secrets: {
      get: async (key: string) => secrets.get(key) || undefined,
      store: async (key: string, value: string) => {
        secrets.set(key, value);
      },
      delete: async (key: string) => {
        secrets.delete(key);
      },
    },
    extensionPath: '/mock/extension/path',
    extensionUri: vscode.Uri.parse('file:///mock/extension/path'),
    globalStorageUri: vscode.Uri.parse('file:///mock/global/storage'),
    logUri: vscode.Uri.parse('file:///mock/log'),
    storageUri: vscode.Uri.parse('file:///mock/storage'),
    globalStoragePath: '/mock/global/storage',
    logPath: '/mock/log',
    storagePath: '/mock/storage',
    extensionMode: vscode.ExtensionMode.Test,
    environmentVariableCollection: {} as vscode.EnvironmentVariableCollection,
    extension: {
      id: 'Dev-sync.devsync',
      extensionUri: vscode.Uri.parse('file:///mock/extension/path'),
      extensionPath: '/mock/extension/path',
      isActive: true,
      packageJSON: {},
      exports: {},
      activate: async () => ({}),
    },
  } as unknown as vscode.ExtensionContext;
}

/**
 * Mock API Client
 */
export class MockApiClient implements IApiClient {
  async dashboardRequest<T>(_path: string, _method?: 'GET' | 'POST' | 'PATCH' | 'DELETE', _payload?: unknown): Promise<T> {
    return {} as T;
  }
  private scanResults: any[] = [];
  private migrationResults: any[] = [];
  private scanReports: any[] = [];

  constructor(
    public apiUrl: string = 'http://localhost:3000',
    public apiKey: string = 'test-api-key',
    public projectId: string = 'test-project-id'
  ) {}

  setScanResults(results: any[]): void {
    this.scanResults = results;
  }

  setMigrationResults(results: any[]): void {
    this.migrationResults = results;
  }

  setScanReports(reports: any[]): void {
    this.scanReports = reports;
  }

  async scan(workspacePath: string, databaseConnection?: string): Promise<any> {
    const report = {
      id: 'test-scan-id',
      projectId: this.projectId,
      status: 'completed' as const,
      mismatches: this.scanResults,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };
    this.scanReports.unshift(report);
    return report;
  }

  async getScanReports(limit?: number): Promise<any[]> {
    return limit ? this.scanReports.slice(0, limit) : this.scanReports;
  }

  async getLatestScanReport(): Promise<any | null> {
    return this.scanReports.length > 0 ? this.scanReports[0] : null;
  }

  async generateMigration(scanReportId: string, format: string = 'sql'): Promise<any> {
    return {
      id: 'test-migration-id',
      scanReportId,
      content: 'ALTER TABLE test ADD COLUMN test_column TEXT;',
      format,
      created_at: new Date().toISOString(),
    };
  }

  async getMigrations(scanReportId?: string): Promise<any[]> {
    return this.migrationResults.filter(
      (m) => !scanReportId || m.scanReportId === scanReportId
    );
  }

  async getMigration(migrationId: string): Promise<any | null> {
    const migration = this.migrationResults.find((m) => m.id === migrationId);
    return migration || null;
  }

  async listProjects(): Promise<Array<{ id: string; name: string; slug?: string; schemaType?: string; schema_type?: string }>> {
    return [
      {
        id: this.projectId,
        name: 'Test Project',
        slug: 'test-project',
        schemaType: 'prisma',
      },
    ];
  }

  async createProject(payload: { name: string; schemaType: string }): Promise<{ id: string; name: string; schemaType: string }> {
    return { id: this.projectId, name: payload.name, schemaType: payload.schemaType };
  }

  getDashboardUrl(): string {
    return `${this.apiUrl}/dashboard/projects/${this.projectId}`;
  }
}

/**
 * Mock CLI Runner
 */
export class MockCliRunner implements ICliRunner {
  private commandResults: Map<string, any> = new Map();
  private commandErrors: Map<string, Error> = new Map();
  private cliAvailable: boolean = true;

  setCommandResult(command: string, result: any): void {
    this.commandResults.set(command, result);
    this.commandErrors.delete(command);
  }

  setCommandError(command: string, error: Error): void {
    this.commandErrors.set(command, error);
    this.commandResults.delete(command);
  }

  setCliAvailable(available: boolean): void {
    this.cliAvailable = available;
  }

  async checkCliAvailable(): Promise<boolean> {
    return this.cliAvailable;
  }

  async buildCli(): Promise<any> {
    return { success: true, output: 'Build completed' };
  }

  async executeCliCommand(
    command: 'scan' | 'migrate' | 'init',
    options?: Record<string, any>,
    cancelToken?: vscode.CancellationToken,
    hooks?: any
  ): Promise<any> {
    if (this.commandErrors.has(command)) {
      throw this.commandErrors.get(command)!;
    }
    return this.commandResults.get(command) || { success: true, output: '' };
  }

  cancelAll(): void {
    // Mock implementation
  }

  showOutput(): void {
    // Mock implementation
  }
}

/**
 * Mock Auth Manager
 */
export class MockAuthManager implements IAuthManager {
  private session: AuthSessionState = { status: 'unauthenticated' };
  private listeners: Array<(session: AuthSessionState) => void> = [];
  private analyzerUrl: string = 'http://localhost:3000';
  private emitter = new EventEmitter<AuthSessionState>();

  setSession(session: AuthSessionState): void {
    this.session = session;
    this.emitter.fire(session);
    this.listeners.forEach((listener) => listener(session));
  }

  get onDidChangeSession(): vscode.Event<AuthSessionState> {
    return this.emitter.event;
  }

  getSession(): AuthSessionState {
    return this.session;
  }

  setAnalyzerUrl(url: string): void {
    this.analyzerUrl = url;
  }

  async ensureAccessToken(): Promise<string> {
    if (this.session.status === 'authenticated') {
      return 'mock-access-token';
    }
    throw new Error('Not authenticated');
  }

  async startDeviceFlow(progress?: (update: AuthFlowUpdate) => void): Promise<AuthSessionState> {
    progress?.({ kind: 'deviceCode', payload: {
      device_code: 'mock-device-code',
      user_code: 'MOCK-CODE',
      verification_uri: 'http://localhost/verify',
      expires_in: 300,
      interval: 5,
    }});
    this.setSession({ status: 'authenticated', userId: 'test-user', clientId: 'test-client' });
    return this.session;
  }

  async logout(): Promise<void> {
    this.setSession({ status: 'unauthenticated' });
  }
}

/**
 * Mock Chat API Client
 */
export class MockChatApiClient implements IChatApiClient {
  private queryResults: Map<string, any> = new Map();

  setQueryResult(question: string, result: any): void {
    this.queryResults.set(question, result);
  }

  async queryAI(question: string, scanReportId: string): Promise<any> {
    return (
      this.queryResults.get(question) || {
        answer: 'Mock answer',
        question,
        scanReportId,
      }
    );
  }

  async getLatestScanReport(projectId: string): Promise<any> {
    return {
      id: 'test-scan-id',
      timestamp: Date.now(),
      mismatches: [],
    };
  }

  setApiUrl(url: string): void {
    // Mock implementation
  }
}

/**
 * Mock Diagnostics
 */
export class MockDiagnostics implements IDiagnostics {
  private diagnostics: vscode.Diagnostic[] = [];

  setDiagnostics(diagnostics: vscode.Diagnostic[]): void {
    this.diagnostics = diagnostics;
  }

  async checkWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    // Mock implementation
  }

  clear(): void {
    this.diagnostics = [];
  }

  getDiagnostics(): vscode.Diagnostic[] {
    return this.diagnostics;
  }
}

/**
 * Mock Configuration Manager
 */
export class MockConfigurationManager implements IConfigurationManager {
  private config: Map<string, unknown> = new Map();
  private emitter = new EventEmitter<any>();

  set(key: string, value: unknown): void {
    this.config.set(key, value);
  }

  get<K extends keyof import('../../config').DevSyncConfig>(key: K): import('../../config').DevSyncConfig[K] {
    return this.config.get(key) as any;
  }

  getAll(): import('../../config').DevSyncConfig {
    const result: any = {};
    this.config.forEach((value, key) => {
      result[key] = value;
    });
    return result as any;
  }

  getSource(key: keyof import('../../config').DevSyncConfig): ConfigSource {
    return ConfigSource.WORKSPACE;
  }

  async update<K extends keyof import('../../config').DevSyncConfig>(
    key: K,
    value: import('../../config').DevSyncConfig[K],
    target?: vscode.ConfigurationTarget
  ): Promise<void> {
    this.config.set(key, value);
  }

  validate(): import('../../config').ValidationResult {
    return { valid: true, errors: [], warnings: [] };
  }

  isValid(): boolean {
    return true;
  }

  getMissingRequired(): string[] {
    return [];
  }

  get onDidChangeConfig(): vscode.Event<any> {
    return this.emitter.event;
  }
}

/**
 * Mock State Store
 */
export class MockStateStore implements IStateStore {
  private state: any = {};
  private listeners: Array<(event: any) => void> = [];
  private emitter = new EventEmitter<any>();

  getState(): any {
    return this.state;
  }

  getStateSlice<K extends keyof any>(slice: K): any {
    return this.state[slice];
  }

  dispatch(action: any): void {
    const previousState = { ...this.state };
    // Mock reducer
    if (action.type === 'scan/start') {
      this.state = { ...this.state, scan: { status: 'running' } };
    } else if (action.type === 'scan/complete') {
      this.state = { ...this.state, scan: { status: 'completed', report: action.payload } };
    }
    const event = {
      action,
      previousState,
      newState: this.state,
      changedKeys: Object.keys(this.state),
    };
    this.emitter.fire(event);
    this.listeners.forEach((listener) => listener(event));
  }

  subscribe(callback: (event: any) => void): vscode.Disposable {
    this.listeners.push(callback);
    return {
      dispose: () => {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      },
    };
  }

  subscribeToSlice<K extends keyof any>(
    slice: K,
    callback: (newValue: any, previousValue: any) => void
  ): vscode.Disposable {
    return this.subscribe((event) => {
      if (event.changedKeys.includes(slice)) {
        callback(event.newState[slice], event.previousState[slice]);
      }
    });
  }

  canUndo(): boolean {
    return false;
  }

  canRedo(): boolean {
    return false;
  }

  undo(): void {
    // Mock implementation
  }

  redo(): void {
    // Mock implementation
  }

  reset(): void {
    this.state = {};
  }

  async flush(): Promise<void> {
    // Mock state is already stored synchronously in memory.
  }

  get onStateChange(): vscode.Event<any> {
    return this.emitter.event;
  }
}

