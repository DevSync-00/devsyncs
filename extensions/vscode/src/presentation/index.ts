/**
 * Data presentation module.
 * 
 * Provides comprehensive data presentation features including:
 * - Grouping mismatches by various criteria
 * - Filtering by model, field, type, severity
 * - Sorting by various criteria
 * - Customizable views
 * - Export in multiple formats (JSON, CSV, Markdown, Text)
 * - Summary dashboard
 * - Trend analysis over time
 */

export { MismatchGrouper, MismatchGroup, GroupKey } from './grouping';
export { MismatchFilter, FilterCriteria } from './filtering';
export { MismatchSorter, SortConfig, SortField, SortDirection } from './sorting';
export { ViewManager, ViewConfig } from './views';
export { ReportExporter, ExportFormat, ExportOptions } from './export';
export { DashboardManager, DashboardStats } from './dashboard';
export { TrendAnalyzer, TrendAnalysis, TrendDataPoint } from './trends';

