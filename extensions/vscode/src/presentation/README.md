# Data Presentation Module

This module provides comprehensive data presentation features for scan results and mismatches, addressing section 3.1 from the IMPROVEMENTS.md roadmap.

## Features

### 1. Grouping

Group mismatches by various criteria:

- **By Severity**: Group by error, warning, info
- **By Type**: Group by mismatch type (missing_field, extra_field, etc.)
- **By Model**: Group by Prisma model name
- **By Field**: Group by field name

```typescript
import { MismatchGrouper } from './presentation';

const groups = MismatchGrouper.groupBySeverity(mismatches);
// Returns: [{ key: 'error', label: 'Errors', mismatches: [...], count: 5 }, ...]
```

### 2. Filtering

Filter mismatches by various criteria:

- **By Model**: Filter to specific model
- **By Field**: Filter to specific field
- **By Type**: Filter to specific mismatch type
- **By Severity**: Filter by error, warning, or info
- **Text Search**: Search across model, field, type, and message

```typescript
import { MismatchFilter } from './presentation';

const filtered = MismatchFilter.filter(mismatches, {
  model: 'User',
  severity: 'error',
  searchText: 'email',
});
```

### 3. Sorting

Sort mismatches by various fields:

- **By Model**: Alphabetical sorting
- **By Field**: Alphabetical sorting
- **By Type**: Alphabetical sorting
- **By Severity**: Priority sorting (error > warning > info)
- **By Message**: Alphabetical sorting
- **By Count**: Sort by frequency

```typescript
import { MismatchSorter } from './presentation';

const sorted = MismatchSorter.sort(mismatches, {
  field: 'severity',
  direction: 'desc',
});
```

### 4. Customizable Views

Create and manage custom views with specific filters, sorting, and grouping:

```typescript
import { ViewManager } from './presentation';

const viewManager = new ViewManager();

// Create a custom view
viewManager.createView('my-view', {
  name: 'Critical Errors Only',
  description: 'Show only error severity mismatches',
  filters: { severity: 'error' },
  sort: { field: 'severity', direction: 'desc' },
  groupBy: 'type',
});

// Apply view
const filtered = viewManager.applyView(mismatches, 'my-view');
```

### 5. Export Reports

Export scan reports in multiple formats:

- **JSON**: Structured data format
- **CSV**: Spreadsheet-compatible format
- **Markdown**: Documentation format
- **Text**: Plain text format

```typescript
import { ReportExporter } from './presentation';

await ReportExporter.export(report, {
  format: 'json',
  includeSummary: true,
  includeDetails: true,
});
```

### 6. Summary Dashboard

Generate comprehensive statistics and summaries:

```typescript
import { DashboardManager } from './presentation';

const stats = DashboardManager.generateStats(report);
// Returns: { totalMismatches, bySeverity, byType, byModel, topTypes, topModels }

const summary = DashboardManager.formatSummary(stats);
const healthScore = DashboardManager.getHealthScore(stats); // 0-100
```

### 7. Trend Analysis

Analyze trends in scan results over time:

```typescript
import { TrendAnalyzer } from './presentation';

// Load historical reports
const reports = TrendAnalyzer.loadHistoricalReports(workspacePath, 10);

// Analyze trends
const analysis = TrendAnalyzer.analyze(reports);
// Returns: { dataPoints, direction, changePercentage, averageMismatches, peakMismatches, recentTrend }

const summary = TrendAnalyzer.formatTrendSummary(analysis);
```

## Usage Examples

### Complete Workflow

```typescript
import {
  MismatchGrouper,
  MismatchFilter,
  MismatchSorter,
  ViewManager,
  ReportExporter,
  DashboardManager,
  TrendAnalyzer,
} from './presentation';

// 1. Group mismatches by severity
const groups = MismatchGrouper.groupBySeverity(report.mismatches);

// 2. Filter to show only errors
const errors = MismatchFilter.filter(report.mismatches, { severity: 'error' });

// 3. Sort by model
const sorted = MismatchSorter.sort(errors, { field: 'model', direction: 'asc' });

// 4. Create a view
const viewManager = new ViewManager();
viewManager.createView('errors-by-model', {
  name: 'Errors by Model',
  filters: { severity: 'error' },
  sort: { field: 'model', direction: 'asc' },
  groupBy: 'model',
});

// 5. Export report
await ReportExporter.export(report, {
  format: 'markdown',
  includeSummary: true,
  includeDetails: true,
});

// 6. Generate dashboard
const stats = DashboardManager.generateStats(report);
const healthScore = DashboardManager.getHealthScore(stats);

// 7. Analyze trends
const historicalReports = TrendAnalyzer.loadHistoricalReports(workspacePath);
const trendAnalysis = TrendAnalyzer.analyze(historicalReports);
```

## Integration

The data presentation module integrates with:

- **Sidebar Provider**: Use grouping, filtering, and sorting in the sidebar view
- **Commands**: Export reports via commands
- **Dashboard**: Display summary statistics
- **State Store**: Store view configurations

## Future Enhancements

- Visual charts and graphs for dashboard
- PDF export with charts
- Custom view templates
- View sharing between users
- Real-time trend updates
- Predictive trend analysis

