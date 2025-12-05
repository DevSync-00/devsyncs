# Extension Points

How to extend DevSync through plugins, custom providers, and integration points.

## Table of Contents

1. [Plugin System](#plugin-system)
2. [Custom Providers](#custom-providers)
3. [Hooks and Events](#hooks-and-events)
4. [Integration Examples](#integration-examples)
5. [Best Practices](#best-practices)

## Plugin System

### Plugin Interface

```typescript
interface IPlugin {
  /**
   * Plugin name
   */
  name: string;
  
  /**
   * Plugin version
   */
  version: string;
  
  /**
   * Initialize plugin
   */
  initialize(container: DIContainer): Promise<void>;
  
  /**
   * Cleanup plugin
   */
  dispose(): Promise<void>;
}
```

### Creating a Plugin

#### 1. Define Plugin Class

```typescript
import { IPlugin } from '../interfaces/plugin';
import { DIContainer } from '../di/container';

export class MyCustomPlugin implements IPlugin {
  name = 'my-custom-plugin';
  version = '1.0.0';
  
  async initialize(container: DIContainer): Promise<void> {
    // Register custom services
    container.register('myService', MyService);
    
    // Register commands
    const commands = container.get<IDevSyncCommands>('commands');
    commands.register('my.custom.command', this.handleCommand.bind(this));
  }
  
  async dispose(): Promise<void> {
    // Cleanup resources
  }
  
  private async handleCommand(): Promise<void> {
    // Command handler
  }
}
```

#### 2. Register Plugin

```typescript
import { PluginRegistry } from '../plugins/registry';

const registry = PluginRegistry.getInstance();
registry.register(new MyCustomPlugin());
```

### AI Provider Plugin

```typescript
interface IAiProviderPlugin extends IPlugin {
  /**
   * Send message to AI provider
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
export class CustomAiProviderPlugin implements IAiProviderPlugin {
  name = 'custom-ai-provider';
  version = '1.0.0';
  
  async sendMessage(message: string, context?: ChatContext): Promise<ChatResponse> {
    // Call your AI API
    const response = await fetch('https://api.example.com/chat', {
      method: 'POST',
      body: JSON.stringify({ message, context })
    });
    
    return await response.json();
  }
  
  async streamMessage(message: string, onChunk: (chunk: string) => void): Promise<void> {
    // Stream response
    const response = await fetch('https://api.example.com/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    
    const reader = response.body?.getReader();
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      onChunk(new TextDecoder().decode(value));
    }
  }
  
  async initialize(container: DIContainer): Promise<void> {
    // Register as AI provider
    container.register<IAiProviderPlugin>('aiProvider', this);
  }
  
  async dispose(): Promise<void> {
    // Cleanup
  }
}
```

### Command Handler Plugin

```typescript
interface ICommandHandlerPlugin extends IPlugin {
  /**
   * Register command handlers
   */
  registerCommands(commands: IDevSyncCommands): void;
}
```

**Example**:
```typescript
export class CustomCommandPlugin implements ICommandHandlerPlugin {
  name = 'custom-commands';
  version = '1.0.0';
  
  registerCommands(commands: IDevSyncCommands): void {
    commands.register('custom.scan', this.handleScan.bind(this));
    commands.register('custom.migrate', this.handleMigrate.bind(this));
  }
  
  private async handleScan(): Promise<void> {
    // Custom scan logic
  }
  
  private async handleMigrate(): Promise<void> {
    // Custom migration logic
  }
  
  async initialize(container: DIContainer): Promise<void> {
    const commands = container.get<IDevSyncCommands>('commands');
    this.registerCommands(commands);
  }
  
  async dispose(): Promise<void> {
    // Cleanup
  }
}
```

## Custom Providers

### Custom API Client

```typescript
import { IApiClient } from '../interfaces/api';

export class CustomApiClient implements IApiClient {
  async scanSchema(request: ScanRequest): Promise<ScanResponse> {
    // Custom scan implementation
    const response = await fetch('https://api.example.com/scan', {
      method: 'POST',
      body: JSON.stringify(request)
    });
    return await response.json();
  }
  
  async generateMigration(request: MigrationRequest): Promise<MigrationResponse> {
    // Custom migration generation
    const response = await fetch('https://api.example.com/migrate', {
      method: 'POST',
      body: JSON.stringify(request)
    });
    return await response.json();
  }
  
  async getScanResults(scanId: string): Promise<ScanResult> {
    const response = await fetch(`https://api.example.com/scan/${scanId}`);
    return await response.json();
  }
}
```

**Register**:
```typescript
container.register<IApiClient>('apiClient', CustomApiClient);
```

### Custom CLI Runner

```typescript
import { ICliRunner } from '../interfaces/cli';

export class CustomCliRunner implements ICliRunner {
  async execute(command: string, args: string[]): Promise<CliResult> {
    // Custom CLI execution
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec(`custom-cli ${command} ${args.join(' ')}`, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr, exitCode: 0 });
        }
      });
    });
  }
  
  async executeStream(
    command: string,
    args: string[],
    onOutput: (data: string) => void
  ): Promise<void> {
    // Custom streaming execution
    const { spawn } = require('child_process');
    const process = spawn('custom-cli', [command, ...args]);
    
    process.stdout.on('data', (data: Buffer) => {
      onOutput(data.toString());
    });
    
    process.stderr.on('data', (data: Buffer) => {
      onOutput(data.toString());
    });
    
    return new Promise((resolve) => {
      process.on('close', () => resolve());
    });
  }
}
```

### Custom Diagnostics Provider

```typescript
import { IDiagnostics } from '../interfaces/diagnostics';

export class CustomDiagnostics implements IDiagnostics {
  private diagnostics: Map<string, vscode.Diagnostic[]> = new Map();
  
  updateDiagnostics(document: vscode.TextDocument, mismatches: Mismatch[]): void {
    const diagnostics: vscode.Diagnostic[] = mismatches.map(mismatch => {
      const diagnostic = new vscode.Diagnostic(
        this.getRange(mismatch),
        mismatch.message,
        this.getSeverity(mismatch.severity)
      );
      diagnostic.source = 'devsync';
      diagnostic.code = mismatch.type;
      return diagnostic;
    });
    
    this.diagnostics.set(document.uri.toString(), diagnostics);
    vscode.languages.createDiagnosticCollection('devsync').set(document.uri, diagnostics);
  }
  
  clearDiagnostics(document: vscode.TextDocument): void {
    this.diagnostics.delete(document.uri.toString());
    vscode.languages.createDiagnosticCollection('devsync').delete(document.uri);
  }
  
  getDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
    return this.diagnostics.get(document.uri.toString()) || [];
  }
  
  private getRange(mismatch: Mismatch): vscode.Range {
    if (mismatch.location) {
      return new vscode.Range(
        mismatch.location.line - 1,
        mismatch.location.column - 1,
        mismatch.location.line - 1,
        mismatch.location.column + 10
      );
    }
    return new vscode.Range(0, 0, 0, 0);
  }
  
  private getSeverity(severity: string): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'error': return vscode.DiagnosticSeverity.Error;
      case 'warning': return vscode.DiagnosticSeverity.Warning;
      default: return vscode.DiagnosticSeverity.Information;
    }
  }
}
```

## Hooks and Events

### Event System

```typescript
interface IEventEmitter {
  on(event: string, listener: Function): void;
  off(event: string, listener: Function): void;
  emit(event: string, ...args: any[]): void;
}
```

### Available Events

```typescript
// Scan events
'scan:start'      // Scan started
'scan:progress'   // Scan progress update
'scan:complete'   // Scan completed
'scan:error'      // Scan error

// Migration events
'migration:start'    // Migration started
'migration:complete' // Migration completed
'migration:error'    // Migration error

// State events
'state:change'   // State changed
```

### Using Events

```typescript
import { EventEmitter } from '../events/emitter';

const emitter = EventEmitter.getInstance();

// Listen to events
emitter.on('scan:complete', (result: ScanResult) => {
  console.log('Scan completed:', result);
});

// Emit events
emitter.emit('scan:start', { scanId: '123' });
```

### Custom Hooks

```typescript
interface IHook {
  /**
   * Hook name
   */
  name: string;
  
  /**
   * Execute hook
   */
  execute(context: HookContext): Promise<HookResult>;
}
```

**Example**:
```typescript
export class PreScanHook implements IHook {
  name = 'pre-scan';
  
  async execute(context: HookContext): Promise<HookResult> {
    // Validate schema before scan
    const isValid = await this.validateSchema(context.schema);
    if (!isValid) {
      return { success: false, error: 'Invalid schema' };
    }
    return { success: true };
  }
  
  private async validateSchema(schema: string): Promise<boolean> {
    // Validation logic
    return true;
  }
}
```

**Register Hook**:
```typescript
const hookRegistry = HookRegistry.getInstance();
hookRegistry.register(new PreScanHook());
```

## Integration Examples

### Custom Database Provider

```typescript
interface IDatabaseProvider {
  connect(connectionString: string): Promise<void>;
  query(sql: string): Promise<any[]>;
  disconnect(): Promise<void>;
}

export class CustomDatabaseProvider implements IDatabaseProvider {
  private connection: any;
  
  async connect(connectionString: string): Promise<void> {
    // Connect to your database
    this.connection = await createConnection(connectionString);
  }
  
  async query(sql: string): Promise<any[]> {
    return await this.connection.query(sql);
  }
  
  async disconnect(): Promise<void> {
    await this.connection.close();
  }
}
```

### Custom Report Generator

```typescript
interface IReportGenerator {
  generate(report: ScanResult, format: 'json' | 'html' | 'pdf'): Promise<string>;
}

export class CustomReportGenerator implements IReportGenerator {
  async generate(report: ScanResult, format: 'json' | 'html' | 'pdf'): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'html':
        return this.generateHtml(report);
      case 'pdf':
        return this.generatePdf(report);
    }
  }
  
  private generateHtml(report: ScanResult): string {
    // HTML generation logic
    return '<html>...</html>';
  }
  
  private generatePdf(report: ScanResult): Promise<string> {
    // PDF generation logic
    return Promise.resolve('pdf-content');
  }
}
```

### Custom Notification Provider

```typescript
interface INotificationProvider {
  notify(title: string, message: string, type: 'info' | 'warning' | 'error'): void;
}

export class SlackNotificationProvider implements INotificationProvider {
  private webhookUrl: string;
  
  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }
  
  notify(title: string, message: string, type: 'info' | 'warning' | 'error'): void {
    fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${title}: ${message}`,
        color: this.getColor(type)
      })
    });
  }
  
  private getColor(type: string): string {
    switch (type) {
      case 'error': return 'danger';
      case 'warning': return 'warning';
      default: return 'good';
    }
  }
}
```

## Best Practices

### 1. Plugin Design

- **Single Responsibility**: Each plugin should do one thing well
- **Dependency Injection**: Use DI container for dependencies
- **Error Handling**: Handle errors gracefully
- **Cleanup**: Dispose resources properly

### 2. Provider Implementation

- **Interface Compliance**: Implement interfaces completely
- **Error Handling**: Return meaningful errors
- **Async Operations**: Use async/await properly
- **Resource Management**: Clean up connections/resources

### 3. Event Handling

- **Unsubscribe**: Remove listeners when done
- **Error Handling**: Handle event errors
- **Performance**: Don't block event loop
- **Documentation**: Document custom events

### 4. Testing

- **Unit Tests**: Test plugins in isolation
- **Integration Tests**: Test with real dependencies
- **Mocking**: Mock external dependencies
- **Coverage**: Aim for high test coverage

### 5. Documentation

- **API Documentation**: Document all public APIs
- **Examples**: Provide usage examples
- **README**: Include plugin README
- **Changelog**: Document changes

---

**Related Documentation**:
- [API Reference](API_REFERENCE.md)
- [Component Guide](COMPONENTS.md)
- [Architecture Overview](ARCHITECTURE.md)

