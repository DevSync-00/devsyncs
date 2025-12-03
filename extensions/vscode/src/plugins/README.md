# Plugin Architecture

This directory contains the plugin system implementation, addressing improvement 3.2 from the IMPROVEMENTS.md roadmap.

## Overview

The plugin system enables extensibility by allowing:
- **AI Provider Plugins** - Custom AI backends (OpenAI, Anthropic, etc.)
- **Command Handler Plugins** - Custom commands and workflows
- **Integration Plugins** - Third-party service integrations
- **Extension Points** - Hooks into DevSync lifecycle events

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Plugin Registry                             │
│  - Plugin discovery and registration                     │
│  - Plugin lifecycle management                           │
│  - Extension point execution                            │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ AI Provider │ │   Command    │ │ Integration │
│   Plugins   │ │   Plugins    │ │   Plugins   │
└─────────────┘ └─────────────┘ └─────────────┘
```

## Plugin Types

### 1. AI Provider Plugins

Allow custom AI implementations for chat queries.

**Interface:** `IAiProviderPlugin`

**Example:**
```typescript
import { IAiProviderPlugin, AiQueryContext } from './plugins';
import * as vscode from 'vscode';

export class OpenAIPlugin implements IAiProviderPlugin {
  readonly id = 'openai-provider';
  readonly name = 'OpenAI Provider';
  readonly version = '1.0.0';
  
  async activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize OpenAI client
  }
  
  async deactivate(): Promise<void> {
    // Cleanup
  }
  
  async query(
    question: string,
    context: AiQueryContext,
    signal?: AbortSignal
  ): Promise<AiQueryResult> {
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: question }],
      signal
    });
    
    return {
      answer: response.choices[0].message.content,
      question,
      scanReportId: context.scanReportId
    };
  }
  
  getProviderName(): string {
    return 'OpenAI';
  }
  
  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }
  
  getConfigurationOptions(): AiProviderConfigOption[] {
    return [
      {
        key: 'apiKey',
        label: 'API Key',
        description: 'OpenAI API key',
        type: 'password',
        required: true
      }
    ];
  }
}
```

### 2. Command Handler Plugins

Register custom commands that can be invoked from the command palette.

**Interface:** `ICommandHandlerPlugin`

**Example:**
```typescript
import { ICommandHandlerPlugin, CommandHandler } from './plugins';
import * as vscode from 'vscode';

export class CustomCommandsPlugin implements ICommandHandlerPlugin {
  readonly id = 'custom-commands';
  readonly name = 'Custom Commands';
  readonly version = '1.0.0';
  
  async activate(context: vscode.ExtensionContext): Promise<void> {
    // Setup
  }
  
  async deactivate(): Promise<void> {
    // Cleanup
  }
  
  getCommands(): CommandHandler[] {
    return [
      {
        command: 'devsync.custom.export',
        title: 'Export Report',
        category: 'DevSync',
        handler: async () => {
          // Export scan report
          await vscode.window.showInformationMessage('Exporting...');
        }
      }
    ];
  }
}
```

### 3. Integration Plugins

Integrate with third-party services (CI/CD, monitoring, etc.).

**Interface:** `IIntegrationPlugin`

**Example:**
```typescript
import { IIntegrationPlugin } from './plugins';
import { ScanReport } from '../api';
import * as vscode from 'vscode';

export class GitHubIntegrationPlugin implements IIntegrationPlugin {
  readonly id = 'github-integration';
  readonly name = 'GitHub Integration';
  readonly version = '1.0.0';
  
  async activate(context: vscode.ExtensionContext): Promise<void> {
    // Setup GitHub client
  }
  
  async deactivate(): Promise<void> {
    // Cleanup
  }
  
  async onScanComplete(report: ScanReport): Promise<void> {
    // Create GitHub issue for mismatches
    if (report.mismatches.length > 0) {
      await this.createIssue(report);
    }
  }
  
  async onMigrationGenerated(migration: { id: string; filename: string; content: string }): Promise<void> {
    // Create GitHub PR with migration
    await this.createPullRequest(migration);
  }
  
  private async createIssue(report: ScanReport): Promise<void> {
    // Implementation
  }
  
  private async createPullRequest(migration: { id: string; filename: string; content: string }): Promise<void> {
    // Implementation
  }
}
```

## Extension Points

Extension points allow plugins to hook into DevSync lifecycle events.

### Built-in Extension Points

1. **`devsync.scan.complete`** - Triggered when a scan completes
   - Context: `ScanReport`

2. **`devsync.migration.generated`** - Triggered when a migration is generated
   - Context: `Migration`

3. **`devsync.error.occurred`** - Triggered when an error occurs
   - Context: `{ error: Error, operation: string }`

### Using Extension Points

```typescript
// Register a handler
pluginRegistry.registerExtensionHandler({
  extensionPointId: 'devsync.scan.complete',
  handler: async (report: ScanReport) => {
    console.log(`Scan completed: ${report.id}`);
    // Do something with the report
  },
  priority: 100 // Higher priority = executed first
});

// Execute extension point (done automatically by DevSync)
await pluginRegistry.executeExtensionPoint('devsync.scan.complete', scanReport);
```

## Plugin Loading

Plugins are loaded from multiple sources:

1. **Built-in Plugins** - Bundled with the extension
2. **Workspace Plugins** - `.devsync/plugins/` directory
3. **VS Code Extension Contributions** - Other extensions can contribute plugins

### VS Code Extension Contribution

Other extensions can contribute plugins via `package.json`:

```json
{
  "contributes": {
    "devsync.plugins": [
      {
        "id": "my-plugin",
        "name": "My Plugin",
        "version": "1.0.0",
        "entryPoint": "MyPlugin",
        "type": "ai-provider"
      }
    ]
  }
}
```

## Default AI Provider

The `DefaultAiProviderPlugin` wraps the existing `ChatApiClient` to provide
backward compatibility while enabling the plugin system.

## Usage

### Registering a Plugin

```typescript
const pluginRegistry = container.getPluginRegistry();
const plugin = new MyPlugin();
await pluginRegistry.registerPlugin(plugin);
```

### Getting an AI Provider

```typescript
const pluginRegistry = container.getPluginRegistry();

// Get specific provider
const openAI = pluginRegistry.getAiProvider('openai-provider');

// Get default (first configured) provider
const defaultProvider = pluginRegistry.getDefaultAiProvider();

// Use provider
const result = await defaultProvider.query(
  'What are the mismatches?',
  { scanReportId: 'scan-123' }
);
```

### Getting Command Handlers

```typescript
const pluginRegistry = container.getPluginRegistry();
const commands = pluginRegistry.getAllCommandHandlers();

commands.forEach(cmd => {
  vscode.commands.registerCommand(cmd.command, cmd.handler);
});
```

## Integration with Services

The plugin system integrates with the service layer:

- **Scan Service** - Executes extension points on scan completion
- **Migration Service** - Executes extension points on migration generation
- **Chat Panel Manager** - Uses AI provider plugins for queries
- **Commands** - Registers plugin command handlers

## Files

- `interfaces.ts` - Plugin interfaces and types
- `registry.ts` - Plugin registry and manager
- `loader.ts` - Plugin discovery and loading
- `ai/defaultProvider.ts` - Default AI provider plugin
- `index.ts` - Exports

## Future Enhancements

Potential additions:
- Plugin marketplace
- Plugin versioning and updates
- Plugin dependencies
- Plugin configuration UI
- Plugin sandboxing for security
- Plugin performance monitoring

