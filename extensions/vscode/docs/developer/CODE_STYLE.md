# Code Style Guide

Coding standards and conventions for DevSync.

## Table of Contents

1. [TypeScript Style](#typescript-style)
2. [Naming Conventions](#naming-conventions)
3. [Documentation Standards](#documentation-standards)
4. [Testing Patterns](#testing-patterns)
5. [File Organization](#file-organization)
6. [Best Practices](#best-practices)

## TypeScript Style

### General Rules

- **Strict Mode**: Always enabled
- **No `any`**: Use proper types
- **Explicit Types**: Prefer explicit over implicit
- **Async/Await**: Use over promises
- **Error Handling**: Always handle errors

### Code Formatting

**Use Prettier**:
```bash
npm run format
```

**Configuration** (`.prettierrc.json`):
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 120,
  "tabWidth": 2
}
```

### Type Definitions

**Prefer Interfaces**:
```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
}

// ❌ Avoid
type User = {
  id: string;
  name: string;
};
```

**Use Types for Unions**:
```typescript
// ✅ Good
type Status = 'active' | 'inactive' | 'pending';

// ✅ Good
type Result<T> = Success<T> | Error;
```

### Function Declarations

**Prefer Arrow Functions**:
```typescript
// ✅ Good
const processData = async (data: Data): Promise<Result> => {
  // ...
};

// ❌ Avoid
async function processData(data: Data): Promise<Result> {
  // ...
}
```

**Export Functions**:
```typescript
// ✅ Good
export const processData = async (data: Data): Promise<Result> => {
  // ...
};

// ✅ Good (for classes)
export class DataProcessor {
  async process(data: Data): Promise<Result> {
    // ...
  }
}
```

### Error Handling

**Always Handle Errors**:
```typescript
// ✅ Good
try {
  await operation();
} catch (error) {
  errorLogger.logError(error);
  throw new DevSyncError('Operation failed', error);
}

// ❌ Avoid
await operation(); // No error handling
```

**Use Custom Error Types**:
```typescript
// ✅ Good
throw new ScanError('Scan failed', { scanId: '123' });

// ❌ Avoid
throw new Error('Scan failed');
```

## Naming Conventions

### Variables and Functions

**camelCase**:
```typescript
// ✅ Good
const userName = 'John';
const processData = () => {};

// ❌ Avoid
const user_name = 'John';
const ProcessData = () => {};
```

### Classes and Interfaces

**PascalCase**:
```typescript
// ✅ Good
class DataProcessor {}
interface IApiClient {}

// ❌ Avoid
class dataProcessor {}
interface apiClient {}
```

### Constants

**UPPER_SNAKE_CASE**:
```typescript
// ✅ Good
const MAX_RETRIES = 3;
const API_BASE_URL = 'https://api.example.com';

// ❌ Avoid
const maxRetries = 3;
const apiBaseUrl = 'https://api.example.com';
```

### Private Members

**Prefix with Underscore**:
```typescript
// ✅ Good
class Service {
  private _internalState: State;
  
  private _processData(): void {
    // ...
  }
}

// ❌ Avoid
class Service {
  private internalState: State;
  
  private processData(): void {
    // ...
  }
}
```

### File Names

**kebab-case**:
```typescript
// ✅ Good
scan-service.ts
api-client.ts
error-handler.ts

// ❌ Avoid
scanService.ts
apiClient.ts
errorHandler.ts
```

## Documentation Standards

### JSDoc Comments

**Public APIs**:
```typescript
/**
 * Scans Prisma schema for mismatches with database.
 * 
 * @param request - Scan request containing schema and options
 * @returns Promise resolving to scan results
 * @throws {ScanError} If scan fails
 * 
 * @example
 * ```typescript
 * const result = await scanService.scanSchema({
 *   schema: schemaContent,
 *   databaseUrl: 'postgresql://...'
 * });
 * ```
 */
async scanSchema(request: ScanRequest): Promise<ScanResult> {
  // ...
}
```

**Parameters and Returns**:
```typescript
/**
 * Processes data and returns result.
 * 
 * @param data - Input data to process
 * @param options - Processing options
 * @returns Processed result
 */
function processData(data: Data, options?: Options): Result {
  // ...
}
```

### Inline Comments

**Explain Why, Not What**:
```typescript
// ✅ Good
// Retry with exponential backoff to handle transient failures
await retryWithBackoff(operation);

// ❌ Avoid
// Call retry function
await retryWithBackoff(operation);
```

**Complex Logic**:
```typescript
// ✅ Good
// Calculate complexity: base (1) + decision points (if, for, while, etc.)
const complexity = 1 + decisionPoints.reduce((sum, point) => sum + point.weight, 0);

// ❌ Avoid
// Calculate complexity
const complexity = 1 + decisionPoints.reduce((sum, point) => sum + point.weight, 0);
```

## Testing Patterns

### Test Structure

**Use Mocha**:
```typescript
import { suite, test, setup, teardown } from 'mocha';
import * as assert from 'assert';

suite('ScanService', () => {
  let service: ScanService;
  
  setup(() => {
    service = new ScanService(mockApiClient, mockCliRunner);
  });
  
  teardown(() => {
    // Cleanup
  });
  
  test('should scan schema successfully', async () => {
    const result = await service.scanSchema({ schema: '...' });
    assert.ok(result);
    assert.strictEqual(result.mismatches.length, 0);
  });
});
```

### Test Naming

**Descriptive Names**:
```typescript
// ✅ Good
test('should return error when schema is invalid', async () => {});
test('should handle network errors gracefully', async () => {});
test('should cache scan results for 5 minutes', async () => {});

// ❌ Avoid
test('test scan', async () => {});
test('error handling', async () => {});
test('cache', async () => {});
```

### Mocking

**Mock External Dependencies**:
```typescript
// ✅ Good
const mockApiClient: IApiClient = {
  scanSchema: async () => ({ scanId: '123', mismatches: [] })
};

// ❌ Avoid
const apiClient = new ApiClient(); // Don't use real API in tests
```

## File Organization

### Import Order

1. External dependencies
2. Internal modules
3. Types
4. Utilities

```typescript
// ✅ Good
import * as vscode from 'vscode';
import { DIContainer } from '../di/container';
import { IApiClient } from '../interfaces/api';
import { ScanRequest, ScanResponse } from '../types';
import { delay } from '../utils/delay';

// ❌ Avoid
import { delay } from '../utils/delay';
import * as vscode from 'vscode';
import { ScanRequest, ScanResponse } from '../types';
```

### File Structure

```typescript
// 1. Imports
import ... from ...;

// 2. Types/Interfaces
interface LocalType { ... }

// 3. Constants
const CONSTANT = 'value';

// 4. Classes/Functions
export class MyClass { ... }

// 5. Exports
export { MyClass, LocalType };
```

## Best Practices

### 1. Keep Functions Small

```typescript
// ✅ Good
async function scanSchema(request: ScanRequest): Promise<ScanResult> {
  validateRequest(request);
  const result = await executeScan(request);
  return processResults(result);
}

// ❌ Avoid
async function scanSchema(request: ScanRequest): Promise<ScanResult> {
  // 100+ lines of code
}
```

### 2. Avoid Deep Nesting

```typescript
// ✅ Good
if (!condition) return;
if (!anotherCondition) return;
// Process

// ❌ Avoid
if (condition) {
  if (anotherCondition) {
    // Process
  }
}
```

### 3. Use Early Returns

```typescript
// ✅ Good
function process(data: Data): Result | null {
  if (!data) return null;
  if (!data.isValid) return null;
  // Process
}

// ❌ Avoid
function process(data: Data): Result | null {
  if (data) {
    if (data.isValid) {
      // Process
    }
  }
  return null;
}
```

### 4. Prefer Composition Over Inheritance

```typescript
// ✅ Good
class Service {
  constructor(private apiClient: IApiClient) {}
}

// ❌ Avoid
class Service extends ApiClient {}
```

### 5. Use Enums for Constants

```typescript
// ✅ Good
enum MismatchType {
  MissingField = 'missing_field',
  TypeMismatch = 'type_mismatch'
}

// ❌ Avoid
const MISMATCH_TYPE_MISSING_FIELD = 'missing_field';
const MISMATCH_TYPE_TYPE_MISMATCH = 'type_mismatch';
```

### 6. Avoid Magic Numbers

```typescript
// ✅ Good
const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

if (retries < MAX_RETRIES) { ... }

// ❌ Avoid
if (retries < 3) { ... }
```

### 7. Use Optional Chaining

```typescript
// ✅ Good
const value = data?.nested?.property;

// ❌ Avoid
const value = data && data.nested && data.nested.property;
```

### 8. Use Nullish Coalescing

```typescript
// ✅ Good
const value = input ?? defaultValue;

// ❌ Avoid
const value = input || defaultValue; // Fails for 0, false, ''
```

## Linting Rules

**ESLint Configuration** (`.eslintrc.json`):
- No `any` types
- No unused variables
- Explicit return types
- No floating promises
- Max complexity: 10
- Max line length: 120

**Run Linting**:
```bash
npm run lint
npm run lint:fix
```

## Code Review Checklist

- [ ] Follows style guide
- [ ] Properly typed
- [ ] Error handling present
- [ ] Tests added
- [ ] Documentation updated
- [ ] No linting errors
- [ ] No magic numbers
- [ ] Functions are small
- [ ] No code duplication

---

**Related Documentation**:
- [Development Setup](DEVELOPMENT_SETUP.md)
- [Contribution Guidelines](CONTRIBUTING.md)
- [Architecture Overview](ARCHITECTURE.md)

