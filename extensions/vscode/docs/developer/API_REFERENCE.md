# API Reference

Complete API documentation for DevSync extension developers.

## Table of Contents

1. [Core APIs](#core-apis)
2. [Service Interfaces](#service-interfaces)
3. [Types](#types)
4. [Utilities](#utilities)
5. [Examples](#examples)

## Core APIs

### Extension API

#### `activate(context: ExtensionContext): void`

Activates the DevSync extension.

**Parameters**:
- `context`: VS Code extension context

**Example**:
```typescript
import { activate } from './extension';

activate(context);
```

### Command API

#### `registerCommand(command: string, handler: Function): void`

Registers a command handler.

**Parameters**:
- `command`: Command identifier (e.g., `devsync.scan`)
- `handler`: Command handler function

**Example**:
```typescript
vscode.commands.registerCommand('devsync.scan', async () => {
  await scanService.scanSchema();
});
```

## Service Interfaces

### IApiClient

API client interface for communicating with DevSync API.

```typescript
interface IApiClient {
  /**
   * Scan schema for mismatches
   */
  scanSchema(request: ScanRequest): Promise<ScanResponse>;
  
  /**
   * Generate migration from mismatches
   */
  generateMigration(request: MigrationRequest): Promise<MigrationResponse>;
  
  /**
   * Get scan results
   */
  getScanResults(scanId: string): Promise<ScanResult>;
}
```

**Example**:
```typescript
const apiClient = container.get<IApiClient>('apiClient');
const result = await apiClient.scanSchema({
  schema: schemaContent,
  databaseUrl: databaseUrl
});
```

### ICliRunner

CLI runner interface for executing DevSync CLI commands.

```typescript
interface ICliRunner {
  /**
   * Execute CLI command
   */
  execute(command: string, args: string[]): Promise<CliResult>;
  
  /**
   * Execute command with streaming output
   */
  executeStream(command: string, args: string[], onOutput: (data: string) => void): Promise<void>;
}
```

**Example**:
```typescript
const cliRunner = container.get<ICliRunner>('cliRunner');
const result = await cliRunner.execute('scan', ['--schema', 'schema.prisma']);
```

### IAuthManager

Authentication manager interface.

```typescript
interface IAuthManager {
  /**
   * Authenticate user
   */
  authenticate(): Promise<AuthResult>;
  
  /**
   * Get current token
   */
  getToken(): Promise<string | null>;
  
  /**
   * Refresh token
   */
  refreshToken(): Promise<string>;
  
  /**
   * Logout
   */
  logout(): Promise<void>;
}
```

**Example**:
```typescript
const authManager = container.get<IAuthManager>('authManager');
const result = await authManager.authenticate();
if (result.success) {
  console.log('Authenticated!');
}
```

### IChatApiClient

Chat API client interface for AI features.

```typescript
interface IChatApiClient {
  /**
   * Send message to AI
   */
  sendMessage(message: string, context?: ChatContext): Promise<ChatResponse>;
  
  /**
   * Stream message response
   */
  streamMessage(message: string, onChunk: (chunk: string) => void): Promise<void>;
}
```

**Example**:
```typescript
const chatClient = container.get<IChatApiClient>('chatApiClient');
const response = await chatClient.sendMessage('What fields are missing?', {
  scanResults: currentScanResults
});
```

### IDiagnostics

Diagnostics provider interface.

```typescript
interface IDiagnostics {
  /**
   * Update diagnostics for document
   */
  updateDiagnostics(document: vscode.TextDocument, mismatches: Mismatch[]): void;
  
  /**
   * Clear diagnostics
   */
  clearDiagnostics(document: vscode.TextDocument): void;
  
  /**
   * Get diagnostics for document
   */
  getDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[];
}
```

**Example**:
```typescript
const diagnostics = container.get<IDiagnostics>('diagnostics');
diagnostics.updateDiagnostics(document, mismatches);
```

## Types

### ScanRequest

```typescript
interface ScanRequest {
  schema: string;              // Prisma schema content
  databaseUrl?: string;         // Database connection URL
  projectId: string;            // DevSync project ID
  options?: ScanOptions;       // Scan options
}

interface ScanOptions {
  includeWarnings?: boolean;    // Include warnings
  strictMode?: boolean;         // Strict mode
  timeout?: number;            // Timeout in milliseconds
}
```

### ScanResponse

```typescript
interface ScanResponse {
  scanId: string;               // Unique scan ID
  status: 'success' | 'error';   // Scan status
  mismatches: Mismatch[];       // Detected mismatches
  summary: ScanSummary;         // Scan summary
}

interface ScanSummary {
  totalMismatches: number;
  errors: number;
  warnings: number;
  info: number;
}
```

### Mismatch

```typescript
interface Mismatch {
  id: string;                   // Unique mismatch ID
  type: MismatchType;           // Mismatch type
  severity: 'error' | 'warning' | 'info';
  model: string;                // Model name
  field?: string;              // Field name (if applicable)
  message: string;              // Human-readable message
  suggestedFix?: string;       // Suggested SQL fix
  location?: Location;         // Code location
}

enum MismatchType {
  MissingField = 'missing_field',
  TypeMismatch = 'type_mismatch',
  MissingTable = 'missing_table',
  ConstraintMismatch = 'constraint_mismatch',
  IndexMismatch = 'index_mismatch'
}

interface Location {
  file: string;                 // File path
  line: number;                 // Line number
  column: number;               // Column number
}
```

### MigrationRequest

```typescript
interface MigrationRequest {
  scanId: string;              // Scan ID to generate migration from
  mismatches: string[];        // Mismatch IDs to include
  options?: MigrationOptions;  // Migration options
}

interface MigrationOptions {
  dryRun?: boolean;            // Generate without applying
  preview?: boolean;          // Preview mode
  format?: 'sql' | 'prisma';  // Output format
}
```

### MigrationResponse

```typescript
interface MigrationResponse {
  migrationId: string;         // Unique migration ID
  sql: string;                 // Generated SQL
  preview?: string;            // Preview (if requested)
  warnings?: string[];         // Migration warnings
}
```

### ChatContext

```typescript
interface ChatContext {
  scanResults?: ScanResult;    // Current scan results
  schema?: string;             // Current schema
  conversationHistory?: ChatMessage[]; // Previous messages
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
```

## Utilities

### Configuration Manager

```typescript
class ConfigurationManager {
  /**
   * Get configuration value
   */
  get<T>(key: string): T | undefined;
  
  /**
   * Set configuration value
   */
  set(key: string, value: any): Promise<void>;
  
  /**
   * Get workspace configuration
   */
  getWorkspaceConfig(): WorkspaceConfig;
  
  /**
   * Validate configuration
   */
  validate(): ValidationResult;
}
```

**Example**:
```typescript
const config = container.get<ConfigurationManager>('config');
const apiUrl = config.get<string>('devsync.apiUrl');
```

### State Store

```typescript
class StateStore {
  /**
   * Dispatch action
   */
  dispatch(action: Action): void;
  
  /**
   * Get current state
   */
  getState(): AppState;
  
  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void;
}
```

**Example**:
```typescript
const store = container.get<StateStore>('stateStore');
store.dispatch({ type: 'SCAN_COMPLETE', payload: results });
const state = store.getState();
```

### Error Handling

```typescript
class ErrorBoundary {
  /**
   * Wrap async operation with error handling
   */
  wrap<T>(operation: () => Promise<T>): Promise<T>;
  
  /**
   * Handle error
   */
  handleError(error: Error): void;
}
```

**Example**:
```typescript
const errorBoundary = container.get<ErrorBoundary>('errorBoundary');
await errorBoundary.wrap(async () => {
  await scanService.scanSchema();
});
```

## Examples

### Complete Scan Workflow

```typescript
import { DIContainer } from './di/container';
import { IApiClient } from './interfaces/api';
import { ScanService } from './services/scanService';

// Get dependencies
const container = DIContainer.getInstance();
const apiClient = container.get<IApiClient>('apiClient');
const scanService = container.get<ScanService>('scanService');

// Perform scan
try {
  const result = await scanService.scanSchema({
    schema: await readSchemaFile(),
    databaseUrl: getDatabaseUrl(),
    projectId: getProjectId()
  });
  
  console.log(`Found ${result.mismatches.length} mismatches`);
} catch (error) {
  console.error('Scan failed:', error);
}
```

### Generate Migration

```typescript
import { MigrationService } from './services/migrationService';

const migrationService = container.get<MigrationService>('migrationService');

const migration = await migrationService.generateMigration({
  scanId: scanResult.scanId,
  mismatches: scanResult.mismatches.map(m => m.id),
  options: {
    dryRun: true,
    preview: true
  }
});

console.log('Generated migration:', migration.sql);
```

### Chat Integration

```typescript
import { IChatApiClient } from './interfaces/chat';

const chatClient = container.get<IChatApiClient>('chatApiClient');

const response = await chatClient.sendMessage(
  'What fields are missing in the User model?',
  {
    scanResults: currentScanResults,
    schema: currentSchema
  }
);

console.log('AI Response:', response.message);
```

### Custom Command

```typescript
import * as vscode from 'vscode';
import { DIContainer } from './di/container';

export function registerCustomCommand(context: vscode.ExtensionContext) {
  const container = DIContainer.getInstance();
  const scanService = container.get<ScanService>('scanService');
  
  const command = vscode.commands.registerCommand(
    'devsync.customScan',
    async () => {
      const result = await scanService.scanSchema({
        // Custom scan options
      });
      
      vscode.window.showInformationMessage(
        `Scan complete: ${result.mismatches.length} mismatches found`
      );
    }
  );
  
  context.subscriptions.push(command);
}
```

## API Documentation

For detailed API documentation, see:
- Generated docs: `docs/api/` (TypeDoc output)
- Source code: `src/interfaces/`
- Type definitions: `src/types/`

## Versioning

APIs follow semantic versioning:
- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes

---

**Related Documentation**:
- [Architecture Overview](ARCHITECTURE.md)
- [Component Guide](COMPONENTS.md)
- [Extension Points](EXTENSION_POINTS.md)

