# Architecture Overview

High-level architecture and design of the DevSync VS Code extension.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Component Structure](#component-structure)
3. [Data Flow](#data-flow)
4. [Design Patterns](#design-patterns)
5. [Key Technologies](#key-technologies)
6. [Extension Points](#extension-points)

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Sidebar    │  │    Chat      │  │   Editor      │      │
│  │   Provider   │  │   Panel      │  │ Integration   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘      │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           │                                   │
│                  ┌────────▼────────┐                         │
│                  │   Commands       │                         │
│                  │   Handler        │                         │
│                  └────────┬─────────┘                         │
│                           │                                   │
│         ┌─────────────────┼─────────────────┐               │
│         │                 │                 │                 │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐          │
│  │   Services  │  │      DI      │  │    State    │          │
│  │   Layer     │  │  Container   │  │   Store     │          │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                │                 │                  │
│         └────────────────┼─────────────────┘                  │
│                          │                                    │
│                 ┌────────▼─────────┐                         │
│                 │   API Client      │                         │
│                 │   CLI Runner      │                         │
│                 └────────┬──────────┘                         │
│                          │                                    │
└──────────────────────────┼────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼─────┐    ┌─────▼─────┐
    │  DevSync│      │  Database │    │   AI API  │
    │   API   │      │           │    │           │
    └─────────┘      └───────────┘    └───────────┘
```

### Architecture Layers

1. **Presentation Layer**: Sidebar, Chat Panel, Editor Integration
2. **Application Layer**: Commands, Handlers, UI Logic
3. **Service Layer**: Business Logic, Data Processing
4. **Infrastructure Layer**: API Client, CLI Runner, State Management
5. **External Layer**: DevSync API, Database, AI Services

## Component Structure

### Core Components

#### 1. Extension Entry Point (`extension.ts`)

```typescript
// Activates the extension
export function activate(context: vscode.ExtensionContext) {
  // Initialize DI container
  const container = ContainerFactory.create(context);
  
  // Register commands
  const commands = container.get<IDevSyncCommands>('commands');
  commands.registerAll(context);
  
  // Initialize providers
  const sidebarProvider = container.get<DevSyncSidebarProvider>('sidebar');
  const chatProvider = container.get<ChatPanelManager>('chat');
}
```

**Responsibilities**:
- Extension activation
- Dependency injection setup
- Command registration
- Provider initialization

#### 2. Dependency Injection (`di/`)

```
di/
├── container.ts        # DI container implementation
├── factory.ts          # Container factory
└── interfaces.ts        # Service interfaces
```

**Key Interfaces**:
- `IApiClient` - API communication
- `ICliRunner` - CLI execution
- `IAuthManager` - Authentication
- `IChatApiClient` - Chat API
- `IDiagnostics` - Diagnostics provider
- `ICommands` - Command handlers

#### 3. Services Layer (`services/`)

```
services/
├── scanService.ts      # Schema scanning logic
├── migrationService.ts # Migration generation
├── reportService.ts    # Report generation
└── ...
```

**Responsibilities**:
- Business logic encapsulation
- Data processing
- Orchestration of operations

#### 4. UI Components

**Sidebar Provider** (`sidebarProvider.ts`):
- Tree view for scan results
- Command buttons
- Status indicators

**Chat Panel Manager** (`chatPanelManager.ts`):
- Webview management
- Message handling
- AI integration

**Editor Integration** (`codeActions.ts`, `diagnostics.ts`):
- Inline diagnostics
- Code actions
- Editor decorations

### State Management

#### State Store (`state/store.ts`)

```typescript
// Centralized state management
class StateStore {
  private state: AppState;
  private listeners: StateListener[] = [];
  
  dispatch(action: Action): void {
    this.state = reducer(this.state, action);
    this.notifyListeners();
  }
  
  getState(): AppState {
    return this.state;
  }
}
```

**State Structure**:
- Scan results
- Migration history
- UI state
- Configuration

## Data Flow

### Scan Workflow

```
User Action (Click "Scan")
    ↓
Command Handler
    ↓
Scan Service
    ↓
API Client → DevSync API
    ↓
CLI Runner → Database
    ↓
Process Results
    ↓
Update State Store
    ↓
Update UI (Sidebar, Diagnostics)
```

### Fix Application Workflow

```
User Action (Click "Apply Fix")
    ↓
Code Action Handler
    ↓
Migration Service
    ↓
Generate Migration
    ↓
Preview Changes
    ↓
User Confirms
    ↓
Apply to Schema
    ↓
Update Diagnostics
```

### Chat Workflow

```
User Message
    ↓
Chat Panel Manager
    ↓
AI API Client
    ↓
Process Response
    ↓
Update Chat UI
    ↓
Store in Conversation History
```

## Design Patterns

### 1. Dependency Injection

**Purpose**: Loose coupling, testability

**Implementation**:
```typescript
// Register services
container.register<IApiClient>('apiClient', ApiClient);

// Resolve dependencies
const apiClient = container.get<IApiClient>('apiClient');
```

### 2. Service Layer Pattern

**Purpose**: Separate business logic from UI

**Implementation**:
```typescript
class ScanService {
  constructor(
    private apiClient: IApiClient,
    private cliRunner: ICliRunner
  ) {}
  
  async scanSchema(): Promise<ScanResult> {
    // Business logic here
  }
}
```

### 3. Repository Pattern

**Purpose**: Abstract data access

**Implementation**:
```typescript
interface ScanRepository {
  save(result: ScanResult): Promise<void>;
  find(id: string): Promise<ScanResult | null>;
}
```

### 4. Observer Pattern

**Purpose**: State updates and notifications

**Implementation**:
```typescript
// State store notifies listeners
store.subscribe((state) => {
  updateUI(state);
});
```

### 5. Factory Pattern

**Purpose**: Object creation

**Implementation**:
```typescript
class ContainerFactory {
  static create(context: ExtensionContext): DIContainer {
    // Create and configure container
  }
}
```

### 6. Plugin Pattern

**Purpose**: Extensibility

**Implementation**:
```typescript
interface IPlugin {
  name: string;
  initialize(container: DIContainer): void;
}

class PluginRegistry {
  register(plugin: IPlugin): void;
  loadAll(): void;
}
```

## Key Technologies

### TypeScript

- **Version**: 5.0.0+
- **Strict Mode**: Enabled
- **Features Used**:
  - Interfaces and types
  - Generics
  - Decorators (future)
  - Async/await

### VS Code Extension API

- **Extension Host**: Runs extension code
- **Webview API**: For chat panel
- **Tree View API**: For sidebar
- **Diagnostics API**: For inline errors
- **Commands API**: For command registration

### Testing

- **Framework**: Mocha
- **VS Code Testing**: @vscode/test-electron
- **Mocking**: Custom mocks for VS Code APIs

### Build Tools

- **TypeScript Compiler**: `tsc`
- **Bundling**: Not required (VS Code handles)
- **Documentation**: TypeDoc

## Extension Points

### 1. Commands

```typescript
// Register command
vscode.commands.registerCommand('devsync.scan', async () => {
  // Command handler
});
```

### 2. Tree View Providers

```typescript
class DevSyncSidebarProvider implements vscode.TreeDataProvider<TreeItem> {
  getChildren(element?: TreeItem): TreeItem[] {
    // Return tree items
  }
}
```

### 3. Webview Providers

```typescript
class ChatViewProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(webviewView: vscode.WebviewView): void {
    // Setup webview
  }
}
```

### 4. Code Action Providers

```typescript
class DevSyncCodeActions implements vscode.CodeActionProvider {
  provideCodeActions(): vscode.CodeAction[] {
    // Return code actions
  }
}
```

### 5. Diagnostics Providers

```typescript
class DevSyncDiagnostics {
  updateDiagnostics(document: vscode.TextDocument): void {
    // Update diagnostics
  }
}
```

## Module Dependencies

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

## Error Handling

### Error Hierarchy

```
DevSyncError (base)
├── ScanError
├── MigrationError
├── AuthError
└── ApiError
```

### Error Flow

```
Operation
    ↓
Try/Catch
    ↓
Error Boundary
    ↓
Error Logger
    ↓
User Notification
```

## Performance Considerations

### Lazy Loading

- Components loaded on demand
- Services initialized when needed
- Webviews created on first use

### Caching

- Scan results cached
- API responses cached
- State persisted

### Background Processing

- Scans run in background
- Migrations generated asynchronously
- UI updates batched

## Security

### Authentication

- Token-based authentication
- Secure token storage (VS Code secrets)
- Token refresh mechanism

### Data Protection

- Credentials encrypted
- Sensitive data masked
- Secure API communication

## Future Architecture

### Planned Improvements

1. **Microservices**: Split into smaller services
2. **Event-Driven**: More event-based communication
3. **Caching Layer**: Redis for distributed caching
4. **GraphQL**: Replace REST API
5. **WebAssembly**: Performance-critical operations

---

**Related Documentation**:
- [API Reference](API_REFERENCE.md)
- [Component Guide](COMPONENTS.md)
- [Extension Points](EXTENSION_POINTS.md)
- [ADR](ADR/)

