/**
 * Migration Metrics Tracker
 * 
 * Tracks migration performance, frequency, duration, and correlates with schema complexity.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface MigrationMetric {
  id: string;
  migration_id: string;
  project_id: string;
  execution_type: 'apply' | 'rollback' | 'dry_run';
  execution_status: 'success' | 'failed' | 'running';
  duration_ms: number | null;
  affected_tables: number;
  affected_rows: number;
  complexity_score: number;
  validation_errors: number;
  validation_warnings: number;
  breaking_changes: number;
  executed_by: string | null;
  executed_at: string;
  error_message: string | null;
}

export interface MigrationStats {
  total: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageDuration: number;
  averageComplexity: number;
  totalAffectedRows: number;
  repeatFailures: number;
  flakyMigrations: string[];
}

export interface MigrationCorrelation {
  complexityVsDuration: { complexity: number; duration: number }[];
  driftVsFailures: { driftLevel: number; failureRate: number }[];
  breakingChangesVsFailures: { breakingChanges: number; failureRate: number }[];
}

/**
 * Calculate SQL complexity score
 */
export function calculateComplexityScore(sql: string): number {
  let score = 0;

  // Count statements
  const statements = sql.split(';').filter(s => s.trim().length > 0 && !s.trim().startsWith('--'));
  score += statements.length * 2;

  // Count tables affected
  const tableMatches = sql.match(/(?:FROM|INTO|UPDATE|ALTER TABLE|CREATE TABLE|DROP TABLE)\s+["']?(\w+)["']?/gi);
  const uniqueTables = new Set(tableMatches?.map(m => m.toLowerCase()) || []);
  score += uniqueTables.size * 3;

  // Count JOINs (complexity indicator)
  const joins = (sql.match(/\bJOIN\b/gi) || []).length;
  score += joins * 5;

  // Count subqueries
  const subqueries = (sql.match(/\(SELECT/gi) || []).length;
  score += subqueries * 4;

  // Count transactions
  const transactions = (sql.match(/\bBEGIN\b|\bCOMMIT\b|\bROLLBACK\b/gi) || []).length;
  score += transactions * 2;

  // DDL operations are more complex
  const ddlOps = (sql.match(/\bCREATE\b|\bALTER\b|\bDROP\b/gi) || []).length;
  score += ddlOps * 3;

  // Breaking changes add complexity
  const breakingOps = (sql.match(/\bDROP\s+(?:TABLE|COLUMN)\b/gi) || []).length;
  score += breakingOps * 10;

  return Math.min(100, score); // Cap at 100
}

/**
 * Store migration metric
 */
export async function storeMigrationMetric(
  supabase: SupabaseClient,
  metric: {
    migration_id: string;
    project_id: string;
    execution_type: 'apply' | 'rollback' | 'dry_run';
    execution_status: 'success' | 'failed' | 'running';
    duration_ms?: number;
    affected_tables?: number;
    affected_rows?: number;
    complexity_score?: number;
    validation_errors?: number;
    validation_warnings?: number;
    breaking_changes?: number;
    executed_by?: string;
    error_message?: string;
    metadata?: any;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('migration_metrics')
    .insert({
      migration_id: metric.migration_id,
      project_id: metric.project_id,
      execution_type: metric.execution_type,
      execution_status: metric.execution_status,
      duration_ms: metric.duration_ms || null,
      affected_tables: metric.affected_tables || 0,
      affected_rows: metric.affected_rows || 0,
      complexity_score: metric.complexity_score || 0,
      validation_errors: metric.validation_errors || 0,
      validation_warnings: metric.validation_warnings || 0,
      breaking_changes: metric.breaking_changes || 0,
      executed_by: metric.executed_by || null,
      error_message: metric.error_message || null,
      metadata: metric.metadata || {},
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error storing migration metric:', error);
    return null;
  }

  return data.id;
}

/**
 * Get migration statistics for a project
 */
export async function getMigrationStats(
  supabase: SupabaseClient,
  projectId: string,
  startDate?: Date,
  endDate?: Date
): Promise<MigrationStats> {
  let query = supabase
    .from('migration_metrics')
    .select('*')
    .eq('project_id', projectId);

  if (startDate) {
    query = query.gte('executed_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('executed_at', endDate.toISOString());
  }

  const { data: metrics, error } = await query;

  if (error || !metrics || metrics.length === 0) {
    return {
      total: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      averageDuration: 0,
      averageComplexity: 0,
      totalAffectedRows: 0,
      repeatFailures: 0,
      flakyMigrations: [],
    };
  }

  const successCount = metrics.filter(m => m.execution_status === 'success').length;
  const failureCount = metrics.filter(m => m.execution_status === 'failed').length;
  const successRate = metrics.length > 0 ? (successCount / metrics.length) * 100 : 0;

  const durations = metrics.filter(m => m.duration_ms).map(m => m.duration_ms!);
  const averageDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  const complexities = metrics.map(m => m.complexity_score || 0);
  const averageComplexity = complexities.length > 0
    ? complexities.reduce((a, b) => a + b, 0) / complexities.length
    : 0;

  const totalAffectedRows = metrics.reduce((sum, m) => sum + (m.affected_rows || 0), 0);

  // Find repeat failures (same migration failing multiple times)
  const failuresByMigration = new Map<string, number>();
  metrics
    .filter(m => m.execution_status === 'failed')
    .forEach(m => {
      const count = failuresByMigration.get(m.migration_id) || 0;
      failuresByMigration.set(m.migration_id, count + 1);
    });
  const repeatFailures = Array.from(failuresByMigration.values()).filter(count => count > 1).length;

  // Find flaky migrations (sometimes succeed, sometimes fail)
  const migrationResults = new Map<string, { success: number; failure: number }>();
  metrics.forEach(m => {
    const existing = migrationResults.get(m.migration_id) || { success: 0, failure: 0 };
    if (m.execution_status === 'success') {
      existing.success++;
    } else if (m.execution_status === 'failed') {
      existing.failure++;
    }
    migrationResults.set(m.migration_id, existing);
  });

  const flakyMigrations = Array.from(migrationResults.entries())
    .filter(([_, results]) => results.success > 0 && results.failure > 0)
    .map(([id, _]) => id);

  return {
    total: metrics.length,
    successCount,
    failureCount,
    successRate,
    averageDuration,
    averageComplexity,
    totalAffectedRows,
    repeatFailures,
    flakyMigrations,
  };
}

/**
 * Correlate migration failures with schema complexity/drift
 */
export async function correlateMigrationFailures(
  supabase: SupabaseClient,
  projectId: string
): Promise<MigrationCorrelation> {
  // Get migration metrics
  const { data: metrics } = await supabase
    .from('migration_metrics')
    .select('*')
    .eq('project_id', projectId)
    .eq('execution_type', 'apply');

  if (!metrics || metrics.length === 0) {
    return {
      complexityVsDuration: [],
      driftVsFailures: [],
      breakingChangesVsFailures: [],
    };
  }

  // Complexity vs Duration
  const complexityVsDuration = metrics
    .filter(m => m.complexity_score && m.duration_ms)
    .map(m => ({
      complexity: m.complexity_score!,
      duration: m.duration_ms!,
    }));

  // Get drift metrics for the same period
  const { data: driftMetrics } = await supabase
    .from('schema_drift_metrics')
    .select('*')
    .eq('project_id', projectId)
    .order('snapshot_date', { ascending: false })
    .limit(30);

  // Group migrations by date and correlate with drift
  const driftVsFailures: { driftLevel: number; failureRate: number }[] = [];
  if (driftMetrics && driftMetrics.length > 0) {
    for (const drift of driftMetrics) {
      const driftDate = new Date(drift.snapshot_date);
      const nextDay = new Date(driftDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const migrationsInPeriod = metrics.filter(m => {
        const execDate = new Date(m.executed_at);
        return execDate >= driftDate && execDate < nextDay;
      });

      if (migrationsInPeriod.length > 0) {
        const failures = migrationsInPeriod.filter(m => m.execution_status === 'failed').length;
        driftVsFailures.push({
          driftLevel: drift.drift_velocity || 0,
          failureRate: (failures / migrationsInPeriod.length) * 100,
        });
      }
    }
  }

  // Breaking changes vs failures
  const breakingChangesGroups = new Map<number, { total: number; failures: number }>();
  metrics.forEach(m => {
    const breakingChanges = m.breaking_changes || 0;
    const existing = breakingChangesGroups.get(breakingChanges) || { total: 0, failures: 0 };
    existing.total++;
    if (m.execution_status === 'failed') {
      existing.failures++;
    }
    breakingChangesGroups.set(breakingChanges, existing);
  });

  const breakingChangesVsFailures = Array.from(breakingChangesGroups.entries())
    .map(([breakingChanges, data]) => ({
      breakingChanges,
      failureRate: (data.failures / data.total) * 100,
    }))
    .sort((a, b) => a.breakingChanges - b.breakingChanges);

  return {
    complexityVsDuration,
    driftVsFailures,
    breakingChangesVsFailures,
  };
}

