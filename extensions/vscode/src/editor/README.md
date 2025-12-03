# Editor Integration Enhancements

This directory contains enhanced editor integration components that provide improved diagnostics, code actions, and schema visualization.

## Features

### 1. Inline Preview of Suggested Fixes
- **InlinePreviewManager** - Shows preview of fixes directly in the editor
- **Visual indicators** - Displays fix suggestions next to problematic code
- **Non-intrusive** - Doesn't modify code, only shows preview

### 2. Diff View Before Applying Changes
- **DiffViewManager** - Shows side-by-side diff before applying fixes
- **Range diff** - Compare specific code ranges
- **Full document diff** - Compare entire document with proposed changes
- **VS Code native diff** - Uses VS Code's built-in diff viewer

### 3. Batch Apply Fixes
- **BatchApplyManager** - Apply multiple fixes at once
- **Preview before apply** - Shows all changes before applying
- **Selective application** - Choose which fixes to apply
- **Smart parsing** - Converts SQL fixes to Prisma schema changes

### 4. Preview Migration Impact
- **MigrationPreviewManager** - Analyzes migration impact before applying
- **Affected models/fields** - Shows what will be changed
- **Risk assessment** - Identifies potential data loss risks
- **Execution time estimate** - Estimates how long migration will take

### 5. Side-by-Side Comparison (Code vs Database)
- **SchemaComparisonManager** - Compares Prisma schema with database schema
- **Model comparison** - Compare individual models/tables
- **Field-level comparison** - Compare fields and columns
- **Type matching** - Identifies type mismatches

### 6. Annotate Schema with Database State
- **SchemaAnnotationManager** - Shows database state inline in schema
- **Visual indicators** - Color-coded annotations for mismatches
- **Hover information** - Detailed mismatch info on hover
- **Severity-based styling** - Different colors for errors, warnings, info

### 7. Show Migration History Inline
- **MigrationHistoryManager** - Shows migration history for models/fields
- **Inline annotations** - Shows migration count next to models
- **Detailed history** - Full migration history view
- **Filter by model/field** - Filter migrations by specific model or field

## Components

### InlinePreviewManager
Manages inline preview decorations in the editor.

**Key Methods:**
- `showInlinePreview(editor, range, mismatch, suggestedFix)` - Show preview
- `hideInlinePreview(editor, range)` - Hide preview
- `clearAllPreviews(editor)` - Clear all previews

### DiffViewManager
Manages diff view for previewing changes.

**Key Methods:**
- `showDiffView(document, proposedChanges, title)` - Show full diff
- `showRangeDiff(document, range, newText)` - Show range diff

### BatchApplyManager
Manages batch application of fixes.

**Key Methods:**
- `applyBatchFixes(document, mismatches, preview)` - Apply multiple fixes
- `createEditForFix(document, range, mismatch, fix)` - Create edit for fix

### MigrationPreviewManager
Manages migration impact preview.

**Key Methods:**
- `previewMigrationImpact(migration, scanReport)` - Show impact preview
- `analyzeMigrationImpact(migration, scanReport)` - Analyze impact

### SchemaComparisonManager
Manages schema comparison views.

**Key Methods:**
- `showComparison(scanReport)` - Show full comparison
- `showModelComparison(modelName, codeModel, dbTable)` - Show model comparison

### SchemaAnnotationManager
Manages schema annotations.

**Key Methods:**
- `annotateSchema(editor, scanReport)` - Annotate schema
- `registerHoverProvider(context)` - Register hover provider
- `clearAnnotations(editor)` - Clear annotations

### MigrationHistoryManager
Manages migration history display.

**Key Methods:**
- `showMigrationHistory(modelName?, fieldName?)` - Show history
- `annotateWithMigrationHistory(editor, modelName, fieldName?)` - Annotate with history

### EnhancedCodeActions
Enhanced code actions provider with preview and batch apply.

**Key Methods:**
- `provideCodeActions(document, range, context, token)` - Provide code actions
- `getPreviewManager()` - Get preview manager
- `getBatchApplyManager()` - Get batch apply manager
- `getDiffViewManager()` - Get diff view manager

## Usage

### Basic Usage

```typescript
import { EnhancedCodeActions } from './editor';

const enhancedCodeActions = new EnhancedCodeActions(apiClient, diagnostics);

// Code actions are automatically provided when diagnostics are present
```

### Inline Preview

```typescript
import { InlinePreviewManager } from './editor';

const previewManager = new InlinePreviewManager();
previewManager.showInlinePreview(editor, range, mismatch, suggestedFix);
```

### Diff View

```typescript
import { DiffViewManager } from './editor';

const diffManager = new DiffViewManager(editorService);
await diffManager.showRangeDiff(document, range, newText);
```

### Batch Apply

```typescript
import { BatchApplyManager } from './editor';

const batchManager = new BatchApplyManager(editorService);
await batchManager.applyBatchFixes(document, mismatches, true);
```

### Migration Preview

```typescript
import { MigrationPreviewManager } from './editor';

const previewManager = new MigrationPreviewManager(editorService);
await previewManager.previewMigrationImpact(migration, scanReport);
```

### Schema Comparison

```typescript
import { SchemaComparisonManager } from './editor';

const comparisonManager = new SchemaComparisonManager(editorService);
await comparisonManager.showComparison(scanReport);
```

### Schema Annotations

```typescript
import { SchemaAnnotationManager } from './editor';

const annotationManager = new SchemaAnnotationManager();
annotationManager.annotateSchema(editor, scanReport);
annotationManager.registerHoverProvider(context);
```

### Migration History

```typescript
import { MigrationHistoryManager } from './editor';

const historyManager = new MigrationHistoryManager(editorService);
await historyManager.showMigrationHistory('User', 'email');
```

## Commands

The following commands are registered:

- `devsync.previewFix` - Preview a fix inline
- `devsync.showDiff` - Show diff view for a fix
- `devsync.batchApplyFixes` - Apply all fixes at once
- `devsync.previewMigrationImpact` - Preview migration impact
- `devsync.showSchemaComparison` - Show schema comparison
- `devsync.showMigrationHistory` - Show migration history

## Integration

All editor enhancements are integrated with:
- **Diagnostics** - Automatically triggered by diagnostics
- **Code Actions** - Available via lightbulb menu
- **Hover Provider** - Shows detailed mismatch info
- **Editor Events** - Updates when editor changes

## Future Enhancements

Potential future improvements:
- Real-time schema sync visualization
- Interactive fix application with undo
- Advanced diff visualization with syntax highlighting
- Migration rollback preview
- Schema evolution timeline
- Conflict resolution UI

