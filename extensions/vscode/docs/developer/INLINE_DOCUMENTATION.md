# Inline Documentation Guide

Standards and best practices for inline documentation in DevSync.

## Table of Contents

1. [JSDoc Standards](#jsdoc-standards)
2. [Type Definitions](#type-definitions)
3. [Code Comments](#code-comments)
4. [Tooltips and UI Help](#tooltips-and-ui-help)
5. [Contextual Help](#contextual-help)
6. [Usage Examples](#usage-examples)

## JSDoc Standards

### Public APIs

All public APIs must have JSDoc comments.

**Required Elements**:
- Description
- `@param` for each parameter
- `@returns` for return value
- `@throws` for exceptions
- `@example` for usage examples

**Example**:
```typescript
/**
 * Scans Prisma schema for mismatches with database.
 * 
 * This method performs a comprehensive scan comparing the Prisma schema
 * with the actual database structure, identifying any discrepancies.
 * 
 * @param request - Scan request containing schema content and options
 * @param request.schema - Prisma schema content as string
 * @param request.databaseUrl - Optional database connection URL
 * @param request.options - Optional scan configuration
 * @returns Promise resolving to scan results with detected mismatches
 * @throws {ScanError} If schema is invalid or scan fails
 * @throws {AuthError} If authentication fails
 * 
 * @example
 * ```typescript
 * const result = await scanService.scanSchema({
 *   schema: schemaContent,
 *   databaseUrl: 'postgresql://user:pass@localhost/db',
 *   options: {
 *     includeWarnings: true,
 *     strictMode: false
 *   }
 * });
 * console.log(`Found ${result.mismatches.length} mismatches`);
 * ```
 */
async scanSchema(request: ScanRequest): Promise<ScanResponse> {
  // Implementation
}
```

### Classes

**Required Elements**:
- Class description
- `@example` for usage

**Example**:
```typescript
/**
 * Service for scanning Prisma schemas and detecting mismatches.
 * 
 * This service orchestrates the scanning process by coordinating
 * between the API client and CLI runner to perform comprehensive
 * schema analysis.
 * 
 * @example
 * ```typescript
 * const scanService = container.get<ScanService>('scanService');
 * const result = await scanService.scanSchema({
 *   schema: schemaContent
 * });
 * ```
 */
export class ScanService {
  // Implementation
}
```

### Interfaces

**Required Elements**:
- Interface description
- Property descriptions
- `@example` for usage

**Example**:
```typescript
/**
 * Request object for schema scanning operation.
 * 
 * @example
 * ```typescript
 * const request: ScanRequest = {
 *   schema: schemaContent,
 *   databaseUrl: 'postgresql://...',
 *   options: {
 *     includeWarnings: true
 *   }
 * };
 * ```
 */
interface ScanRequest {
  /**
   * Prisma schema content as string.
   * Must be valid Prisma schema syntax.
   */
  schema: string;
  
  /**
   * Optional database connection URL.
   * If not provided, uses configured default.
   */
  databaseUrl?: string;
  
  /**
   * Optional scan configuration options.
   */
  options?: ScanOptions;
}
```

### Methods

**Required Elements**:
- Method description
- Parameter descriptions
- Return value description
- Exception descriptions

**Example**:
```typescript
/**
 * Generates migration SQL from detected mismatches.
 * 
 * @param request - Migration generation request
 * @param request.scanId - ID of the scan to generate migration from
 * @param request.mismatches - Array of mismatch IDs to include
 * @param request.options - Optional migration options
 * @returns Promise resolving to generated migration SQL
 * @throws {MigrationError} If migration generation fails
 * @throws {ValidationError} If request is invalid
 */
async generateMigration(request: MigrationRequest): Promise<MigrationResponse> {
  // Implementation
}
```

### Properties

**Required Elements**:
- Property description
- Type information (if not obvious)

**Example**:
```typescript
class ScanService {
  /**
   * Maximum number of retry attempts for failed scans.
   * Default: 3
   */
  private readonly maxRetries: number = 3;
  
  /**
   * Current scan results cache.
   * Maps scan ID to scan result.
   */
  private readonly cache: Map<string, ScanResult> = new Map();
}
```

## Type Definitions

### Type Descriptions

All exported types must have descriptions.

**Example**:
```typescript
/**
 * Result of a schema scan operation.
 * 
 * Contains detected mismatches and summary statistics.
 */
export interface ScanResult {
  /**
   * Unique identifier for this scan.
   */
  scanId: string;
  
  /**
   * Timestamp when scan was performed.
   */
  timestamp: Date;
  
  /**
   * Array of detected mismatches.
   * Empty array indicates no mismatches found.
   */
  mismatches: Mismatch[];
  
  /**
   * Summary statistics for the scan.
   */
  summary: ScanSummary;
}

/**
 * Summary statistics for a scan operation.
 */
export interface ScanSummary {
  /**
   * Total number of mismatches detected.
   */
  totalMismatches: number;
  
  /**
   * Number of error-level mismatches.
   */
  errors: number;
  
  /**
   * Number of warning-level mismatches.
   */
  warnings: number;
  
  /**
   * Number of info-level mismatches.
   */
  info: number;
}
```

### Enum Descriptions

**Example**:
```typescript
/**
 * Type of mismatch detected during schema scan.
 */
export enum MismatchType {
  /**
   * Field exists in schema but not in database.
   */
  MissingField = 'missing_field',
  
  /**
   * Field type differs between schema and database.
   */
  TypeMismatch = 'type_mismatch',
  
  /**
   * Table exists in schema but not in database.
   */
  MissingTable = 'missing_table',
  
  /**
   * Constraint differs between schema and database.
   */
  ConstraintMismatch = 'constraint_mismatch',
  
  /**
   * Index differs between schema and database.
   */
  IndexMismatch = 'index_mismatch'
}
```

## Code Comments

### Inline Comments

**When to Use**:
- Complex algorithms
- Non-obvious logic
- Workarounds or hacks
- Performance optimizations
- Business rules

**Guidelines**:
- Explain **why**, not **what**
- Keep comments up-to-date
- Use clear, concise language
- Avoid redundant comments

**Example**:
```typescript
// ✅ Good: Explains why
// Retry with exponential backoff to handle transient network failures
// that may occur during high-load periods
await retryWithBackoff(operation, { maxRetries: 3, baseDelay: 1000 });

// ❌ Bad: States the obvious
// Call retry function
await retryWithBackoff(operation);

// ✅ Good: Explains complex logic
// Calculate maintainability index using formula:
// MI = 171 - 5.2 * ln(Halstead Volume) - 0.23 * Cyclomatic Complexity - 16.2 * ln(LOC)
const mi = 171 - 5.2 * Math.log(halsteadVolume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(loc);

// ❌ Bad: No explanation for complex calculation
const mi = 171 - 5.2 * Math.log(halsteadVolume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(loc);
```

### Block Comments

**Use for**:
- Complex algorithms
- Multi-step processes
- Important notes

**Example**:
```typescript
/**
 * Processes scan results and updates diagnostics.
 * 
 * This method performs the following steps:
 * 1. Validates scan results
 * 2. Groups mismatches by severity
 * 3. Creates diagnostics for each mismatch
 * 4. Updates VS Code diagnostics collection
 * 5. Notifies listeners of changes
 */
private async processScanResults(results: ScanResult): Promise<void> {
  // Step 1: Validate
  if (!results || !results.mismatches) {
    throw new Error('Invalid scan results');
  }
  
  // Step 2: Group by severity
  const grouped = this.groupBySeverity(results.mismatches);
  
  // Step 3: Create diagnostics
  const diagnostics = this.createDiagnostics(grouped);
  
  // Step 4: Update collection
  this.diagnosticsCollection.set(document.uri, diagnostics);
  
  // Step 5: Notify listeners
  this.notifyListeners(results);
}
```

### TODO Comments

**Format**:
```typescript
// TODO: Description of what needs to be done
// TODO(username): Description with assignee
// TODO(#123): Description with issue reference
```

**Example**:
```typescript
// TODO: Implement caching for scan results to improve performance
// TODO(john): Add support for MySQL database type
// TODO(#456): Refactor error handling to use error boundary pattern
```

### FIXME Comments

**Format**:
```typescript
// FIXME: Description of what's broken
// FIXME(username): Description with assignee
// FIXME(#123): Description with issue reference
```

**Example**:
```typescript
// FIXME: This workaround should be removed when API supports batch operations
// FIXME(jane): Memory leak in event listener - needs proper cleanup
// FIXME(#789): Race condition when multiple scans run simultaneously
```

### HACK Comments

**Format**:
```typescript
// HACK: Description of why this is a hack
```

**Example**:
```typescript
// HACK: VS Code API doesn't support custom diagnostic icons,
// so we use emoji in the message as a workaround
diagnostic.message = `⚠️ ${diagnostic.message}`;
```

## Tooltips and UI Help

### VS Code Command Tooltips

**Format**: Use `title` property in command contributions

**Example** (`package.json`):
```json
{
  "contributes": {
    "commands": [
      {
        "command": "devsync.scan",
        "title": "Scan Schema",
        "category": "DevSync",
        "icon": "$(search)",
        "tooltip": "Scans your Prisma schema and compares it with the database to detect mismatches. Results are displayed in the sidebar and as inline diagnostics."
      }
    ]
  }
}
```

### Tree Item Tooltips

**Example**:
```typescript
const treeItem = new vscode.TreeItem('Scan Results');
treeItem.tooltip = new vscode.MarkdownString(`
  **Scan Results**
  
  Displays all detected mismatches between your Prisma schema and database.
  
  - **Errors**: Critical issues that must be fixed
  - **Warnings**: Issues that should be reviewed
  - **Info**: Informational suggestions
  
  Click on a mismatch to see details and suggested fixes.
`);
```

### Status Bar Tooltips

**Example**:
```typescript
const statusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right,
  100
);
statusBarItem.text = '$(sync) DevSync';
statusBarItem.tooltip = 'DevSync: Click to scan schema or view scan results';
statusBarItem.command = 'devsync.scan';
```

### Webview Tooltips

**HTML Example**:
```html
<button 
  title="Scan your Prisma schema for mismatches with the database. Results will appear in the sidebar."
  data-tooltip="Scan Schema"
>
  Scan Schema
</button>
```

**CSS Example**:
```css
[data-tooltip] {
  position: relative;
}

[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.5em;
  background: var(--vscode-toolbar-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  white-space: nowrap;
  z-index: 1000;
}
```

## Contextual Help

### Command Palette Descriptions

**Format**: Use `description` in command contributions

**Example** (`package.json`):
```json
{
  "contributes": {
    "commands": [
      {
        "command": "devsync.scan",
        "title": "Scan Schema",
        "category": "DevSync",
        "description": "Scans Prisma schema and detects mismatches with database"
      }
    ]
  }
}
```

### Settings Descriptions

**Example** (`package.json`):
```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "devsync.apiUrl": {
          "type": "string",
          "default": "https://api.devsync.ai",
          "description": "DevSync API URL",
          "markdownDescription": "Base URL for the DevSync API. Change this if you're using a self-hosted instance."
        },
        "devsync.enableDiagnostics": {
          "type": "boolean",
          "default": true,
          "description": "Enable inline diagnostics",
          "markdownDescription": "Show inline diagnostics (squiggly lines) in Prisma schema files when mismatches are detected."
        }
      }
    }
  }
}
```

### Inline Help Panels

**Example**:
```typescript
/**
 * Shows contextual help panel for a given topic.
 * 
 * @param topic - Help topic identifier
 * @param context - Additional context (e.g., current mismatch)
 */
function showHelpPanel(topic: string, context?: any): void {
  const panel = vscode.window.createWebviewPanel(
    'devsyncHelp',
    'DevSync Help',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );
  
  panel.webview.html = generateHelpContent(topic, context);
}

function generateHelpContent(topic: string, context?: any): string {
  const helpContent: Record<string, string> = {
    'missing-field': `
      <h2>Missing Field</h2>
      <p>A field exists in your Prisma schema but not in the database.</p>
      <h3>How to Fix</h3>
      <ol>
        <li>Click "Apply Fix" to add the field to your schema</li>
        <li>Or generate a migration to add it to the database</li>
      </ol>
      <h3>Learn More</h3>
      <p>See our <a href="https://docs.devsync.ai/guides/missing-fields">guide on missing fields</a>.</p>
    `,
    // More help content...
  };
  
  return helpContent[topic] || '<p>Help topic not found.</p>';
}
```

## Usage Examples

### Function Examples

**Example**:
```typescript
/**
 * Validates Prisma schema syntax.
 * 
 * @param schema - Prisma schema content
 * @returns Validation result with errors if any
 * 
 * @example
 * ```typescript
 * // Basic validation
 * const result = validateSchema(schemaContent);
 * if (!result.valid) {
 *   console.error('Schema errors:', result.errors);
 * }
 * 
 * // With custom options
 * const result = validateSchema(schemaContent, {
 *   strict: true,
 *   allowComments: false
 * });
 * ```
 */
function validateSchema(schema: string, options?: ValidationOptions): ValidationResult {
  // Implementation
}
```

### Class Examples

**Example**:
```typescript
/**
 * Manages scan operations and results.
 * 
 * @example
 * ```typescript
 * // Create service instance
 * const scanService = new ScanService(apiClient, cliRunner);
 * 
 * // Perform scan
 * const result = await scanService.scanSchema({
 *   schema: schemaContent,
 *   databaseUrl: 'postgresql://...'
 * });
 * 
 * // Handle results
 * if (result.mismatches.length > 0) {
 *   console.log(`Found ${result.mismatches.length} mismatches`);
 *   result.mismatches.forEach(mismatch => {
 *     console.log(`- ${mismatch.message}`);
 *   });
 * }
 * ```
 */
export class ScanService {
  // Implementation
}
```

### Complex Examples

**Example**:
```typescript
/**
 * Generates migration from scan results.
 * 
 * @example
 * ```typescript
 * // Generate migration for all mismatches
 * const migration = await migrationService.generateMigration({
 *   scanId: scanResult.scanId,
 *   mismatches: scanResult.mismatches.map(m => m.id)
 * });
 * 
 * // Preview migration before applying
 * const preview = await migrationService.generateMigration({
 *   scanId: scanResult.scanId,
 *   mismatches: ['mismatch-1', 'mismatch-2'],
 *   options: {
 *     preview: true,
 *     dryRun: true
 *   }
 * });
 * console.log('Migration preview:', preview.sql);
 * 
 * // Apply migration
 * await migrationService.applyMigration(migration.migrationId);
 * ```
 */
async generateMigration(request: MigrationRequest): Promise<MigrationResponse> {
  // Implementation
}
```

## Documentation Checklist

### For Public APIs

- [ ] JSDoc comment present
- [ ] Description is clear and concise
- [ ] All parameters documented with `@param`
- [ ] Return value documented with `@returns`
- [ ] Exceptions documented with `@throws`
- [ ] Usage example provided with `@example`
- [ ] Example code is valid and tested

### For Types

- [ ] Type has description
- [ ] All properties documented
- [ ] Usage example provided
- [ ] Related types linked

### For Code

- [ ] Complex logic has comments
- [ ] Comments explain why, not what
- [ ] TODOs/FIXMEs have issue references
- [ ] Comments are up-to-date

### For UI Elements

- [ ] Commands have tooltips
- [ ] Settings have descriptions
- [ ] Tree items have tooltips
- [ ] Help panels available
- [ ] Contextual help provided

---

**Related Documentation**:
- [Code Style Guide](CODE_STYLE.md)
- [API Reference](API_REFERENCE.md)
- [Component Guide](COMPONENTS.md)

