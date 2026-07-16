/**
 * Schema Stability Scorer
 * 
 * Computes a schema stability score based on drift velocity, migration failures, and breaking changes.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getDriftTrends } from './drift-analyzer';
import { getMigrationStats } from './migration-metrics';

export interface StabilityScore {
  score: number; // 0-100, higher is more stable
  date: string;
  driftVelocityScore: number; // Component score (0-100)
  migrationFailureScore: number; // Component score (0-100)
  breakingChangeScore: number; // Component score (0-100)
  trend: 'improving' | 'stable' | 'degrading';
  factors: {
    driftVelocity: number;
    migrationFailureRate: number;
    breakingChangeCount: number;
    recentFailures: number;
    driftAcceleration: number;
    currentDriftChanges: number;
  };
}

/**
 * Calculate schema stability score
 */
export async function calculateStabilityScore(
  supabase: SupabaseClient,
  projectId: string
): Promise<StabilityScore | null> {
  const now = new Date();
  const scoreDate = now.toISOString().split('T')[0];

  // Get drift trends (last 30 days)
  const driftTrends = await getDriftTrends(supabase, projectId, 30);
  const currentDrift = driftTrends.length > 0 ? driftTrends[driftTrends.length - 1] : null;
  const driftVelocity = currentDrift?.velocity || 0;
  const currentDriftChanges = currentDrift?.totalChanges || 0;

  // Get migration stats (last 30 days)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const migrationStats = await getMigrationStats(supabase, projectId, startDate, now);

  // A project with no scan or migration evidence cannot have a meaningful
  // stability score. Previously, the empty defaults happened to total 65.
  const hasDriftEvidence = driftTrends.length > 0;
  const hasMigrationEvidence = migrationStats.total > 0;
  if (!hasDriftEvidence && !hasMigrationEvidence) {
    return null;
  }

  // Get recent breaking changes
  const { data: recentMigrations } = await supabase
    .from('migration_metrics')
    .select('breaking_changes')
    .eq('project_id', projectId)
    .gte('executed_at', startDate.toISOString())
    .eq('execution_type', 'apply');

  const breakingChangeCount = recentMigrations?.reduce(
    (sum, m) => sum + (m.breaking_changes || 0),
    0
  ) || 0;

  // Calculate component scores (0-100, higher is better)
  const driftVelocityScore = calculateDriftVelocityScore(
    Math.max(driftVelocity, currentDriftChanges)
  );
  const migrationFailureScore = calculateMigrationFailureScore(migrationStats.successRate);
  const breakingChangeScore = calculateBreakingChangeScore(breakingChangeCount);

  // Calculate overall score (weighted average)
  const weights = {
    drift: 0.4, // Drift velocity is most important
    failures: 0.35, // Migration failures are critical
    breaking: 0.25, // Breaking changes are concerning
  };

  const weightedComponents = [
    ...(hasDriftEvidence ? [{ score: driftVelocityScore, weight: weights.drift }] : []),
    ...(hasMigrationEvidence ? [
      { score: migrationFailureScore, weight: weights.failures },
      { score: breakingChangeScore, weight: weights.breaking },
    ] : []),
  ];
  const activeWeight = weightedComponents.reduce((sum, component) => sum + component.weight, 0);
  const overallScore = Math.round(
    weightedComponents.reduce(
      (sum, component) => sum + component.score * component.weight,
      0
    ) / activeWeight
  );

  // Determine trend
  const { data: previousScore } = await supabase
    .from('schema_stability_scores')
    .select('stability_score')
    .eq('project_id', projectId)
    .order('score_date', { ascending: false })
    .limit(1)
    .single();

  let trend: 'improving' | 'stable' | 'degrading' = 'stable';
  if (previousScore) {
    const previous = previousScore.stability_score;
    if (overallScore > previous + 5) {
      trend = 'improving';
    } else if (overallScore < previous - 5) {
      trend = 'degrading';
    }
  }

  // Calculate drift acceleration
  let driftAcceleration = 0;
  if (driftTrends.length >= 2) {
    const recent = driftTrends.slice(-3);
    if (recent.length >= 2) {
      const velocities = recent.map(t => t.velocity);
      driftAcceleration = velocities[velocities.length - 1] - velocities[0];
    }
  }

  const score: StabilityScore = {
    score: overallScore,
    date: scoreDate,
    driftVelocityScore,
    migrationFailureScore,
    breakingChangeScore,
    trend,
    factors: {
      driftVelocity,
      migrationFailureRate: 100 - migrationStats.successRate,
      breakingChangeCount,
      recentFailures: migrationStats.failureCount,
      driftAcceleration,
      currentDriftChanges,
    },
  };

  // Store score
  await supabase
    .from('schema_stability_scores')
    .upsert({
      project_id: projectId,
      score_date: scoreDate,
      stability_score: overallScore,
      drift_velocity_score: driftVelocityScore,
      migration_failure_score: migrationFailureScore,
      breaking_change_score: breakingChangeScore,
      trend,
      factors: score.factors,
    }, {
      onConflict: 'project_id,score_date',
    });

  return score;
}

/**
 * Calculate drift velocity score (0-100, higher is better)
 */
function calculateDriftVelocityScore(velocity: number): number {
  // Lower velocity = higher score
  if (velocity === 0) return 100;
  if (velocity < 1) return 90;
  if (velocity < 3) return 75;
  if (velocity < 5) return 60;
  if (velocity < 10) return 40;
  if (velocity < 20) return 20;
  return 0;
}

/**
 * Calculate migration failure score (0-100, higher is better)
 */
function calculateMigrationFailureScore(successRate: number): number {
  // Higher success rate = higher score
  return Math.round(successRate);
}

/**
 * Calculate breaking change score (0-100, higher is better)
 */
function calculateBreakingChangeScore(breakingChangeCount: number): number {
  // Fewer breaking changes = higher score
  if (breakingChangeCount === 0) return 100;
  if (breakingChangeCount <= 2) return 80;
  if (breakingChangeCount <= 5) return 60;
  if (breakingChangeCount <= 10) return 40;
  if (breakingChangeCount <= 20) return 20;
  return 0;
}

/**
 * Get stability score history
 */
export async function getStabilityScoreHistory(
  supabase: SupabaseClient,
  projectId: string,
  days: number = 90
): Promise<StabilityScore[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('schema_stability_scores')
    .select('*')
    .eq('project_id', projectId)
    .gte('score_date', startDate.toISOString().split('T')[0])
    .order('score_date', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    score: row.stability_score,
    date: row.score_date,
    driftVelocityScore: row.drift_velocity_score,
    migrationFailureScore: row.migration_failure_score,
    breakingChangeScore: row.breaking_change_score,
    trend: row.trend as 'improving' | 'stable' | 'degrading',
    factors: row.factors || {},
  }));
}

/**
 * Get stability score explanation
 */
export function getStabilityScoreExplanation(score: StabilityScore): string {
  const parts: string[] = [];

  if (score.score >= 80) {
    parts.push('Your schema is highly stable with minimal drift and reliable migrations.');
  } else if (score.score >= 60) {
    parts.push('Your schema is generally stable but has some areas for improvement.');
  } else if (score.score >= 40) {
    parts.push('Your schema shows moderate instability with increasing drift or migration issues.');
  } else {
    parts.push('Your schema is unstable with significant drift, frequent failures, or many breaking changes.');
  }

  if (score.factors.driftVelocity > 10) {
    parts.push(`High drift velocity (${score.factors.driftVelocity.toFixed(1)} changes/day) indicates rapid schema changes.`);
  }

  if (score.factors.migrationFailureRate > 20) {
    parts.push(`High migration failure rate (${score.factors.migrationFailureRate.toFixed(1)}%) suggests migration complexity or validation issues.`);
  }

  if (score.factors.breakingChangeCount > 5) {
    parts.push(`Multiple breaking changes (${score.factors.breakingChangeCount}) detected, which increases risk.`);
  }

  if (score.trend === 'improving') {
    parts.push('Stability is improving over time.');
  } else if (score.trend === 'degrading') {
    parts.push('Stability is degrading - consider reviewing recent changes.');
  }

  return parts.join(' ');
}

