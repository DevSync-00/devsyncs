# Error Handling System

This directory contains the comprehensive error handling implementation for the DevSync VS Code extension, addressing improvement 1.2 from the IMPROVEMENTS.md roadmap.

## Overview

The error handling system provides:
- **Custom Error Classes** - Type-safe error handling with context
- **Error Logging Service** - Centralized error logging and tracking
- **Error Recovery** - Automatic recovery suggestions and retry mechanisms
- **Error Boundary** - Safe error handling wrapper for async operations
- **User-Friendly Messages** - Actionable error messages with recovery suggestions

## Structure

### Base Error (`base.ts`)
- `DevSyncError` - Base error class with code, user message, and recovery actions
- `ErrorCode` - Enumeration of all error codes

### Specific Error Types
- `ScanError` (`scanError.ts`) - Errors during scan operations
- `MigrationError` (`migrationError.ts`) - Errors during migration operations
- `AuthError` (`authError.ts`) - Errors during authentication

### Error Services
- `ErrorLogger` (`logger.ts`) - Centralized error logging with output channel
- `ErrorRecovery` (`recovery.ts`) - Recovery strategies and retry mechanisms
- `ErrorBoundary` (`boundary.ts`) - Error boundary pattern for safe error handling

## Usage

### Creating Errors

```typescript
import { ScanError } from './errors';

// Create a specific error
throw ScanError.noWorkspace();

// Create from existing error
try {
  await apiClient.scan(path);
} catch (error) {
  throw ScanError.fromError(error, { path });
}
```

### Using Error Boundary

```typescript
import { ErrorBoundary } from './errors/boundary';
import { ErrorLogger } from './errors/logger';

const logger = new ErrorLogger();
const boundary = new ErrorBoundary(logger);

// Wrap async operation
await boundary.wrap(async () => {
  await performOperation();
}, { operation: 'scan' });
```

### Logging Errors

```typescript
import { ErrorLogger, ErrorSeverity } from './errors/logger';

const logger = new ErrorLogger();
logger.logError(error, ErrorSeverity.ERROR, { context: 'additional info' });
```

### Error Recovery

```typescript
import { ErrorRecovery } from './errors/recovery';

const recovery = await ErrorRecovery.recover(error);
if (recovery.retry) {
  await recovery.retry();
}
```

## Error Codes

All error codes are defined in the `ErrorCode` enum:

- **Scan Errors**: `SCAN_FAILED`, `SCAN_TIMEOUT`, `SCAN_INVALID_CONFIG`, `SCAN_NO_WORKSPACE`
- **Migration Errors**: `MIGRATION_FAILED`, `MIGRATION_INVALID`, `MIGRATION_NO_SCAN`, `MIGRATION_DB_ERROR`
- **Auth Errors**: `AUTH_FAILED`, `AUTH_EXPIRED`, `AUTH_INVALID_TOKEN`, `AUTH_NETWORK_ERROR`
- **API Errors**: `API_NETWORK_ERROR`, `API_UNAUTHORIZED`, `API_NOT_FOUND`, `API_SERVER_ERROR`, `API_TIMEOUT`
- **CLI Errors**: `CLI_NOT_FOUND`, `CLI_EXECUTION_FAILED`, `CLI_BUILD_FAILED`
- **Config Errors**: `CONFIG_INVALID`, `CONFIG_MISSING`
- **Generic**: `UNKNOWN_ERROR`, `VALIDATION_ERROR`

## Features

### User-Friendly Messages
All errors include user-friendly messages that explain what went wrong in plain language.

### Recovery Actions
Many errors include recovery actions that suggest what the user can do to fix the issue.

### Context Preservation
Errors preserve context about where and why they occurred, making debugging easier.

### Automatic Retry
The error recovery system can automatically retry operations with exponential backoff.

### Error Logging
All errors are automatically logged to an output channel with full context and stack traces.

## Integration

The error handling system is integrated into:
- `DevSyncCommands` - All command operations use error boundaries
- `DIContainer` - Error logger is available as a service
- All error-prone operations are wrapped with error boundaries

## Benefits

1. **Consistent Error Handling** - All errors follow the same pattern
2. **Better User Experience** - Clear, actionable error messages
3. **Easier Debugging** - Full context and stack traces in logs
4. **Automatic Recovery** - Smart retry and recovery mechanisms
5. **Type Safety** - TypeScript ensures error types are correct

