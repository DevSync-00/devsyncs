# Component Documentation

Detailed documentation of DevSync components.

## Table of Contents

1. [Core Components](#core-components)
2. [Services](#services)
3. [Utilities](#utilities)
4. [UI Components](#ui-components)
5. [State Management](#state-management)

## Core Components

### Extension Entry Point

**File**: `src/extension.ts`

**Purpose**: Extension activation and initialization

**Key Methods**:
- `activate(context: ExtensionContext)`: Activates extension
- `deactivate()`: Cleans up on deactivation

**Dependencies**:
- DI Container
- Command Handlers
- Providers

### Dependency Injection Container

**File**: `src/di/container.ts`

**Purpose**: Manages service dependencies

**Key Methods**:
- `register<T>(key: string, factory: Factory<T>)`: Register service
- `get<T>(key: string): T`: Resolve service
- `isRegistered(key: string): boolean`: Check registration

**Example**:
```typescript
const container = DIContainer.getInstance();
container.register<IApiClient>('apiClient', () => new ApiClient());
const apiClient = container.get<IApiClient>('apiClient');
```

### Command Handler

**File**: `src/commands.ts`

**Purpose**: Handles VS Code commands

**Key Commands**:
- `devsync.scan`: Scan schema
- `devsync.generateMigration`: Generate migration
- `devsync.viewReport`: View scan report

**Example**:
```typescript
const commands = container.get<IDevSyncCommands>('commands');
commands.register('devsync.scan', async () => {
  await scanService.scanSchema();
});
```

## Services

### Scan Service

**File**: `src/services/scanService.ts`

**Purpose**: Orchestrates schema scanning

**Key Methods**:
- `scanSchema(options: ScanOptions): Promise<ScanResult>`
- `getScanResults(scanId: string): Promise<ScanResult>`
- `cancelScan(scanId: string): Promise<void>`

**Dependencies**:
- API Client
- CLI Runner
- State Store

**Example**:
```typescript
const scanService = container.get<ScanService>('scanService');
const result = await scanService.scanSchema({
  schema: schemaContent,
  databaseUrl: databaseUrl
});
```

### Migration Service

**File**: `src/services/migrationService.ts`

**Purpose**: Handles migration generation

**Key Methods**:
- `generateMigration(request: MigrationRequest): Promise<MigrationResponse>`
- `previewMigration(request: MigrationRequest): Promise<string>`
- `applyMigration(migrationId: string): Promise<void>`

**Dependencies**:
- API Client
- File System
- State Store

**Example**:
```typescript
const migrationService = container.get<MigrationService>('migrationService');
const migration = await migrationService.generateMigration({
  scanId: '123',
  mismatches: ['mismatch-1', 'mismatch-2']
});
```

### Report Service

**File**: `src/services/reportService.ts`

**Purpose**: Generates reports from scan results

**Key Methods**:
- `generateReport(result: ScanResult, format: ReportFormat): Promise<string>`
- `exportReport(result: ScanResult, path: string): Promise<void>`

**Dependencies**:
- File System
- Report Generators

**Example**:
```typescript
const reportService = container.get<ReportService>('reportService');
const htmlReport = await reportService.generateReport(result, 'html');
await reportService.exportReport(result, '/path/to/report.html');
```

## Utilities

### Configuration Manager

**File**: `src/config/manager.ts`

**Purpose**: Manages extension configuration

**Key Methods**:
- `get<T>(key: string): T | undefined`
- `set(key: string, value: any): Promise<void>`
- `validate(): ValidationResult`

**Example**:
```typescript
const config = container.get<ConfigurationManager>('config');
const apiUrl = config.get<string>('devsync.apiUrl');
await config.set('devsync.apiKey', 'new-key');
```

### Error Logger

**File**: `src/errors/logger.ts`

**Purpose**: Centralized error logging

**Key Methods**:
- `logError(error: Error, context?: ErrorContext): void`
- `logWarning(message: string, context?: ErrorContext): void`
- `getErrors(): ErrorLog[]`

**Example**:
```typescript
const errorLogger = container.get<ErrorLogger>('errorLogger');
errorLogger.logError(error, { operation: 'scan', scanId: '123' });
```

### Path Utilities

**File**: `src/utils/paths.ts`

**Purpose**: Path manipulation utilities

**Key Functions**:
- `resolveWorkspacePath(relativePath: string): string`
- `findPrismaSchema(): string | null`
- `normalizePath(path: string): string`

**Example**:
```typescript
import { resolveWorkspacePath, findPrismaSchema } from './utils/paths';

const schemaPath = findPrismaSchema();
const fullPath = resolveWorkspacePath('schema.prisma');
```

## UI Components

### Sidebar Provider

**File**: `src/sidebarProvider.ts`

**Purpose**: Manages sidebar tree view

**Key Methods**:
- `getChildren(element?: TreeItem): TreeItem[]`
- `refresh(): void`
- `updateScanResults(results: ScanResult): void`

**Tree Structure**:
```
DevSync
├── Commands
│   ├── Scan Schema
│   ├── Generate Migration
│   └── View Report
├── Scan Results
│   ├── Errors (5)
│   ├── Warnings (3)
│   └── Info (2)
└── Migrations
    ├── migration-001.sql
    └── migration-002.sql
```

**Example**:
```typescript
const sidebarProvider = container.get<DevSyncSidebarProvider>('sidebar');
sidebarProvider.updateScanResults(scanResult);
sidebarProvider.refresh();
```

### Chat Panel Manager

**File**: `src/chatPanelManager.ts`

**Purpose**: Manages chat webview

**Key Methods**:
- `sendMessage(message: string): Promise<void>`
- `clearConversation(): void`
- `exportConversation(format: 'json' | 'markdown'): Promise<string>`

**Example**:
```typescript
const chatManager = container.get<ChatPanelManager>('chat');
await chatManager.sendMessage('What fields are missing?');
const exported = await chatManager.exportConversation('markdown');
```

### Code Actions Provider

**File**: `src/codeActions.ts`

**Purpose**: Provides code actions for diagnostics

**Key Methods**:
- `provideCodeActions(document, range, context): CodeAction[]`
- `resolveCodeAction(action): CodeAction`

**Example**:
```typescript
const codeActions = container.get<DevSyncCodeActions>('codeActions');
const actions = await codeActions.provideCodeActions(
  document,
  range,
  context
);
```

### Diagnostics Provider

**File**: `src/diagnostics.ts`

**Purpose**: Manages inline diagnostics

**Key Methods**:
- `updateDiagnostics(document, mismatches): void`
- `clearDiagnostics(document): void`
- `getDiagnostics(document): Diagnostic[]`

**Example**:
```typescript
const diagnostics = container.get<DevSyncDiagnostics>('diagnostics');
diagnostics.updateDiagnostics(document, mismatches);
```

## State Management

### State Store

**File**: `src/state/store.ts`

**Purpose**: Centralized state management

**Key Methods**:
- `dispatch(action: Action): void`
- `getState(): AppState`
- `subscribe(listener: StateListener): () => void`

**State Structure**:
```typescript
interface AppState {
  scanResults: ScanResult[];
  migrations: Migration[];
  ui: {
    sidebarExpanded: boolean;
    chatOpen: boolean;
  };
  config: Configuration;
}
```

**Example**:
```typescript
const store = container.get<StateStore>('stateStore');
store.dispatch({ type: 'SCAN_COMPLETE', payload: result });
const state = store.getState();
store.subscribe((newState) => {
  updateUI(newState);
});
```

### Actions

**File**: `src/state/actions.ts`

**Purpose**: State action creators

**Key Actions**:
- `scanStart(scanId: string)`
- `scanComplete(result: ScanResult)`
- `scanError(error: Error)`
- `migrationGenerated(migration: Migration)`

**Example**:
```typescript
import { scanComplete } from './state/actions';

store.dispatch(scanComplete(scanResult));
```

### Reducers

**File**: `src/state/reducers.ts`

**Purpose**: State reducers

**Key Reducers**:
- `scanReducer(state, action)`
- `migrationReducer(state, action)`
- `uiReducer(state, action)`

**Example**:
```typescript
function scanReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SCAN_COMPLETE':
      return {
        ...state,
        scanResults: [...state.scanResults, action.payload]
      };
    default:
      return state;
  }
}
```

## Component Dependencies

### Dependency Graph

```
extension.ts
    ↓
commands.ts → services/ → di/ → interfaces/
    ↓
sidebarProvider.ts → state/ → services/
    ↓
chatPanelManager.ts → api/ → services/
    ↓
codeActions.ts → diagnostics.ts → services/
```

### Service Dependencies

```
ScanService
├── IApiClient
├── ICliRunner
└── StateStore

MigrationService
├── IApiClient
├── FileSystem
└── StateStore

ReportService
├── FileSystem
└── ReportGenerators
```

## Component Lifecycle

### Initialization

1. Extension activates
2. DI Container created
3. Services registered
4. Providers initialized
5. Commands registered

### Runtime

1. User triggers command
2. Command handler called
3. Service method invoked
4. State updated
5. UI refreshed

### Cleanup

1. Extension deactivates
2. Providers disposed
3. Services cleaned up
4. Resources released

---

**Related Documentation**:
- [Architecture Overview](ARCHITECTURE.md)
- [API Reference](API_REFERENCE.md)
- [Extension Points](EXTENSION_POINTS.md)

