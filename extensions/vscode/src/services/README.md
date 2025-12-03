# Service Layer

This directory contains the service layer implementation, addressing improvement 3.1 from the IMPROVEMENTS.md roadmap.

## Overview

The service layer separates business logic from UI code and data access, following the **Service Layer Pattern** and **Repository Pattern**. This creates clear boundaries between layers and improves testability and maintainability.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer                              │
│  (commands.ts, sidebarCommands.ts, codeActions.ts)      │
│  - User interactions                                    │
│  - Status bar updates                                    │
│  - Notifications                                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 Service Layer                            │
│  (scanService.ts, migrationService.ts, reportService.ts)│
│  - Business logic                                       │
│  - Validation                                           │
│  - Orchestration                                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Repository Layer                            │
│  (scanRepository.ts, migrationRepository.ts)            │
│  - Data access                                          │
│  - Persistence                                          │
│  - Caching                                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Data Access Layer                           │
│  (api.ts, apiClient.ts)                                  │
│  - API communication                                    │
│  - HTTP requests                                        │
└─────────────────────────────────────────────────────────┘
```

## Services

### Scan Service (`scanService.ts`)

**Purpose:** Handles business logic for scan operations.

**Responsibilities:**
- Validates scan configuration
- Executes scan operations
- Processes scan results
- Retrieves scan reports

**No UI Dependencies:**
- Does not show messages
- Does not update status bar
- Does not open documents
- Returns results for UI layer to handle

**Example:**
```typescript
const scanService = container.getScanService();

// Validate before scanning
const validation = scanService.validateScan(workspacePath);
if (!validation.valid) {
  // UI layer handles showing error
  await notifications.showError(`Missing: ${validation.missingFields?.join(', ')}`);
  return;
}

// Execute scan (business logic only)
const result = await scanService.executeScan(workspacePath, dbConnection);
if (result.success) {
  // UI layer handles showing success
  await notifications.showInfo(`Found ${result.report.mismatches.length} mismatches`);
}
```

### Migration Service (`migrationService.ts`)

**Purpose:** Handles business logic for migration generation.

**Responsibilities:**
- Validates migration prerequisites
- Generates migrations from scan reports
- Retrieves migration history

**No UI Dependencies:**
- Does not show messages
- Does not open documents
- Returns results for UI layer to handle

**Example:**
```typescript
const migrationService = container.getMigrationService();

// Validate before generating
const validation = await migrationService.validateMigration(scanReportId);
if (!validation.valid) {
  await notifications.showWarning(validation.error);
  return;
}

// Generate migration (business logic only)
const result = await migrationService.generateMigration(scanReportId);
if (result.success) {
  // UI layer handles opening document
  await editor.openDocument('Migration', result.migration.content, 'sql');
}
```

### Report Service (`reportService.ts`)

**Purpose:** Handles business logic for report processing.

**Responsibilities:**
- Retrieves scan reports
- Generates summaries and statistics
- Filters and processes mismatches

**No UI Dependencies:**
- Pure data processing
- No user interactions

**Example:**
```typescript
const reportService = container.getReportService();

const report = await reportService.getLatestReport();
if (report) {
  const summary = reportService.getSummary(report);
  console.log(`Total: ${summary.totalMismatches}`);
  console.log(`Errors: ${summary.errors}`);
  
  // Filter by severity
  const errors = reportService.filterMismatches(report.mismatches, {
    severity: 'error'
  });
}
```

## Repositories

### Scan Repository (`repositories/scanRepository.ts`)

**Purpose:** Abstracts data access for scan reports.

**Responsibilities:**
- Save scan reports to local storage
- Retrieve scan reports from local storage or API
- Delete scan reports

**Benefits:**
- Can switch between local storage and API without changing business logic
- Easy to add caching strategies
- Testable with mock repositories

**Example:**
```typescript
const scanRepository = container.getScanRepository();

// Save locally
await scanRepository.save(scanReport);

// Retrieve (checks local first, then API)
const report = await scanRepository.findLatest();

// Find by ID
const specificReport = await scanRepository.findById('scan-123');
```

### Migration Repository (`repositories/migrationRepository.ts`)

**Purpose:** Abstracts data access for migrations.

**Responsibilities:**
- Save migrations to file system
- Retrieve migrations from file system or API
- Query migrations by scan report

**Example:**
```typescript
const migrationRepository = container.getMigrationRepository();

// Save migration file
await migrationRepository.save(migration);

// Find migrations for a scan report
const migrations = await migrationRepository.findByScanReport('scan-123');
```

## UI Layer

The UI layer (`src/ui/`) provides clean abstractions for all VS Code UI operations:

### Notification Service (`ui/notifications.ts`)
- `showInfo()` - Information messages
- `showWarning()` - Warning messages
- `showError()` - Error messages
- `showInput()` - Input boxes
- `showQuickPick()` - Quick pick menus
- `openExternal()` - Open URLs

### Status Bar Service (`ui/statusBar.ts`)
- `showProgress()` - Show progress indicator
- `updateProgress()` - Update progress message
- `hideProgress()` - Hide progress indicator
- `showTemporary()` - Show temporary message

### Editor Service (`ui/editor.ts`)
- `openDocument()` - Open document with content
- `openFile()` - Open file from path
- `applyEdits()` - Apply text edits

## Benefits

### 1. Separation of Concerns

**Before:**
```typescript
// Business logic mixed with UI
async scan() {
  vscode.window.showInformationMessage('Starting scan...');
  const report = await apiClient.scan(path);
  vscode.window.showInformationMessage('Scan complete!');
}
```

**After:**
```typescript
// Business logic (service)
const result = await scanService.executeScan(path);

// UI logic (command)
if (result.success) {
  await notifications.showInfo('Scan complete!');
}
```

### 2. Testability

Services can be tested without VS Code:
```typescript
// Test business logic without UI
const mockApiClient = createMockApiClient();
const scanService = new ScanService(mockApiClient, mockConfig);
const result = await scanService.executeScan('/test/path');
expect(result.success).toBe(true);
```

### 3. Reusability

Services can be used by multiple UI components:
- Commands use services
- Sidebar commands use services
- Code actions can use services
- Chat panel can use services

### 4. Maintainability

Changes to business logic don't affect UI:
- Update validation logic → only service changes
- Change API structure → only repository changes
- Update UI messages → only command layer changes

## Usage in Commands

Commands now follow this pattern:

```typescript
async scan() {
  // 1. UI: Show progress
  const statusBar = this.statusBar.showProgress('Scanning...');
  
  try {
    // 2. Business Logic: Validate
    const validation = this.scanService.validateScan(path);
    if (!validation.valid) {
      // UI: Show error
      await this.notifications.showError('Invalid configuration');
      return;
    }
    
    // 3. Business Logic: Execute
    const result = await this.scanService.executeScan(path);
    
    // 4. Business Logic: Update state
    this.stateStore.dispatch(scanActions.complete(result.report));
    
    // 5. UI: Show success
    this.statusBar.hideProgress(statusBar);
    await this.notifications.showInfo('Scan complete!');
  } catch (error) {
    // UI: Handle error
    this.statusBar.hideProgress(statusBar);
    await this.notifications.showError(error.message);
  }
}
```

## Integration with DI Container

All services are registered in the DI container:

```typescript
// Services
container.getScanService()
container.getMigrationService()
container.getReportService()

// Repositories
container.getScanRepository()
container.getMigrationRepository()
```

## Migration from Direct API Calls

### Before (Mixed Concerns)
```typescript
// commands.ts
async scan() {
  // Validation (business logic)
  if (!config.apiUrl) {
    vscode.window.showErrorMessage('Missing API URL'); // UI
    return;
  }
  
  // Execution (business logic)
  const report = await apiClient.scan(path); // Data access
  
  // Feedback (UI)
  vscode.window.showInformationMessage('Complete!'); // UI
}
```

### After (Separated Concerns)
```typescript
// scanService.ts (Business Logic)
async executeScan(path: string): Promise<ScanResult> {
  const validation = this.validateScan(path);
  if (!validation.valid) {
    return { success: false, error: 'Invalid config' };
  }
  const report = await this.apiClient.scan(path);
  return { success: true, report };
}

// commands.ts (UI Layer)
async scan() {
  const result = await this.scanService.executeScan(path);
  if (result.success) {
    await this.notifications.showInfo('Complete!');
  } else {
    await this.notifications.showError(result.error);
  }
}
```

## Files Structure

```
src/services/
├── interfaces.ts              # Service and repository interfaces
├── scanService.ts             # Scan business logic
├── migrationService.ts        # Migration business logic
├── reportService.ts           # Report processing logic
├── repositories/
│   ├── scanRepository.ts      # Scan data access
│   └── migrationRepository.ts # Migration data access
└── index.ts                   # Exports

src/ui/
├── notifications.ts           # Notification UI
├── statusBar.ts               # Status bar UI
├── editor.ts                  # Editor UI
└── index.ts                   # Exports
```

## Testing

Services can be unit tested without VS Code:

```typescript
describe('ScanService', () => {
  it('should validate scan configuration', () => {
    const mockConfig = createMockConfig({ apiUrl: '', apiKey: 'key' });
    const service = new ScanService(mockApiClient, mockConfig);
    const validation = service.validateScan('/path');
    expect(validation.valid).toBe(false);
    expect(validation.missingFields).toContain('devsync.apiUrl');
  });
  
  it('should execute scan successfully', async () => {
    const mockApiClient = createMockApiClient();
    const service = new ScanService(mockApiClient, mockConfig);
    const result = await service.executeScan('/path');
    expect(result.success).toBe(true);
    expect(result.report).toBeDefined();
  });
});
```

## Future Enhancements

Potential additions:
- Caching service for scan reports
- Background job service for long-running operations
- Validation service for configuration
- Transformation service for data formatting
- Analytics service for usage tracking

