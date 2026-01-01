/**
 * Conflict Detection Engine (Phase 5)
 * 
 * Detects conflicts between code and database canonical schemas.
 * Classifies conflicts by type and risk level (Low, Medium, High).
 * 
 * Per charter requirements:
 * - Structural mismatches (missing tables/columns)
 * - Type mismatches
 * - Relationship mismatches (foreign keys, constraints)
 * - Risk classification: Low, Medium, High
 */

import type {
  CanonicalSchema,
  CanonicalTable,
  CanonicalColumn,
  CanonicalConstraint,
  CanonicalIndex,
} from './schema-normalizer.js';
import { compareCanonicalSchemas, type SchemaComparison, type SchemaDifference } from './schema-normalizer.js';

export type ConflictRisk = 'low' | 'medium' | 'high';
export type ConflictCategory = 'structural' | 'type' | 'relationship' | 'constraint';

export interface Conflict {
  id: string; // Deterministic ID for stable reporting
  category: ConflictCategory;
  risk: ConflictRisk;
  type: string; // Original schema difference type
  table: string;
  column?: string;
  message: string;
  codeValue: any;
  dbValue: any;
  explanation: string; // Human-readable explanation
  suggestedFix?: string;
}

export interface ConflictReport {
  conflicts: Conflict[];
  summary: {
    total: number;
    byRisk: {
      high: number;
      medium: number;
      low: number;
    };
    byCategory: {
      structural: number;
      type: number;
      relationship: number;
      constraint: number;
    };
  };
  metadata: {
    codeSource: string;
    codeSourceType: string;
    dbSource: string;
    dbSourceType: string;
    detectedAt: Date;
  };
}

/**
 * Detect conflicts between code and database canonical schemas
 */
export function detectConflicts(
  codeSchema: CanonicalSchema,
  dbSchema: CanonicalSchema
): ConflictReport {
  // Use existing comparison to get raw differences
  const comparison = compareCanonicalSchemas(codeSchema, dbSchema);

  // Convert schema differences to conflicts with risk classification
  const conflicts: Conflict[] = comparison.differences.map((diff) =>
    convertDifferenceToConflict(diff, codeSchema, dbSchema)
  );

  // Detect relationship/constraint mismatches not caught by basic comparison
  const relationshipConflicts = detectRelationshipConflicts(codeSchema, dbSchema);
  conflicts.push(...relationshipConflicts);

  // Sort by risk (high first) then by table name
  conflicts.sort((a, b) => {
    const riskOrder = { high: 0, medium: 1, low: 2 };
    const riskDiff = riskOrder[a.risk] - riskOrder[b.risk];
    if (riskDiff !== 0) return riskDiff;
    return a.table.localeCompare(b.table);
  });

  // Build summary
  const byRisk = {
    high: conflicts.filter((c) => c.risk === 'high').length,
    medium: conflicts.filter((c) => c.risk === 'medium').length,
    low: conflicts.filter((c) => c.risk === 'low').length,
  };

  const byCategory = {
    structural: conflicts.filter((c) => c.category === 'structural').length,
    type: conflicts.filter((c) => c.category === 'type').length,
    relationship: conflicts.filter((c) => c.category === 'relationship').length,
    constraint: conflicts.filter((c) => c.category === 'constraint').length,
  };

  return {
    conflicts,
    summary: {
      total: conflicts.length,
      byRisk,
      byCategory,
    },
    metadata: {
      codeSource: codeSchema.metadata.source,
      codeSourceType: codeSchema.metadata.sourceType,
      dbSource: dbSchema.metadata.source,
      dbSourceType: dbSchema.metadata.sourceType,
      detectedAt: new Date(),
    },
  };
}

/**
 * Convert a schema difference to a conflict with risk classification
 */
function convertDifferenceToConflict(
  diff: SchemaDifference,
  codeSchema: CanonicalSchema,
  dbSchema: CanonicalSchema
): Conflict {
  const category = categorizeConflict(diff.type);
  const risk = assessRisk(diff, codeSchema, dbSchema);

  // Generate deterministic ID
  const id = generateConflictId(diff);

  // Build explanation
  const explanation = buildExplanation(diff, risk);

  // Extract suggested fix if available
  const suggestedFix = buildSuggestedFix(diff);

  return {
    id,
    category,
    risk,
    type: diff.type,
    table: diff.table,
    column: diff.column,
    message: diff.message,
    codeValue: diff.codeValue,
    dbValue: diff.dbValue,
    explanation,
    suggestedFix,
  };
}

/**
 * Categorize conflict type
 */
function categorizeConflict(type: SchemaDifference['type']): ConflictCategory {
  switch (type) {
    case 'missing_table':
    case 'extra_table':
    case 'missing_column':
    case 'extra_column':
      return 'structural';
    case 'type_mismatch':
      return 'type';
    case 'nullable_mismatch':
      return 'constraint';
    default:
      return 'structural';
  }
}

/**
 * Assess risk level for a conflict
 */
function assessRisk(
  diff: SchemaDifference,
  codeSchema: CanonicalSchema,
  dbSchema: CanonicalSchema
): ConflictRisk {
  // Structural conflicts are generally high risk
  if (diff.type === 'missing_table' || diff.type === 'missing_column') {
    return 'high'; // Code expects something that doesn't exist - runtime errors likely
  }

  // Type mismatches - assess based on compatibility
  if (diff.type === 'type_mismatch') {
    const codeType = typeof diff.codeValue === 'string' ? diff.codeValue : '';
    const dbType = typeof diff.dbValue === 'string' ? diff.dbValue : '';

    // High risk: incompatible types (e.g., text vs integer)
    if (isHighRiskTypeMismatch(codeType, dbType)) {
      return 'high';
    }

    // Medium risk: compatible but different (e.g., varchar vs text)
    if (isCompatibleTypeMismatch(codeType, dbType)) {
      return 'medium';
    }

    // Low risk: minor differences
    return 'low';
  }

  // Nullable mismatches - medium risk (can cause null constraint violations)
  if (diff.type === 'nullable_mismatch') {
    return 'medium';
  }

  // Extra tables/columns - low risk (usually informational)
  if (diff.type === 'extra_table' || diff.type === 'extra_column') {
    return 'low';
  }

  // Default to medium for unknown types
  return 'medium';
}

/**
 * Check if type mismatch is high risk (incompatible)
 */
function isHighRiskTypeMismatch(codeType: string, dbType: string): boolean {
  const incompatiblePairs: [string, string][] = [
    ['text', 'integer'],
    ['text', 'numeric'],
    ['text', 'boolean'],
    ['text', 'timestamp'],
    ['integer', 'text'],
    ['integer', 'boolean'],
    ['integer', 'timestamp'],
    ['boolean', 'text'],
    ['boolean', 'integer'],
    ['uuid', 'text'],
    ['jsonb', 'text'],
    ['timestamp', 'date'],
  ];

  const normalizedCode = codeType.toLowerCase().split('(')[0].trim();
  const normalizedDb = dbType.toLowerCase().split('(')[0].trim();

  return incompatiblePairs.some(
    ([a, b]) =>
      (normalizedCode === a && normalizedDb === b) ||
      (normalizedCode === b && normalizedDb === a)
  );
}

/**
 * Check if type mismatch is compatible (lower risk)
 */
function isCompatibleTypeMismatch(codeType: string, dbType: string): boolean {
  const compatibleGroups = [
    ['text', 'varchar', 'char', 'character varying'],
    ['integer', 'int', 'int4', 'serial'],
    ['bigint', 'int8', 'bigserial'],
    ['double precision', 'float', 'float8'],
    ['real', 'float4'],
    ['numeric', 'decimal'],
    ['timestamp', 'timestamptz'],
    ['json', 'jsonb'],
  ];

  const normalizedCode = codeType.toLowerCase().split('(')[0].trim();
  const normalizedDb = dbType.toLowerCase().split('(')[0].trim();

  return compatibleGroups.some(
    (group) => group.includes(normalizedCode) && group.includes(normalizedDb)
  );
}

/**
 * Detect relationship/constraint conflicts
 */
function detectRelationshipConflicts(
  codeSchema: CanonicalSchema,
  dbSchema: CanonicalSchema
): Conflict[] {
  const conflicts: Conflict[] = [];

  // Build lookup maps
  const codeTablesMap = new Map(codeSchema.tables.map((t) => [t.name.toLowerCase(), t]));
  const dbTablesMap = new Map(dbSchema.tables.map((t) => [t.name.toLowerCase(), t]));

  // Check foreign key constraints
  for (const codeTable of codeSchema.tables) {
    const dbTable = dbTablesMap.get(codeTable.name.toLowerCase());
    if (!dbTable) continue;

    // Compare constraints
    const codeConstraints = codeTable.constraints || [];
    const dbConstraints = dbTable.constraints || [];

    const codeFKs = codeConstraints.filter((c) => c.type === 'FOREIGN KEY');
    const dbFKs = dbConstraints.filter((c) => c.type === 'FOREIGN KEY');

    // Check for missing foreign keys in database
    for (const codeFK of codeFKs) {
      const matchingDbFK = dbFKs.find(
        (dbFK) =>
          dbFK.columns.join(',') === codeFK.columns.join(',') &&
          dbFK.references?.table === codeFK.references?.table &&
          dbFK.references?.column === codeFK.references?.column
      );

      if (!matchingDbFK) {
        conflicts.push({
          id: generateConflictId({
            type: 'missing_column', // Reuse type for ID generation
            table: codeTable.name,
            column: codeFK.columns.join(','),
            severity: 'error',
            message: '',
            codeValue: null,
            dbValue: null,
          }) + '_fk',
          category: 'relationship',
          risk: 'high',
          type: 'missing_foreign_key',
          table: codeTable.name,
          message: `Missing foreign key constraint in database: ${codeFK.columns.join(', ')} references ${codeFK.references?.table}.${codeFK.references?.column}`,
          codeValue: codeFK,
          dbValue: null,
          explanation: `Code expects a foreign key relationship that doesn't exist in the database. This can cause referential integrity issues.`,
          suggestedFix: `ALTER TABLE "${codeTable.name}" ADD CONSTRAINT "${codeFK.name || `${codeTable.name}_${codeFK.columns.join('_')}_fk`}" FOREIGN KEY (${codeFK.columns.join(', ')}) REFERENCES "${codeFK.references?.table}"(${codeFK.references?.column});`,
        });
      }
    }
  }

  // Check indexes
  for (const codeTable of codeSchema.tables) {
    const dbTable = dbTablesMap.get(codeTable.name.toLowerCase());
    if (!dbTable) continue;

    const codeIndexes = codeTable.indexes || [];
    const dbIndexes = dbTable.indexes || [];

    // Check for missing indexes (lower risk - performance impact)
    for (const codeIdx of codeIndexes) {
      const matchingDbIdx = dbIndexes.find(
        (dbIdx) => dbIdx.columns.join(',') === codeIdx.columns.join(',')
      );

      if (!matchingDbIdx) {
        conflicts.push({
          id: generateConflictId({
            type: 'missing_column',
            table: codeTable.name,
            column: codeIdx.columns.join(','),
            severity: 'warning',
            message: '',
            codeValue: null,
            dbValue: null,
          }) + '_idx',
          category: 'constraint',
          risk: 'low',
          type: 'missing_index',
          table: codeTable.name,
          message: `Missing index in database: ${codeIdx.columns.join(', ')}`,
          codeValue: codeIdx,
          dbValue: null,
          explanation: `Code expects an index that doesn't exist in the database. This may impact query performance.`,
          suggestedFix: `CREATE ${codeIdx.unique ? 'UNIQUE ' : ''}INDEX "${codeIdx.name || `${codeTable.name}_${codeIdx.columns.join('_')}_idx`}" ON "${codeTable.name}" (${codeIdx.columns.join(', ')});`,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Generate deterministic conflict ID
 */
function generateConflictId(diff: SchemaDifference): string {
  const parts = [
    diff.type,
    diff.table,
    diff.column || '',
    typeof diff.codeValue === 'string' ? diff.codeValue : JSON.stringify(diff.codeValue),
    typeof diff.dbValue === 'string' ? diff.dbValue : JSON.stringify(diff.dbValue),
  ];
  return Buffer.from(parts.join('|')).toString('base64').substring(0, 16);
}

/**
 * Build human-readable explanation
 */
function buildExplanation(diff: SchemaDifference, risk: ConflictRisk): string {
  const riskDescription = {
    high: 'This conflict can cause runtime errors or data integrity issues.',
    medium: 'This conflict may cause unexpected behavior or errors.',
    low: 'This conflict is informational and may not impact functionality.',
  };

  const baseExplanation = diff.message;
  return `${baseExplanation} ${riskDescription[risk]}`;
}

/**
 * Build suggested SQL fix
 */
function buildSuggestedFix(diff: SchemaDifference): string | undefined {
  // Basic fixes based on conflict type
  switch (diff.type) {
    case 'missing_table':
      return `-- Table "${diff.table}" needs to be created\n-- Review code schema to generate full CREATE TABLE statement`;
    case 'missing_column':
      return `ALTER TABLE "${diff.table}" ADD COLUMN "${diff.column}" ${typeof diff.codeValue === 'object' && diff.codeValue?.type ? diff.codeValue.type : 'text'};`;
    case 'extra_column':
      return `-- Column "${diff.column}" in table "${diff.table}" exists in database but not in code\n-- ALTER TABLE "${diff.table}" DROP COLUMN "${diff.column}";`;
    case 'type_mismatch':
      return `ALTER TABLE "${diff.table}" ALTER COLUMN "${diff.column}" TYPE ${diff.codeValue} USING "${diff.column}"::${diff.codeValue};`;
    case 'nullable_mismatch':
      const codeNullable = diff.codeValue === 'nullable';
      return `ALTER TABLE "${diff.table}" ALTER COLUMN "${diff.column}" ${codeNullable ? 'DROP NOT NULL' : 'SET NOT NULL'};`;
    default:
      return undefined;
  }
}

