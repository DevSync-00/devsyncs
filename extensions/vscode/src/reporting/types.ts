/**
 * Reporting & Analytics types and interfaces.
 * 
 * Comprehensive type definitions for reporting and analytics features.
 */

/**
 * Report type.
 */
export type ReportType = 
  | 'scan_summary'
  | 'migration_summary'
  | 'team_activity'
  | 'project_health'
  | 'mismatch_analysis'
  | 'trend_analysis'
  | 'custom';

/**
 * Report format.
 */
export type ReportFormat = 'json' | 'csv' | 'pdf' | 'html' | 'xlsx';

/**
 * Time period for reports.
 */
export type TimePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

/**
 * Report configuration.
 */
export interface ReportConfig {
  /**
   * Report ID.
   */
  id: string;
  
  /**
   * Report name.
   */
  name: string;
  
  /**
   * Report type.
   */
  type: ReportType;
  
  /**
   * Report format.
   */
  format: ReportFormat;
  
  /**
   * Time period.
   */
  period: TimePeriod;
  
  /**
   * Start date (for custom period).
   */
  startDate?: string;
  
  /**
   * End date (for custom period).
   */
  endDate?: string;
  
  /**
   * Project IDs to include.
   */
  projectIds?: string[];
  
  /**
   * Team ID (if team report).
   */
  teamId?: string;
  
  /**
   * Include metrics.
   */
  includeMetrics: boolean;
  
  /**
   * Include trends.
   */
  includeTrends: boolean;
  
  /**
   * Include charts.
   */
  includeCharts: boolean;
  
  /**
   * Custom filters.
   */
  filters?: Record<string, any>;
  
  /**
   * Created timestamp.
   */
  createdAt: string;
  
  /**
   * Updated timestamp.
   */
  updatedAt: string;
}

/**
 * Report data.
 */
export interface ReportData {
  /**
   * Report ID.
   */
  reportId: string;
  
  /**
   * Report configuration.
   */
  config: ReportConfig;
  
  /**
   * Generated timestamp.
   */
  generatedAt: string;
  
  /**
   * Summary metrics.
   */
  summary: ReportSummary;
  
  /**
   * Detailed data.
   */
  data: any;
  
  /**
   * Charts data.
   */
  charts?: ChartData[];
  
  /**
   * Trends data.
   */
  trends?: TrendData[];
}

/**
 * Report summary.
 */
export interface ReportSummary {
  /**
   * Total scans.
   */
  totalScans: number;
  
  /**
   * Total migrations.
   */
  totalMigrations: number;
  
  /**
   * Total mismatches.
   */
  totalMismatches: number;
  
  /**
   * Resolved mismatches.
   */
  resolvedMismatches: number;
  
  /**
   * Active projects.
   */
  activeProjects: number;
  
  /**
   * Team members (if team report).
   */
  teamMembers?: number;
  
  /**
   * Period start.
   */
  periodStart: string;
  
  /**
   * Period end.
   */
  periodEnd: string;
}

/**
 * Chart data.
 */
export interface ChartData {
  /**
   * Chart ID.
   */
  id: string;
  
  /**
   * Chart type.
   */
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  
  /**
   * Chart title.
   */
  title: string;
  
  /**
   * Chart labels.
   */
  labels: string[];
  
  /**
   * Chart datasets.
   */
  datasets: ChartDataset[];
  
  /**
   * Chart options.
   */
  options?: Record<string, any>;
}

/**
 * Chart dataset.
 */
export interface ChartDataset {
  /**
   * Dataset label.
   */
  label: string;
  
  /**
   * Dataset data.
   */
  data: number[];
  
  /**
   * Dataset color.
   */
  backgroundColor?: string;
  
  /**
   * Border color.
   */
  borderColor?: string;
}

/**
 * Trend data.
 */
export interface TrendData {
  /**
   * Metric name.
   */
  metric: string;
  
  /**
   * Current value.
   */
  current: number;
  
  /**
   * Previous value.
   */
  previous: number;
  
  /**
   * Change percentage.
   */
  changePercent: number;
  
  /**
   * Trend direction.
   */
  trend: 'up' | 'down' | 'stable';
  
  /**
   * Data points over time.
   */
  dataPoints: Array<{
    date: string;
    value: number;
  }>;
}

/**
 * Scheduled report.
 */
export interface ScheduledReport {
  /**
   * Schedule ID.
   */
  id: string;
  
  /**
   * Report configuration.
   */
  config: ReportConfig;
  
  /**
   * Schedule frequency.
   */
  frequency: 'daily' | 'weekly' | 'monthly';
  
  /**
   * Schedule time (HH:mm format).
   */
  scheduleTime: string;
  
  /**
   * Schedule day (for weekly/monthly).
   */
  scheduleDay?: number;
  
  /**
   * Recipients (email addresses).
   */
  recipients: string[];
  
  /**
   * Is enabled.
   */
  enabled: boolean;
  
  /**
   * Last run timestamp.
   */
  lastRunAt?: string;
  
  /**
   * Next run timestamp.
   */
  nextRunAt?: string;
  
  /**
   * Created timestamp.
   */
  createdAt: string;
  
  /**
   * Updated timestamp.
   */
  updatedAt: string;
}

/**
 * Report template.
 */
export interface ReportTemplate {
  /**
   * Template ID.
   */
  id: string;
  
  /**
   * Template name.
   */
  name: string;
  
  /**
   * Template description.
   */
  description?: string;
  
  /**
   * Template type.
   */
  type: ReportType;
  
  /**
   * Default configuration.
   */
  defaultConfig: Partial<ReportConfig>;
  
  /**
   * Template preview.
   */
  preview?: string;
  
  /**
   * Is built-in.
   */
  builtIn: boolean;
  
  /**
   * Created timestamp.
   */
  createdAt: string;
}

/**
 * Analytics metrics.
 */
export interface AnalyticsMetrics {
  /**
   * Period start.
   */
  periodStart: string;
  
  /**
   * Period end.
   */
  periodEnd: string;
  
  /**
   * Scans metrics.
   */
  scans: {
    total: number;
    byStatus: Record<string, number>;
    byProject: Record<string, number>;
    averageDuration: number;
    successRate: number;
  };
  
  /**
   * Migrations metrics.
   */
  migrations: {
    total: number;
    byStatus: Record<string, number>;
    byProject: Record<string, number>;
    averageDuration: number;
    successRate: number;
    rollbackRate: number;
  };
  
  /**
   * Mismatches metrics.
   */
  mismatches: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byProject: Record<string, number>;
    resolutionRate: number;
    averageResolutionTime: number;
  };
  
  /**
   * Projects metrics.
   */
  projects: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
  };
  
  /**
   * Team metrics (if team report).
   */
  team?: {
    members: number;
    activeMembers: number;
    activityByMember: Record<string, number>;
  };
}

/**
 * Export options.
 */
export interface ExportOptions {
  /**
   * Export format.
   */
  format: ReportFormat;
  
  /**
   * Include charts.
   */
  includeCharts: boolean;
  
  /**
   * Include raw data.
   */
  includeRawData: boolean;
  
  /**
   * File name.
   */
  fileName?: string;
  
  /**
   * Compression.
   */
  compress?: boolean;
}

/**
 * CI/CD integration config.
 */
export interface CICDIntegration {
  /**
   * Integration ID.
   */
  id: string;
  
  /**
   * Integration type.
   */
  type: 'github_actions' | 'gitlab_ci' | 'jenkins' | 'circleci' | 'custom';
  
  /**
   * Webhook URL.
   */
  webhookUrl: string;
  
  /**
   * Secret token.
   */
  secretToken?: string;
  
  /**
   * Events to trigger on.
   */
  events: Array<'scan_complete' | 'migration_applied' | 'mismatch_detected'>;
  
  /**
   * Is enabled.
   */
  enabled: boolean;
  
  /**
   * Created timestamp.
   */
  createdAt: string;
}

