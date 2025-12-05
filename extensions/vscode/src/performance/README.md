# Performance Optimizations - Startup Performance

This module provides comprehensive startup performance optimizations for the DevSync VS Code extension, addressing section 1 of the Performance Optimizations roadmap.

## Features

### 1. Lazy Loading

Components are loaded only when needed:

```typescript
import { LazyLoader } from './performance';

// Register a lazy loader
LazyLoader.register('helpSystem', async () => {
  const { initializeHelpSystem } = await import('./help');
  return initializeHelpSystem;
});

// Load when needed
const helpSystem = await LazyLoader.load('helpSystem');
```

### 2. Deferred Initialization

Non-critical initialization is deferred until after startup:

```typescript
import { DeferredInitManager, InitPriority } from './performance';

// Register deferred task
DeferredInitManager.register({
  name: 'helpSystem',
  priority: InitPriority.NORMAL,
  task: async () => {
    // Initialize help system
  },
});

// Execute critical tasks immediately
await DeferredInitManager.executeCritical();

// Execute high priority tasks
await DeferredInitManager.executeHigh();

// Normal priority tasks execute automatically after 2 seconds
```

### 3. Background Loading

Data is loaded in the background without blocking:

```typescript
import { BackgroundLoader } from './performance';

// Register background loader
BackgroundLoader.register('scanResults', async () => {
  return await apiClient.getLatestScanReport();
});

// Start loading in background
BackgroundLoader.startLoading('scanResults');

// Get data when needed (waits if still loading)
const results = await BackgroundLoader.load('scanResults');
```

### 4. Progressive Enhancement

Features are loaded progressively as needed:

```typescript
import { ProgressiveEnhancement } from './performance';

// Register feature
ProgressiveEnhancement.register({
  name: 'editorFeatures',
  load: async () => {
    const { EnhancedCodeActions } = await import('./editor');
    // Initialize editor features
  },
  activateOn: ['onCommand:devsync.previewFix'],
});

// Load feature when command is invoked
await ProgressiveEnhancement.loadFeature('editorFeatures');
```

### 5. Caching

Frequently accessed data is cached:

```typescript
import { CacheManager } from './performance';

// Create cache
CacheManager.createCache('config', {
  ttl: 10 * 60 * 1000, // 10 minutes
  maxSize: 50,
  evictionStrategy: 'lru',
});

// Get from cache
const config = CacheManager.get('config', 'apiUrl');

// Set in cache
CacheManager.set('config', 'apiUrl', 'http://localhost:3000');
```

### 6. Startup Optimizer

Centralized coordination of all optimizations:

```typescript
import { StartupOptimizer } from './performance';

// Initialize on extension activation
StartupOptimizer.initialize(context);

// Register lazy components
StartupOptimizer.registerLazyComponent('helpSystem', async () => {
  const { initializeHelpSystem } = await import('./help');
  return initializeHelpSystem;
});

// Register deferred tasks
StartupOptimizer.registerDeferredTask(
  'helpSystem',
  InitPriority.NORMAL,
  async () => {
    // Initialize help system
  }
);

// Execute critical tasks
await StartupOptimizer.executeCritical();
```

## Usage Example

```typescript
export async function activate(context: vscode.ExtensionContext) {
  // Initialize startup optimizer
  StartupOptimizer.initialize(context);

  // Critical: DI container (must be immediate)
  const container = ContainerFactory.create(context);

  // Critical: Core services
  const apiClient = container.getApiClient();
  const commands = container.getCommands();

  // High priority: Sidebar (deferred but soon)
  StartupOptimizer.registerDeferredTask(
    'sidebar',
    InitPriority.HIGH,
    async () => {
      const sidebarProvider = new DevSyncSidebarProvider(cliRunner, context);
      // Register sidebar
    }
  );

  // Normal priority: Help system (deferred until idle)
  StartupOptimizer.registerDeferredTask(
    'helpSystem',
    InitPriority.NORMAL,
    async () => {
      const { initializeHelpSystem } = await import('./help');
      initializeHelpSystem(context);
    }
  );

  // Low priority: Editor features (load on demand)
  StartupOptimizer.registerFeature({
    name: 'editorFeatures',
    load: async () => {
      const { EnhancedCodeActions } = await import('./editor');
      // Initialize editor features
    },
    activateOn: ['onCommand:devsync.previewFix'],
  });

  // Execute critical tasks
  await StartupOptimizer.executeCritical();

  // High priority tasks execute automatically after a short delay
  // Normal priority tasks execute after 2 seconds
  // Low priority tasks execute when features are accessed
}
```

## Performance Benefits

- **Faster startup**: Only critical components load immediately
- **Reduced memory**: Components loaded only when needed
- **Better responsiveness**: Background loading doesn't block UI
- **Progressive enhancement**: Features load as users interact
- **Efficient caching**: Frequently accessed data is cached

## Best Practices

1. **Critical components**: Load immediately (DI container, core services)
2. **High priority**: Defer but load soon (sidebar, basic UI)
3. **Normal priority**: Load when idle (help system, non-essential features)
4. **Low priority**: Load on demand (advanced features, editor enhancements)
5. **Cache wisely**: Cache frequently accessed, rarely changing data
6. **Background loading**: Load data that might be needed soon

