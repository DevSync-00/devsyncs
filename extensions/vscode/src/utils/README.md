# Utility Modules

This directory contains shared utility modules that eliminate code duplication across the extension, addressing improvement 2.2 from the IMPROVEMENTS.md roadmap.

## Overview

The utility modules provide:
- **Common Utilities** - Shared functions used across multiple files
- **Reusable Components** - UI and command registration helpers
- **DRY Principles** - Don't Repeat Yourself - single source of truth
- **Composition** - Build complex functionality from simple utilities

## Modules

### Delay Utilities (`delay.ts`)

**Purpose:** Async delay and timeout functions

**Functions:**
- `delay(ms)` - Creates a promise that resolves after specified milliseconds
- `timeout(ms, message)` - Creates a promise that rejects after timeout
- `createTimeoutController(ms)` - Creates an AbortController with timeout

**Usage:**
```typescript
import { delay } from './utils';

await delay(1000); // Wait 1 second
```

**Replaces:** Duplicated `delay` functions in `auth.ts` and `chatPanelManager.ts`

### Path Utilities (`paths.ts`)

**Purpose:** File and directory path operations

**Functions:**
- `getDevSyncDir(workspaceFolder)` - Get .devsync directory path
- `getScanResultsPath(workspaceFolder)` - Get scan results file path
- `getMigrationsDir(workspaceFolder)` - Get migrations directory path
- `getConfigPath(workspaceFolder)` - Get config file path
- `ensureDevSyncDir(workspaceFolder)` - Ensure .devsync directory exists
- `ensureMigrationsDir(workspaceFolder)` - Ensure migrations directory exists
- `readJsonFile<T>(filePath)` - Safely read JSON file
- `writeJsonFile<T>(filePath, data)` - Safely write JSON file
- `getFilesInDir(dirPath, pattern?)` - Get files in directory matching pattern
- `getWorkspaceFolder()` - Get first workspace folder or throw error

**Usage:**
```typescript
import { getScanResultsPath, readJsonFile } from './utils/paths';

const path = getScanResultsPath(workspaceFolder);
const data = readJsonFile<ScanReport>(path);
```

**Replaces:** Repeated path construction and file operations across multiple files

### ID Generation (`id.ts`)

**Purpose:** Unique identifier generation

**Functions:**
- `generateId()` - Generate unique ID (UUID or timestamp-based fallback)
- `generateTimestampId()` - Generate timestamp-based ID
- `generateMigrationFilename(format)` - Generate migration filename with timestamp

**Usage:**
```typescript
import { generateId, generateMigrationFilename } from './utils/id';

const id = generateId();
const filename = generateMigrationFilename('sql'); // migration_2024-12-03T10-30-00-000Z.sql
```

**Replaces:** Duplicated ID generation in `chatPanelManager.ts`

### UI Utilities (`ui.ts`)

**Purpose:** VS Code UI component helpers

**Functions:**
- `createStatusBarItem(alignment?, priority?)` - Create status bar item
- `showTemporaryStatusBarItem(text, duration, ...)` - Show temporary status message
- `showProgress(title, task)` - Show progress notification
- `showStatusBarProgress(title, task)` - Show progress in status bar
- `formatMismatchType(type)` - Format mismatch type for display
- `extractSuggestedFix(message)` - Extract suggested fix from message

**Usage:**
```typescript
import { createStatusBarItem, formatMismatchType } from './utils/ui';

const statusBar = createStatusBarItem();
statusBar.text = 'Scanning...';
statusBar.show();

const formatted = formatMismatchType('missing_field'); // "Missing Field"
```

**Replaces:** Repeated status bar creation and formatting logic

### Command Registration (`commands.ts`)

**Purpose:** Command registration helpers

**Functions:**
- `registerCommands(context, registrations)` - Register multiple commands at once
- `createCommand(command, callback, thisArg?)` - Create command registration object
- `registerCommandWithErrorHandling(context, command, callback, thisArg?)` - Register with error handling

**Usage:**
```typescript
import { registerCommands, createCommand } from './utils/commands';

registerCommands(context, [
  createCommand('devsync.scan', () => commands.scan()),
  createCommand('devsync.migrate', () => commands.migrate()),
]);
```

**Replaces:** Repeated `vscode.commands.registerCommand` calls in `extension.ts`

## Benefits

### 1. Reduced Code Duplication

**Before:**
- `delay` function duplicated in `auth.ts` and `chatPanelManager.ts`
- Path construction repeated in multiple files
- Status bar creation repeated
- Command registration pattern repeated 16+ times

**After:**
- Single `delay` function in `utils/delay.ts`
- Centralized path utilities
- Reusable UI helpers
- Batch command registration

### 2. Consistency

All files use the same utilities, ensuring:
- Consistent error handling
- Consistent path construction
- Consistent UI patterns
- Consistent behavior

### 3. Maintainability

Changes to common functionality only need to be made in one place:
- Update path logic once, affects all files
- Update delay behavior once, affects all files
- Update UI patterns once, affects all files

### 4. Testability

Utilities can be tested independently:
- Test path utilities with mock workspace folders
- Test delay utilities with timers
- Test UI utilities with mock VS Code APIs

## Migration Examples

### Before (Duplicated)
```typescript
// In auth.ts
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const handle = setTimeout(() => {
      clearTimeout(handle);
      resolve();
    }, ms);
  });
}

// In chatPanelManager.ts
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### After (Shared)
```typescript
// In auth.ts and chatPanelManager.ts
import { delay } from './utils';
// Use delay() directly
```

### Before (Repeated Path Construction)
```typescript
// In sidebarProvider.ts
const scanResultsPath = join(workspaceFolders[0].uri.fsPath, '.devsync', 'scan-results.json');

// In sidebarCommands.ts
const outputPath = join(workspaceRoot, '.devsync', 'scan-results.json');

// In chatPanelManager.ts
const scanResultsPath = join(workspaceRoot, '.devsync', 'scan-results.json');
```

### After (Centralized)
```typescript
// In all files
import { getScanResultsPath } from './utils/paths';
const path = getScanResultsPath(workspaceFolder);
```

## Integration

All utility modules are exported through `utils/index.ts`:

```typescript
import { delay, generateId, formatMismatchType } from './utils';
```

Or import specific modules:

```typescript
import { getScanResultsPath } from './utils/paths';
import { createStatusBarItem } from './utils/ui';
```

## Files Using Utilities

- ✅ `auth.ts` - Uses `delay`
- ✅ `chatPanelManager.ts` - Uses `delay`, `generateId`, path utilities
- ✅ `sidebarProvider.ts` - Uses path utilities, `formatMismatchType`
- ✅ `sidebarCommands.ts` - Uses path utilities, `generateMigrationFilename`
- ✅ `commands.ts` - Uses `createStatusBarItem`
- ✅ `extension.ts` - Uses `registerCommands`
- ✅ `diagnostics.ts` - Uses formatting utilities
- ✅ `codeActions.ts` - Uses formatting utilities

## Future Enhancements

Potential additions:
- String formatting utilities
- Date/time formatting utilities
- Validation utilities
- Network request utilities
- File watching utilities

