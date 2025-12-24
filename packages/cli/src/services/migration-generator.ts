import type { Mismatch, CodeSchema, DbSchema } from '../types/index.js';
import { validateMigration, type ValidationResult } from './migration-validator.js';

export interface Migration {
  id: string;
  name: string;
  sql: string;
  description: string;
  mismatches: Mismatch[];
  timestamp: Date;
  rollback?: string; // Optional rollback SQL
  validation?: ValidationResult; // Validation results if validated
}

export interface MigrationOptions {
  outputPath?: string;
  format?: 'sql' | 'prisma';
  includeRollback?: boolean;
  dryRun?: boolean;
  strictMode?: boolean; // Treat warnings as errors
  checkPermissions?: boolean; // Check database permissions
  checkBreakingChanges?: boolean; // Detect breaking changes (default: true)
}

/**
 * Generates SQL migration from mismatches
 */
export function generateMigration(
  mismatches: Mismatch[],
  codeSchema?: CodeSchema,
  options: MigrationOptions = {}
): Migration {
  const timestamp = new Date();
  const id = generateMigrationId(timestamp);
  const name = generateMigrationName(mismatches, timestamp);
  
  // Group mismatches by type for better organization
  const errors = mismatches.filter(m => m.severity === 'error');
  const warnings = mismatches.filter(m => m.severity === 'warning');
  const infos = mismatches.filter(m => m.severity === 'info');

  // Generate SQL statements
  const sqlStatements: string[] = [];
  const rollbackStatements: string[] = [];

  // Calculate overall safety score
  const allMismatches = [...errors, ...warnings, ...infos];
  const safetyScores = allMismatches.map(m => {
    const result = generateSQLForMismatch(m, codeSchema);
    return result.safetyScore || 0.5;
  });
  const avgSafetyScore = safetyScores.length > 0
    ? safetyScores.reduce((a, b) => a + b, 0) / safetyScores.length
    : 1.0;

  // Generate migration SQL
  sqlStatements.push(`-- Migration: ${name}`);
  sqlStatements.push(`-- Generated: ${timestamp.toISOString()}`);
  sqlStatements.push(`-- Mismatches: ${mismatches.length} (${errors.length} errors, ${warnings.length} warnings, ${infos.length} info)`);
  sqlStatements.push(`-- Safety Score: ${(avgSafetyScore * 100).toFixed(0)}% (${avgSafetyScore >= 0.7 ? 'SAFE' : avgSafetyScore >= 0.4 ? 'CAUTION' : 'RISKY'})`);
  sqlStatements.push('');
  
  // Add safety warnings
  if (avgSafetyScore < 0.4) {
    sqlStatements.push('-- ⚠️  WARNING: This migration has a LOW safety score.');
    sqlStatements.push('-- ⚠️  Review carefully before applying. Data loss may occur.');
    sqlStatements.push('-- ⚠️  Consider backing up your database first.');
    sqlStatements.push('');
  } else if (avgSafetyScore < 0.7) {
    sqlStatements.push('-- ⚠️  CAUTION: This migration has a MODERATE safety score.');
    sqlStatements.push('-- ⚠️  Review before applying.');
    sqlStatements.push('');
  }
  
  sqlStatements.push('BEGIN;');
  sqlStatements.push('');

  // Process errors first (critical changes)
  if (errors.length > 0) {
    sqlStatements.push('-- ============================================');
    sqlStatements.push('-- Critical changes (errors)');
    sqlStatements.push('-- ============================================');
    for (const mismatch of errors) {
      const { sql, rollback, safetyScore } = generateSQLForMismatch(mismatch, codeSchema);
      if (sql) {
        if (safetyScore !== undefined && safetyScore < 0.5) {
          sqlStatements.push(`-- ⚠️  RISKY: Safety score ${(safetyScore * 100).toFixed(0)}%`);
        }
        sqlStatements.push(sql);
        if (rollback && options.includeRollback) {
          rollbackStatements.unshift(rollback);
        }
        sqlStatements.push('');
      }
    }
  }

  // Process warnings (less critical but important)
  if (warnings.length > 0) {
    sqlStatements.push('-- ============================================');
    sqlStatements.push('-- Warning changes');
    sqlStatements.push('-- ============================================');
    for (const mismatch of warnings) {
      const { sql, rollback, safetyScore } = generateSQLForMismatch(mismatch, codeSchema);
      if (sql) {
        if (safetyScore !== undefined && safetyScore < 0.5) {
          sqlStatements.push(`-- ⚠️  RISKY: Safety score ${(safetyScore * 100).toFixed(0)}%`);
        }
        sqlStatements.push(sql);
        if (rollback && options.includeRollback) {
          rollbackStatements.unshift(rollback);
        }
        sqlStatements.push('');
      }
    }
  }

  // Process info (optional changes - commented out)
  if (infos.length > 0 && options.format !== 'prisma') {
    sqlStatements.push('-- ============================================');
    sqlStatements.push('-- Info changes (optional - uncomment to apply)');
    sqlStatements.push('-- ============================================');
    for (const mismatch of infos) {
      const { sql, rollback } = generateSQLForMismatch(mismatch, codeSchema);
      if (sql) {
        sqlStatements.push(`-- ${sql}`);
        if (rollback && options.includeRollback) {
          rollbackStatements.unshift(`-- ${rollback}`);
        }
        sqlStatements.push('');
      }
    }
  }

  sqlStatements.push('COMMIT;');

  const sql = sqlStatements.join('\n');
  const rollback = rollbackStatements.length > 0 
    ? `-- Rollback script\nBEGIN;\n${rollbackStatements.join('\n')}\nCOMMIT;`
    : undefined;

  return {
    id,
    name,
    sql,
    description: generateDescription(mismatches),
    mismatches,
    timestamp,
    rollback
  };
}

/**
 * Generates and validates a migration.
 */
export async function generateAndValidateMigration(
  mismatches: Mismatch[],
  codeSchema: CodeSchema | undefined,
  dbSchema: DbSchema | undefined,
  connectionString: string | undefined,
  options: MigrationOptions = {}
): Promise<Migration & { validation: ValidationResult }> {
  // Generate migration
  const migration = generateMigration(mismatches, codeSchema, options);

  // Validate if connection string provided
  if (connectionString) {
    const validation = await validateMigration(migration.sql, {
      connectionString,
      currentSchema: dbSchema?.tables,
      strictMode: options.strictMode,
      checkPermissions: options.checkPermissions,
      checkBreakingChanges: options.checkBreakingChanges !== false
    });

    return {
      ...migration,
      validation
    };
  }

  // Return migration without validation if no connection string
  return {
    ...migration,
    validation: {
      valid: true,
      errors: [],
      warnings: [],
      breakingChanges: [],
      summary: {
        totalIssues: 0,
        errorCount: 0,
        warningCount: 0,
        breakingChangeCount: 0
      }
    }
  };
}

/**
 * Generate SQL for a specific mismatch type with safety checks
 */
function generateSQLForMismatch(
  mismatch: Mismatch,
  codeSchema?: CodeSchema
): { sql: string; rollback?: string; safetyScore?: number } {
  let result: { sql: string; rollback?: string; safetyScore?: number };

  switch (mismatch.type) {
    case 'missing_table':
      result = generateCreateTableSQL(mismatch, codeSchema);
      result.safetyScore = 0.9; // Safe - adding tables
      break;
    
    case 'missing_field':
      result = generateAddColumnSQL(mismatch, codeSchema);
      // Safety depends on nullable and default
      const field = codeSchema?.models
        .find(m => m.name.toLowerCase() === mismatch.model.toLowerCase())
        ?.fields.find(f => f.name.toLowerCase() === (mismatch.field || '').toLowerCase());
      result.safetyScore = (field?.nullable || field?.defaultValue) ? 0.8 : 0.5;
      break;
    
    case 'type_mismatch':
      result = generateAlterColumnTypeSQL(mismatch);
      result.safetyScore = 0.3; // Risky - type changes can cause data loss
      break;
    
    case 'constraint_mismatch':
      result = generateAlterColumnConstraintSQL(mismatch);
      result.safetyScore = 0.6; // Moderate risk
      break;
    
    case 'extra_field':
      result = generateDropColumnSQL(mismatch);
      result.safetyScore = 0.2; // Very risky - data loss
      break;
    
    default:
      result = { sql: mismatch.suggestedFix || '', rollback: undefined, safetyScore: 0.5 };
  }

  return result;
}

/**
 * Generate CREATE TABLE SQL for missing tables
 */
function generateCreateTableSQL(
  mismatch: Mismatch,
  codeSchema?: CodeSchema
): { sql: string; rollback?: string } {
  if (!codeSchema) {
    return {
      sql: `CREATE TABLE "${mismatch.model}" (id SERIAL PRIMARY KEY);`,
      rollback: `DROP TABLE IF EXISTS "${mismatch.model}";`
    };
  }

  const model = codeSchema.models.find(m => 
    m.name.toLowerCase() === mismatch.model.toLowerCase()
  );

  if (!model) {
    return {
      sql: `CREATE TABLE "${mismatch.model}" (id SERIAL PRIMARY KEY);`,
      rollback: `DROP TABLE IF EXISTS "${mismatch.model}";`
    };
  }

  // Build column definitions
  const columns: string[] = [];
  let primaryKey: string | null = null;

  for (const field of model.fields) {
    const columnDef = buildColumnDefinition(field);
    columns.push(`  "${field.name}" ${columnDef}`);

    // Track primary key
    if (field.constraints?.includes('PRIMARY KEY')) {
      primaryKey = field.name;
    }
  }

  // Build CREATE TABLE statement
  let createSQL = `CREATE TABLE "${mismatch.model}" (\n${columns.join(',\n')}`;
  
  if (!primaryKey) {
    // Add default ID if no primary key
    createSQL += `,\n  id SERIAL PRIMARY KEY`;
  }
  
  createSQL += '\n);';

  // Add indexes for unique constraints
  const indexes: string[] = [];
  for (const field of model.fields) {
    if (field.constraints?.includes('UNIQUE')) {
      indexes.push(`CREATE UNIQUE INDEX "${mismatch.model}_${field.name}_unique" ON "${mismatch.model}" ("${field.name}");`);
    }
  }

  const fullSQL = indexes.length > 0
    ? `${createSQL}\n\n${indexes.join('\n')}`
    : createSQL;

  return {
    sql: fullSQL,
    rollback: `DROP TABLE IF EXISTS "${mismatch.model}";`
  };
}

/**
 * Generate ADD COLUMN SQL for missing fields
 */
function generateAddColumnSQL(
  mismatch: Mismatch,
  codeSchema?: CodeSchema
): { sql: string; rollback?: string } {
  if (!mismatch.field) {
    return { sql: '', rollback: undefined };
  }

  const model = codeSchema?.models.find(m =>
    m.name.toLowerCase() === mismatch.model.toLowerCase()
  );
  const field = model?.fields.find(f =>
    f.name.toLowerCase() === mismatch.field!.toLowerCase()
  );

  if (!field) {
    const nullable = mismatch.codeValue?.includes('?');
    const columnType = mapTypeToPostgres(mismatch.codeValue || 'text');
    const defaultValue = mismatch.codeValue?.includes('@default') 
      ? ' DEFAULT ' + extractDefaultValue(mismatch.codeValue)
      : '';

    return {
      sql: `ALTER TABLE "${mismatch.model}" ADD COLUMN "${mismatch.field}" ${columnType}${nullable ? '' : ' NOT NULL'}${defaultValue};`,
      rollback: `ALTER TABLE "${mismatch.model}" DROP COLUMN IF EXISTS "${mismatch.field}";`
    };
  }

  const columnDef = buildColumnDefinition(field);
  const sql = `ALTER TABLE "${mismatch.model}" ADD COLUMN "${mismatch.field}" ${columnDef};`;
  const rollback = `ALTER TABLE "${mismatch.model}" DROP COLUMN IF EXISTS "${mismatch.field}";`;

  // Add unique constraint if needed
  if (field.constraints?.includes('UNIQUE')) {
    return {
      sql: `${sql}\nCREATE UNIQUE INDEX "${mismatch.model}_${mismatch.field}_unique" ON "${mismatch.model}" ("${mismatch.field}");`,
      rollback: `${rollback}\nDROP INDEX IF EXISTS "${mismatch.model}_${mismatch.field}_unique";`
    };
  }

  return { sql, rollback };
}

/**
 * Generate ALTER COLUMN TYPE SQL
 */
function generateAlterColumnTypeSQL(mismatch: Mismatch): { sql: string; rollback?: string } {
  if (!mismatch.field) {
    return { sql: '', rollback: undefined };
  }

  const newType = mapTypeToPostgres(mismatch.codeValue || 'text');
  const oldType = mapTypeToPostgres(mismatch.dbValue || 'text');

  return {
    sql: `ALTER TABLE "${mismatch.model}" ALTER COLUMN "${mismatch.field}" TYPE ${newType} USING "${mismatch.field}"::${newType};`,
    rollback: `ALTER TABLE "${mismatch.model}" ALTER COLUMN "${mismatch.field}" TYPE ${oldType} USING "${mismatch.field}"::${oldType};`
  };
}

/**
 * Generate ALTER COLUMN CONSTRAINT SQL
 */
function generateAlterColumnConstraintSQL(mismatch: Mismatch): { sql: string; rollback?: string } {
  if (!mismatch.field) {
    return { sql: '', rollback: undefined };
  }

  const isNullable = mismatch.codeValue === 'nullable';
  const sql = isNullable
    ? `ALTER TABLE "${mismatch.model}" ALTER COLUMN "${mismatch.field}" DROP NOT NULL;`
    : `ALTER TABLE "${mismatch.model}" ALTER COLUMN "${mismatch.field}" SET NOT NULL;`;
  
  const rollback = !isNullable
    ? `ALTER TABLE "${mismatch.model}" ALTER COLUMN "${mismatch.field}" DROP NOT NULL;`
    : `ALTER TABLE "${mismatch.model}" ALTER COLUMN "${mismatch.field}" SET NOT NULL;`;

  return { sql, rollback };
}

/**
 * Generate DROP COLUMN SQL
 */
function generateDropColumnSQL(mismatch: Mismatch): { sql: string; rollback?: string } {
  if (!mismatch.field) {
    return { sql: '', rollback: undefined };
  }

  const columnType = mapTypeToPostgres(mismatch.dbValue || 'text');
  
  return {
    sql: `ALTER TABLE "${mismatch.model}" DROP COLUMN IF EXISTS "${mismatch.field}";`,
    rollback: `ALTER TABLE "${mismatch.model}" ADD COLUMN "${mismatch.field}" ${columnType};`
  };
}

/**
 * Build column definition from field
 */
function buildColumnDefinition(field: any): string {
  const columnType = mapTypeToPostgres(field.type);
  const nullable = field.nullable !== false ? '' : ' NOT NULL';
  const defaultVal = field.defaultValue 
    ? ` DEFAULT ${formatDefaultValue(field.defaultValue)}`
    : '';

  return `${columnType}${nullable}${defaultVal}`;
}

/**
 * Map Prisma/TypeScript types to PostgreSQL types
 */
function mapTypeToPostgres(type: string): string {
  if (!type) return 'text';

  const lower = type.toLowerCase().trim();
  
  // Remove array brackets
  const baseType = lower.replace(/\[\]$/, '').replace('[]', '');
  
  // Map common types
  const typeMap: Record<string, string> = {
    'string': 'TEXT',
    'text': 'TEXT',
    'varchar': 'TEXT',
    'int': 'INTEGER',
    'integer': 'INTEGER',
    'bigint': 'BIGINT',
    'float': 'DOUBLE PRECISION',
    'double': 'DOUBLE PRECISION',
    'decimal': 'DECIMAL',
    'numeric': 'NUMERIC',
    'boolean': 'BOOLEAN',
    'bool': 'BOOLEAN',
    'date': 'DATE',
    'datetime': 'TIMESTAMP',
    'timestamp': 'TIMESTAMP',
    'timestamptz': 'TIMESTAMP WITH TIME ZONE',
    'json': 'JSONB',
    'jsonb': 'JSONB',
    'bytes': 'BYTEA',
    'uuid': 'UUID'
  };

  // Check for length constraints (varchar(255))
  const match = baseType.match(/^(\w+)\((\d+)\)$/);
  if (match) {
    const [, mappedType, length] = match;
    const pgType = typeMap[mappedType] || mappedType.toUpperCase();
    if (pgType === 'TEXT' || pgType === 'VARCHAR') {
      return `VARCHAR(${length})`;
    }
    return pgType;
  }

  return typeMap[baseType] || baseType.toUpperCase();
}

/**
 * Format default value for SQL
 */
function formatDefaultValue(value: any): string {
  if (typeof value === 'string') {
    // Check if it's a function call
    if (value.includes('now()') || value.includes('uuid()')) {
      return value.toUpperCase();
    }
    // String literal
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  return `'${String(value)}'`;
}

/**
 * Extract default value from Prisma syntax
 */
function extractDefaultValue(prismaField: string): string {
  const match = prismaField.match(/@default\(([^)]+)\)/);
  return match ? match[1] : '';
}

/**
 * Generate migration ID
 */
function generateMigrationId(timestamp: Date): string {
  return timestamp.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
}

/**
 * Generate migration name
 */
function generateMigrationName(mismatches: Mismatch[], timestamp: Date): string {
  const dateStr = timestamp.toISOString().slice(0, 10).replace(/-/g, '_');
  
  const types = new Set(mismatches.map(m => m.type));
  const typeNames: Record<string, string> = {
    'missing_table': 'add_tables',
    'missing_field': 'add_columns',
    'type_mismatch': 'alter_types',
    'constraint_mismatch': 'alter_constraints',
    'extra_field': 'remove_columns'
  };
  
  const typeStr = Array.from(types)
    .map(t => typeNames[t] || t)
    .join('_');
  
  return `${dateStr}_${typeStr}`;
}

/**
 * Generate migration description
 */
function generateDescription(mismatches: Mismatch[]): string {
  const counts: Record<string, number> = {};
  
  for (const mismatch of mismatches) {
    counts[mismatch.type] = (counts[mismatch.type] || 0) + 1;
  }
  
  const parts: string[] = [];
  if (counts['missing_table']) parts.push(`${counts['missing_table']} table(s)`);
  if (counts['missing_field']) parts.push(`${counts['missing_field']} column(s)`);
  if (counts['type_mismatch']) parts.push(`${counts['type_mismatch']} type change(s)`);
  if (counts['constraint_mismatch']) parts.push(`${counts['constraint_mismatch']} constraint change(s)`);
  if (counts['extra_field']) parts.push(`${counts['extra_field']} column removal(s)`);
  
  return `Migration for ${parts.join(', ')}`;
}

