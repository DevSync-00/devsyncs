export interface RehearsalAnalysis {
  status: 'passed' | 'failed';
  executionTimeMs: number;
  rollbackStatus: 'not_tested' | 'passed' | 'failed';
  lockEstimates: Array<{
    statement: number;
    object: string;
    level: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    mitigation?: string;
  }>;
  checks: Array<{
    id: string;
    label: string;
    status: 'passed' | 'warning' | 'failed';
    detail: string;
  }>;
  evidence: string[];
}

export function analyzeMigrationRehearsal(sql: string, rollbackSql?: string | null): RehearsalAnalysis {
  const startedAt = Date.now();
  const statements = splitStatements(sql);
  const lockEstimates: RehearsalAnalysis['lockEstimates'] = [];
  const evidence: string[] = [];

  statements.forEach((statement, index) => {
    const object = extractObject(statement);
    if (/\bDROP\s+(TABLE|COLUMN)\b/i.test(statement)) {
      lockEstimates.push({
        statement: index + 1,
        object,
        level: 'critical',
        reason: 'Destructive DDL can permanently remove live data and usually requires an exclusive lock.',
        mitigation: 'Use expand-and-contract and delay removal until all application references are retired.',
      });
    } else if (/\bALTER\s+TABLE\b[\s\S]*\b(TYPE|SET\s+DATA\s+TYPE)\b/i.test(statement)) {
      lockEstimates.push({
        statement: index + 1,
        object,
        level: 'high',
        reason: 'Column type changes may rewrite the table and block concurrent reads or writes.',
        mitigation: 'Use a shadow column, batched backfill, and a short final cutover.',
      });
    } else if (/\bALTER\s+TABLE\b[\s\S]*\bSET\s+NOT\s+NULL\b/i.test(statement)) {
      lockEstimates.push({
        statement: index + 1,
        object,
        level: 'high',
        reason: 'Constraint validation may scan the table and fails when existing null values are present.',
        mitigation: 'Backfill first, add a not-valid check constraint, validate it, then set NOT NULL.',
      });
    } else if (/\bCREATE\s+(UNIQUE\s+)?INDEX\b/i.test(statement) && !/\bCONCURRENTLY\b/i.test(statement)) {
      lockEstimates.push({
        statement: index + 1,
        object,
        level: 'high',
        reason: 'A non-concurrent index build can block writes for the duration of the build.',
        mitigation: 'Use CREATE INDEX CONCURRENTLY where the database supports it.',
      });
    } else if (/\bADD\s+COLUMN\b/i.test(statement) && /\bDEFAULT\b/i.test(statement)) {
      lockEstimates.push({
        statement: index + 1,
        object,
        level: 'medium',
        reason: 'Adding a column with a default may rewrite older database versions or increase lock time.',
        mitigation: 'Add the nullable column first, backfill in batches, then add the default and constraint.',
      });
    } else {
      lockEstimates.push({
        statement: index + 1,
        object,
        level: 'low',
        reason: 'No known high-risk lock pattern was detected by static preflight.',
      });
    }
  });

  const critical = lockEstimates.filter((estimate) => estimate.level === 'critical').length;
  const high = lockEstimates.filter((estimate) => estimate.level === 'high').length;
  const rollbackStatus = validateRollback(rollbackSql);
  evidence.push(`Parsed ${statements.length} executable SQL statement${statements.length === 1 ? '' : 's'}.`);
  evidence.push(`${critical} critical and ${high} high lock-risk pattern${critical + high === 1 ? '' : 's'} detected.`);
  evidence.push(rollbackStatus === 'passed'
    ? 'A non-empty rollback plan is available for preview execution.'
    : 'No executable rollback plan is available; production promotion must remain gated.');
  evidence.push('Static estimates must be confirmed against a production-shaped preview database before production.');

  const checks: RehearsalAnalysis['checks'] = [
    {
      id: 'parse',
      label: 'SQL parse',
      status: statements.length ? 'passed' : 'failed',
      detail: statements.length ? `${statements.length} statements are ready for rehearsal.` : 'No executable SQL statements found.',
    },
    {
      id: 'destructive',
      label: 'Destructive operations',
      status: critical ? 'failed' : high ? 'warning' : 'passed',
      detail: critical ? `${critical} destructive operation${critical === 1 ? '' : 's'} require an explicit exception.` : 'No unreviewed destructive DDL detected.',
    },
    {
      id: 'locks',
      label: 'Lock safety',
      status: high ? 'warning' : 'passed',
      detail: high ? `${high} statement${high === 1 ? '' : 's'} need production-shaped lock measurement.` : 'Static preflight found no high-risk lock pattern.',
    },
    {
      id: 'rollback',
      label: 'Rollback plan',
      status: rollbackStatus === 'passed' ? 'passed' : 'warning',
      detail: rollbackStatus === 'passed' ? 'Rollback SQL is present and parseable.' : 'Provide rollback SQL before protected-environment promotion.',
    },
  ];

  return {
    status: statements.length > 0 && critical === 0 ? 'passed' : 'failed',
    executionTimeMs: Date.now() - startedAt,
    rollbackStatus,
    lockEstimates,
    checks,
    evidence,
  };
}

export function buildDataAssertions(sql: string): Array<{ name: string; sql: string; expected: 'zero' }> {
  const assertions: Array<{ name: string; sql: string; expected: 'zero' }> = [];
  for (const statement of splitStatements(sql)) {
    const notNull = statement.match(
      /\bALTER\s+TABLE\s+["`]?([a-zA-Z0-9_]+)["`]?\s+ALTER\s+COLUMN\s+["`]?([a-zA-Z0-9_]+)["`]?\s+SET\s+NOT\s+NULL/i,
    );
    if (notNull) {
      const [, table, column] = notNull;
      assertions.push({
        name: `${table}.${column} contains no null values`,
        sql: `SELECT COUNT(*)::int AS violations FROM "${table}" WHERE "${column}" IS NULL`,
        expected: 'zero',
      });
    }

    const unique = statement.match(
      /\bALTER\s+TABLE\s+["`]?([a-zA-Z0-9_]+)["`]?\s+ADD\s+(?:CONSTRAINT\s+["`]?[a-zA-Z0-9_]+["`]?\s+)?UNIQUE\s*\(\s*["`]?([a-zA-Z0-9_]+)["`]?\s*\)/i,
    );
    if (unique) {
      const [, table, column] = unique;
      assertions.push({
        name: `${table}.${column} contains no duplicate values`,
        sql: `SELECT COUNT(*)::int AS violations FROM (SELECT "${column}" FROM "${table}" WHERE "${column}" IS NOT NULL GROUP BY "${column}" HAVING COUNT(*) > 1) duplicates`,
        expected: 'zero',
      });
    }
  }
  return assertions;
}

function splitStatements(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function validateRollback(sql?: string | null): 'not_tested' | 'passed' | 'failed' {
  if (!sql?.trim()) return 'not_tested';
  return splitStatements(sql).length ? 'passed' : 'failed';
}

function extractObject(statement: string): string {
  const match = statement.match(/\b(?:TABLE|INDEX|COLUMN)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?["`]?([a-zA-Z0-9_.-]+)/i);
  return match?.[1]?.replace(/["`]/g, '') || 'database object';
}
