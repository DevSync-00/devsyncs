/**
 * Fix & Migration Engine (Phase 7)
 * 
 * Generates safe, previewed fixes and migrations based on:
 * - Conflict detection (Phase 5)
 * - AI reasoning (Phase 6)
 * - Canonical schemas (Phase 4)
 * 
 * Per charter requirements:
 * - All fixes are preview-only by default
 * - Rollback support for all changes
 * - Zero destructive defaults
 * - Explicit opt-in for any writes
 */

import type { ConflictReport, Conflict } from './conflict-detector.js';
import type { ReasoningResult, ConflictExplanation } from './ai-reasoner.js';
import type { CanonicalSchema } from './schema-normalizer.js';
import type { Mismatch } from '../types/index.js';
import { generateMigration, type Migration } from './migration-generator.js';

export interface FixOptions {
  includeLowRisk?: boolean; // Include low-risk conflicts (default: false)
  includeInfo?: boolean; // Include info-level conflicts (default: false)
  generateRollback?: boolean; // Generate rollback SQL (default: true)
  dryRun?: boolean; // Preview only, don't save (default: true)
  outputPath?: string; // Where to save migration file
  format?: 'sql' | 'prisma'; // Migration format
}

export interface FixPlan {
  id: string;
  conflicts: Conflict[];
  explanations: ConflictExplanation[];
  migration: Migration;
  safetyAssessment: {
    overallRisk: 'low' | 'medium' | 'high';
    dataLossRisk: boolean;
    breakingChanges: string[];
    requiresBackup: boolean;
  };
  recommendedActions: string[];
  metadata: {
    generatedAt: Date;
    totalConflicts: number;
    conflictsIncluded: number;
    conflictsExcluded: number;
  };
}

/**
 * Generate fix plan from conflicts and AI reasoning
 */
export function generateFixPlan(
  conflictReport: ConflictReport,
  reasoningResult: ReasoningResult,
  codeSchema: CanonicalSchema,
  options: FixOptions = {}
): FixPlan {
  const {
    includeLowRisk = false,
    includeInfo = false,
    generateRollback = true,
    format = 'sql',
  } = options;

  // Filter conflicts based on risk level
  const conflictsToFix = conflictReport.conflicts.filter((c) => {
    if (c.risk === 'high' || c.risk === 'medium') return true;
    if (c.risk === 'low' && includeLowRisk) return true;
    return false;
  });

  // Convert conflicts to old Mismatch format for migration generator
  // (temporary bridge until migration generator is updated)
  const mismatches: Mismatch[] = conflictsToFix.map((conflict) => ({
    type: conflict.type as any,
    model: conflict.table,
    field: conflict.column,
    codeValue: conflict.codeValue,
    dbValue: conflict.dbValue,
    severity: conflict.risk === 'high' ? 'error' : conflict.risk === 'medium' ? 'warning' : 'info',
    suggestedFix: conflict.suggestedFix,
  }));

  // Generate migration
  const migration = generateMigration(mismatches, undefined, {
    includeRollback: generateRollback,
    format,
  });

  // Build safety assessment
  const safetyAssessment = assessSafety(conflictsToFix, reasoningResult);

  // Get explanations for included conflicts
  const explanations = reasoningResult.explanations.filter((exp) =>
    conflictsToFix.some((c) => c.id === exp.conflictId)
  );

  // Build recommended actions
  const recommendedActions = buildRecommendedActions(
    conflictsToFix,
    explanations,
    safetyAssessment
  );

  return {
    id: generateFixPlanId(),
    conflicts: conflictsToFix,
    explanations,
    migration,
    safetyAssessment,
    recommendedActions,
    metadata: {
      generatedAt: new Date(),
      totalConflicts: conflictReport.conflicts.length,
      conflictsIncluded: conflictsToFix.length,
      conflictsExcluded: conflictReport.conflicts.length - conflictsToFix.length,
    },
  };
}

/**
 * Assess overall safety of fix plan
 */
function assessSafety(
  conflicts: Conflict[],
  reasoningResult: ReasoningResult
): FixPlan['safetyAssessment'] {
  const highRiskCount = conflicts.filter((c) => c.risk === 'high').length;
  const mediumRiskCount = conflicts.filter((c) => c.risk === 'medium').length;

  // Check for data loss risks
  const dataLossConflicts = reasoningResult.explanations.filter(
    (exp) => exp.impact === 'data-loss'
  );
  const dataLossRisk = dataLossConflicts.length > 0;

  // Check for breaking changes
  const breakingChanges: string[] = [];
  for (const conflict of conflicts) {
    if (conflict.type === 'missing_table' || conflict.type === 'missing_column') {
      breakingChanges.push(
        `Removing ${conflict.type === 'missing_table' ? 'table' : 'column'} "${conflict.table}${conflict.column ? `.${conflict.column}` : ''}" may break application code`
      );
    }
    if (conflict.type === 'type_mismatch') {
      const exp = reasoningResult.explanations.find((e) => e.conflictId === conflict.id);
      if (exp?.impact === 'runtime-errors') {
        breakingChanges.push(
          `Type change for ${conflict.table}.${conflict.column} may cause runtime errors`
        );
      }
    }
  }

  // Determine overall risk
  let overallRisk: 'low' | 'medium' | 'high';
  if (highRiskCount > 0 || dataLossRisk) {
    overallRisk = 'high';
  } else if (mediumRiskCount > 0 || breakingChanges.length > 0) {
    overallRisk = 'medium';
  } else {
    overallRisk = 'low';
  }

  // Require backup if high risk or data loss
  const requiresBackup = overallRisk === 'high' || dataLossRisk;

  return {
    overallRisk,
    dataLossRisk,
    breakingChanges,
    requiresBackup,
  };
}

/**
 * Build recommended actions based on conflicts and reasoning
 */
function buildRecommendedActions(
  conflicts: Conflict[],
  explanations: ConflictExplanation[],
  safetyAssessment: FixPlan['safetyAssessment']
): string[] {
  const actions: string[] = [];

  if (safetyAssessment.requiresBackup) {
    actions.push('⚠️  BACKUP DATABASE before applying this fix');
  }

  if (safetyAssessment.breakingChanges.length > 0) {
    actions.push('⚠️  Review breaking changes - application code may need updates');
  }

  // Group by recommended action from AI
  const actionGroups = new Map<string, Conflict[]>();
  for (const conflict of conflicts) {
    const exp = explanations.find((e) => e.conflictId === conflict.id);
    const action = exp?.recommendedAction || 'manual-review';
    if (!actionGroups.has(action)) {
      actionGroups.set(action, []);
    }
    actionGroups.get(action)!.push(conflict);
  }

  // Add specific recommendations
  if (actionGroups.has('add-migration')) {
    actions.push(`Apply migration for ${actionGroups.get('add-migration')!.length} structural changes`);
  }
  if (actionGroups.has('alter-column')) {
    actions.push(`Review ${actionGroups.get('alter-column')!.length} column type changes`);
  }
  if (actionGroups.has('add-constraint')) {
    actions.push(`Add ${actionGroups.get('add-constraint')!.length} missing constraints`);
  }
  if (actionGroups.has('manual-review')) {
    actions.push(`Manually review ${actionGroups.get('manual-review')!.length} conflicts`);
  }

  // Add safety notes
  const safetyNotes = explanations
    .map((exp) => exp.safetyNotes)
    .filter((note): note is string => !!note);
  if (safetyNotes.length > 0) {
    actions.push(`Safety considerations: ${safetyNotes.join('; ')}`);
  }

  return actions;
}

/**
 * Generate deterministic fix plan ID
 */
function generateFixPlanId(): string {
  return `fix_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate fix plan before application
 */
export function validateFixPlan(plan: FixPlan): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for high-risk operations without backup recommendation
  if (plan.safetyAssessment.overallRisk === 'high' && !plan.safetyAssessment.requiresBackup) {
    warnings.push('High-risk fix plan should include backup recommendation');
  }

  // Check for data loss risks
  if (plan.safetyAssessment.dataLossRisk) {
    errors.push('Fix plan includes data loss risks - manual review required');
  }

  // Check migration SQL is present
  if (!plan.migration.sql || plan.migration.sql.trim().length === 0) {
    errors.push('Migration SQL is empty');
  }

  // Check rollback is present for high-risk plans
  if (
    plan.safetyAssessment.overallRisk === 'high' &&
    (!plan.migration.rollback || plan.migration.rollback.trim().length === 0)
  ) {
    warnings.push('High-risk fix plan should include rollback SQL');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format fix plan for display
 */
export function formatFixPlan(plan: FixPlan, format: 'table' | 'json' = 'table'): string {
  if (format === 'json') {
    return JSON.stringify(plan, null, 2);
  }

  // Table format
  const lines: string[] = [];
  lines.push('='.repeat(80));
  lines.push(`Fix Plan: ${plan.id}`);
  lines.push('='.repeat(80));
  lines.push('');
  lines.push(`Generated: ${plan.metadata.generatedAt.toISOString()}`);
  lines.push(`Conflicts: ${plan.metadata.conflictsIncluded}/${plan.metadata.totalConflicts} included`);
  lines.push('');

  // Safety assessment
  lines.push('SAFETY ASSESSMENT:');
  lines.push(`  Overall Risk: ${plan.safetyAssessment.overallRisk.toUpperCase()}`);
  lines.push(`  Data Loss Risk: ${plan.safetyAssessment.dataLossRisk ? 'YES ⚠️' : 'NO'}`);
  lines.push(`  Requires Backup: ${plan.safetyAssessment.requiresBackup ? 'YES ⚠️' : 'NO'}`);
  if (plan.safetyAssessment.breakingChanges.length > 0) {
    lines.push(`  Breaking Changes: ${plan.safetyAssessment.breakingChanges.length}`);
    for (const change of plan.safetyAssessment.breakingChanges) {
      lines.push(`    - ${change}`);
    }
  }
  lines.push('');

  // Recommended actions
  lines.push('RECOMMENDED ACTIONS:');
  for (const action of plan.recommendedActions) {
    lines.push(`  ${action}`);
  }
  lines.push('');

  // Conflicts summary
  lines.push('CONFLICTS TO FIX:');
  const byRisk = {
    high: plan.conflicts.filter((c) => c.risk === 'high'),
    medium: plan.conflicts.filter((c) => c.risk === 'medium'),
    low: plan.conflicts.filter((c) => c.risk === 'low'),
  };
  lines.push(`  High Risk: ${byRisk.high.length}`);
  lines.push(`  Medium Risk: ${byRisk.medium.length}`);
  lines.push(`  Low Risk: ${byRisk.low.length}`);
  lines.push('');

  // Migration preview
  lines.push('MIGRATION SQL (preview):');
  lines.push('-'.repeat(80));
  lines.push(plan.migration.sql.substring(0, 1000)); // Limit preview
  if (plan.migration.sql.length > 1000) {
    lines.push('... (truncated, see full migration in file)');
  }
  lines.push('-'.repeat(80));

  return lines.join('\n');
}

