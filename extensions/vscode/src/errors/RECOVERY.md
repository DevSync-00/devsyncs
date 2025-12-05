# Error Recovery System

This module provides comprehensive error recovery mechanisms including automatic retry, partial success handling, rollback capabilities, intelligent suggestions, state saving, and undo functionality.

## Features

### 1. Automatic Retry with Exponential Backoff

The `RetryManager` provides configurable retry strategies:

- **Exponential backoff**: Delays increase exponentially between retries
- **Jitter**: Random variation in delays to prevent thundering herd
- **Custom retry conditions**: Retry only on specific error types
- **Network error detection**: Automatic retry on network-related errors
- **Configurable limits**: Max retries, initial delay, max delay

### 2. Partial Success Handling

The `PartialSuccessHandler` processes items with graceful degradation:

- **Continue on error**: Process remaining items even if some fail
- **Success rate threshold**: Define minimum success rate for overall success
- **Batch processing**: Process items in batches with progress tracking
- **Individual error handling**: Callback for each failed item
- **Summary reporting**: Get detailed summary of successes and failures

### 3. Rollback Capabilities

The `RollbackManager` provides state management and rollback:

- **State snapshots**: Save state before risky operations
- **Automatic rollback**: Rollback on error automatically
- **Manual rollback**: Rollback to specific state or last operation
- **State history**: Track multiple states for complex operations
- **Operation tracking**: Associate states with specific operations

### 4. Error Recovery Suggestions

The `ErrorSuggestionProvider` provides intelligent recovery suggestions:

- **Context-aware**: Suggestions based on error type and context
- **Prioritized**: Suggestions sorted by priority
- **Actionable**: Direct actions to resolve errors
- **Multiple options**: Show primary suggestion or all suggestions
- **Error-specific**: Different suggestions for scan, migration, and auth errors

### 5. Save State Before Risky Operations

The `StateSaver` automatically saves state before operations:

- **Automatic saving**: Save state before risky operations
- **State restoration**: Restore state on error
- **Integration with rollback**: Works with rollback manager
- **Operation tracking**: Track which operation saved which state

### 6. Undo Last Action

Integrated undo functionality:

- **Last operation undo**: Undo the most recent operation
- **State restoration**: Restore previous state
- **Command integration**: Available via `devsync.undoLast` command
- **Status feedback**: Shows confirmation when undo completes

## Usage

### Retry with Exponential Backoff

```typescript
import { RetryManager } from './errors';

// Basic retry
const result = await RetryManager.retry(
  async () => {
    return await someOperation();
  },
  {
    maxRetries: 3,
    initialDelay: 1000,
    multiplier: 2,
    jitter: true,
  }
);

if (result.success) {
  console.log('Operation succeeded:', result.value);
} else {
  console.error('Operation failed after', result.attempts, 'attempts');
}

// Retry only on network errors
const networkResult = await RetryManager.retryOnNetworkError(
  async () => await apiCall()
);
```

### Partial Success Handling

```typescript
import { PartialSuccessHandler } from './errors';

const items = [item1, item2, item3, item4, item5];

const result = await PartialSuccessHandler.processItems(
  items,
  async (item) => {
    return await processItem(item);
  },
  {
    continueOnError: true,
    minSuccessRate: 0.6, // 60% success required
    onItemError: (item, error) => {
      console.error(`Failed to process ${item.id}:`, error);
    },
  }
);

console.log(PartialSuccessHandler.getSummaryMessage(result));
// "4 of 5 items processed successfully. 1 failed."
```

### Rollback

```typescript
import { RollbackManager, getRollbackManager } from './errors';

const rollbackManager = getRollbackManager();

// Save state before operation
const stateId = rollbackManager.saveState(
  'migration',
  { schema: currentSchema },
  async () => {
    // Rollback function
    await restoreSchema(currentSchema);
  }
);

try {
  await performMigration();
} catch (error) {
  // Rollback on error
  await rollbackManager.rollbackTo(stateId);
}

// Or use executeWithRollback
await rollbackManager.executeWithRollback(
  'migration',
  async () => await performMigration(),
  async () => await restoreSchema(),
  async () => ({ schema: currentSchema })
);
```

### Error Recovery Suggestions

```typescript
import { ErrorSuggestionProvider } from './errors';
import { ScanError } from './errors';

try {
  await scan();
} catch (error) {
  if (error instanceof ScanError) {
    // Show suggestions to user
    await ErrorSuggestionProvider.showSuggestions(error);
    
    // Or get suggestions programmatically
    const suggestions = ErrorSuggestionProvider.getSuggestions(error);
    suggestions.forEach(suggestion => {
      console.log(suggestion.title, suggestion.description);
    });
  }
}
```

### Enhanced Recovery

```typescript
import { EnhancedRecovery } from './errors';

const recovery = new EnhancedRecovery(stateStore);

const result = await recovery.execute(
  async () => {
    return await riskyOperation();
  },
  {
    retry: { enabled: true, maxRetries: 3, initialDelay: 1000 },
    saveState: { enabled: true, operation: 'scan' },
    showSuggestions: true,
    onError: (error) => {
      console.error('Operation failed:', error);
    },
  }
);

if (result.success) {
  console.log('Operation succeeded');
} else {
  console.error('Operation failed after', result.retryAttempts, 'attempts');
}
```

### Undo Last Action

```typescript
// Via command
await vscode.commands.executeCommand('devsync.undoLast');

// Programmatically
await enhancedRecovery.undoLast();
```

## Integration

The error recovery system is integrated into `DevSyncCommands`:

- **Scan command**: Uses enhanced recovery with retry, state saving, and suggestions
- **Migration generation**: Uses enhanced recovery with retry and state saving
- **Automatic retry**: Network errors are automatically retried
- **State saving**: State is saved before risky operations
- **Rollback**: Automatic rollback on error
- **Suggestions**: Intelligent suggestions shown to users

## Error Types

The system handles different error types:

- **ScanError**: Network errors, configuration errors, database connection errors
- **MigrationError**: No scan report, database errors, validation errors
- **AuthError**: Expired tokens, invalid tokens, network errors
- **Generic errors**: Fallback suggestions for unknown errors

## Configuration

Recovery behavior can be configured per operation:

```typescript
{
  retry: {
    enabled: true,
    maxRetries: 3,
    initialDelay: 1000,
  },
  partialSuccess: {
    enabled: true,
    continueOnError: true,
    minSuccessRate: 0.5,
  },
  saveState: {
    enabled: true,
    operation: 'operation-name',
  },
  showSuggestions: true,
}
```

## Best Practices

1. **Use retry for transient errors**: Network errors, timeouts
2. **Use partial success for batch operations**: Processing multiple items
3. **Save state before risky operations**: Migrations, schema changes
4. **Show suggestions for user errors**: Configuration issues, missing data
5. **Use rollback for destructive operations**: Operations that modify state
6. **Provide undo for user actions**: Allow users to undo mistakes

## Future Enhancements

- Recovery strategy persistence
- Machine learning for error prediction
- Custom recovery strategies per error type
- Recovery analytics and reporting
- Integration with external monitoring services

