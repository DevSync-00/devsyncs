import type {
  ApplicationImpactReport,
  SchemaMismatch,
  ScannedSchema,
} from './schema-scanner';

export interface SafetyDiagnostic {
  id: string;
  category: 'data-loss' | 'compatibility' | 'availability' | 'ownership' | 'testing' | 'rollback';
  severity: 'blocker' | 'warning' | 'notice';
  object: string;
  title: string;
  evidence: string[];
  remediation: string;
}

export interface ChangeSafetyReport {
  version: 1;
  score: number;
  decision: 'block' | 'review' | 'ready';
  diagnostics: SafetyDiagnostic[];
  gates: Array<{
    id: string;
    label: string;
    status: 'passed' | 'failed' | 'required';
    reason: string;
  }>;
  estimates: {
    destructiveOperations: number;
    compatibilityRisks: number;
    affectedApplicationFiles: number;
    ownerCoveragePercent: number;
    testEvidenceFiles: number;
  };
}

/**
 * Deterministic safety policy used by the dashboard, CI checks, and AI planner.
 * AI can suggest remediations, but cannot override these gates.
 */
export function evaluateChangeSafety(
  mismatches: SchemaMismatch[],
  databaseSchema: ScannedSchema,
  impact: ApplicationImpactReport,
): ChangeSafetyReport {
  const diagnostics: SafetyDiagnostic[] = [];
  const tableMap = new Map(databaseSchema.tables.map((table) => [table.name.toLowerCase(), table]));

  mismatches.forEach((mismatch, index) => {
    const object = mismatch.field ? `${mismatch.model}.${mismatch.field}` : mismatch.model;
    const finding = impact.findings.find((item) => item.mismatchIndex === index);
    const table = tableMap.get((mismatch.table || mismatch.model).toLowerCase());

    if (mismatch.type === 'extra_table' || mismatch.type === 'extra_field') {
      diagnostics.push({
        id: `destructive-${index}`,
        category: 'data-loss',
        severity: finding?.references.length ? 'blocker' : 'warning',
        object,
        title: mismatch.type === 'extra_table' ? 'Table removal can destroy data' : 'Column removal can destroy data',
        evidence: [
          mismatch.message,
          `${finding?.references.length || 0} code references detected.`,
          table ? `The object exists in the live database with ${table.columns.length} known columns.` : 'The object exists in the live database.',
        ],
        remediation: 'Use an expand-and-contract rollout and prove that all readers and writers have moved before removal.',
      });
    }

    if (mismatch.type === 'type_mismatch') {
      diagnostics.push({
        id: `rewrite-${index}`,
        category: 'availability',
        severity: 'warning',
        object,
        title: 'Type conversion may rewrite or lock the table',
        evidence: [mismatch.message, 'Exact lock duration requires a rehearsal against production-shaped data.'],
        remediation: 'Rehearse the conversion, measure locks, and use a shadow column with batched backfill for large tables.',
      });
    }

    if (mismatch.type === 'nullable_mismatch') {
      diagnostics.push({
        id: `nullability-${index}`,
        category: 'data-loss',
        severity: 'warning',
        object,
        title: 'Constraint may fail on existing rows',
        evidence: [mismatch.message, 'Live row-level null counts are required before enforcing NOT NULL.'],
        remediation: 'Add application validation, backfill nulls in batches, then validate the constraint.',
      });
    }

    if (finding?.breaking) {
      diagnostics.push({
        id: `compatibility-${index}`,
        category: 'compatibility',
        severity: 'blocker',
        object,
        title: 'Application compatibility break detected',
        evidence: finding.evidence,
        remediation: finding.compatibilityPlan.join(' '),
      });
    }
  });

  if (impact.summary.ownerCoveragePercent < 100 && impact.summary.affectedFiles > 0) {
    diagnostics.push({
      id: 'owner-coverage',
      category: 'ownership',
      severity: 'warning',
      object: 'change set',
      title: 'Affected code does not have complete ownership',
      evidence: [`CODEOWNERS coverage is ${impact.summary.ownerCoveragePercent}%.`],
      remediation: 'Assign owners to affected paths before requesting production approval.',
    });
  }

  if (impact.summary.testCoverageFiles === 0 && impact.summary.affectedFiles > 0) {
    diagnostics.push({
      id: 'test-evidence',
      category: 'testing',
      severity: 'warning',
      object: 'change set',
      title: 'No directly related test files were detected',
      evidence: [`${impact.summary.affectedFiles} application files are affected, with no matching test references.`],
      remediation: 'Add or identify compatibility tests and replay them during migration rehearsal.',
    });
  }

  const blockerCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'blocker').length;
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
  const score = Math.max(0, 100 - blockerCount * 30 - warningCount * 10);
  const destructiveOperations = mismatches.filter((mismatch) =>
    mismatch.type === 'extra_table' || mismatch.type === 'extra_field',
  ).length;

  return {
    version: 1,
    score,
    decision: blockerCount ? 'block' : warningCount ? 'review' : 'ready',
    diagnostics,
    gates: [
      {
        id: 'compatibility',
        label: 'Application compatibility',
        status: impact.summary.breakingChanges ? 'failed' : 'passed',
        reason: impact.summary.breakingChanges
          ? `${impact.summary.breakingChanges} breaking change${impact.summary.breakingChanges === 1 ? '' : 's'} detected.`
          : 'No direct application compatibility breaks detected.',
      },
      {
        id: 'ownership',
        label: 'Owner review',
        status: impact.summary.ownerCoveragePercent === 100 ? 'passed' : 'required',
        reason: `${impact.summary.ownerCoveragePercent}% of affected files have an owner.`,
      },
      {
        id: 'rehearsal',
        label: 'Migration rehearsal',
        status: diagnostics.some((diagnostic) => ['data-loss', 'availability'].includes(diagnostic.category))
          ? 'required'
          : 'passed',
        reason: destructiveOperations
          ? 'Destructive or data-dependent changes require a production-shaped rehearsal.'
          : 'No destructive operation requires rehearsal.',
      },
      {
        id: 'tests',
        label: 'Compatibility tests',
        status: impact.summary.testCoverageFiles > 0 || impact.summary.affectedFiles === 0 ? 'passed' : 'required',
        reason: `${impact.summary.testCoverageFiles} related test file${impact.summary.testCoverageFiles === 1 ? '' : 's'} detected.`,
      },
    ],
    estimates: {
      destructiveOperations,
      compatibilityRisks: impact.summary.breakingChanges,
      affectedApplicationFiles: impact.summary.affectedFiles,
      ownerCoveragePercent: impact.summary.ownerCoveragePercent,
      testEvidenceFiles: impact.summary.testCoverageFiles,
    },
  };
}
