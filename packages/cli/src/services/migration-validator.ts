/**
 * Migration Validator
 * 
 * Comprehensive validation of migration SQL before execution.
 * Validates syntax, schema state, and detects breaking changes.
 */

import { Pool } from 'pg';
import type { DatabaseTable } from '../types/index.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  breakingChanges: BreakingChange[];
  summary: {
    totalIssues: number;
    errorCount: number;
    warningCount: number;
    breakingChangeCount: number;
  };
}

export interface ValidationError {
  type: 'syntax' | 'schema' | 'semantic' | 'permission';
  severity: 'error';
  message: string;
  line?: number;
  column?: number;
  sql?: string;
  suggestion?: string;
}

export interface ValidationWarning {
  type: 'performance' | 'data_loss' | 'constraint' | 'compatibility';
  severity: 'warning';
  message: string;
  line?: number;
  sql?: string;
  suggestion?: string;
}

export interface BreakingChange {
  type: 'drop_table' | 'drop_column' | 'drop_constraint' | 'type_narrowing' | 'not_null_add' | 'truncate';
  severity: 'error' | 'warning';
  message: string;
  affectedTable?: string;
  affectedColumn?: string;
  line?: number;
  sql?: string;
  impact?: string;
  mitigation?: string;
}

export interface ValidationOptions {
  connectionString: string;
  currentSchema?: DatabaseTable[];
  strictMode?: boolean; // If true, warnings are treated as errors
  checkPermissions?: boolean;
  checkBreakingChanges?: boolean;
}

/**
 * Validates migration SQL comprehensively.
 */
export async function validateMigration(
  sql: string,
  options: ValidationOptions
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const breakingChanges: BreakingChange[] = [];

  // Step 1: SQL Syntax Validation
  const syntaxResult = await validateSQLSyntax(sql, options.connectionString);
  errors.push(...syntaxResult.errors);
  warnings.push(...syntaxResult.warnings);

  // Step 2: Schema State Validation (if current schema provided)
  if (options.currentSchema && options.currentSchema.length > 0) {
    const schemaResult = validateSchemaState(sql, options.currentSchema);
    errors.push(...schemaResult.errors);
    warnings.push(...schemaResult.warnings);
  }

  // Step 3: Breaking Change Detection
  if (options.checkBreakingChanges !== false) {
    const breakingResult = detectBreakingChanges(sql, options.currentSchema);
    breakingChanges.push(...breakingResult);
    
    // Add breaking changes as errors or warnings based on severity
    breakingResult.forEach(change => {
      if (change.severity === 'error') {
        errors.push({
          type: 'semantic',
          severity: 'error',
          message: change.message,
          line: change.line,
          sql: change.sql,
          suggestion: change.mitigation
        });
      } else {
        warnings.push({
          type: 'data_loss',
          severity: 'warning',
          message: change.message,
          line: change.line,
          sql: change.sql,
          suggestion: change.mitigation
        });
      }
    });
  }

  // Step 4: Permission Validation (if enabled)
  if (options.checkPermissions) {
    const permissionResult = await validatePermissions(sql, options.connectionString);
    errors.push(...permissionResult.errors);
    warnings.push(...permissionResult.warnings);
  }

  // Apply strict mode if enabled
  if (options.strictMode) {
    errors.push(...warnings.map(w => ({
      type: 'semantic' as const,
      severity: 'error' as const,
      message: w.message,
      line: w.line,
      sql: w.sql,
      suggestion: w.suggestion
    })));
    warnings.length = 0;
  }

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    warnings,
    breakingChanges,
    summary: {
      totalIssues: errors.length + warnings.length + breakingChanges.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      breakingChangeCount: breakingChanges.length
    }
  };
}

/**
 * Validates SQL syntax using PostgreSQL EXPLAIN.
 */
async function validateSQLSyntax(
  sql: string,
  connectionString: string
): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    
    try {
      // Split SQL into statements
      const statements = parseSQLStatements(sql);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        const line = getLineNumber(sql, statement.startIndex);
        
        // Skip comments and transaction commands
        if (isCommentOrTransaction(statement.sql)) {
          continue;
        }

        // Try to explain the statement (validates syntax without executing)
        try {
          await client.query(`EXPLAIN ${statement.sql}`);
        } catch (explainError: any) {
          // Parse error message for better context
          const errorMessage = explainError.message || 'Unknown syntax error';
          const columnMatch = errorMessage.match(/position (\d+)/);
          const column = columnMatch ? parseInt(columnMatch[1]) : undefined;
          
          errors.push({
            type: 'syntax',
            severity: 'error',
            message: `SQL syntax error: ${errorMessage}`,
            line,
            column,
            sql: statement.sql,
            suggestion: getSyntaxSuggestion(errorMessage)
          });
        }
      }
    } finally {
      client.release();
    }
  } catch (error: any) {
    errors.push({
      type: 'syntax',
      severity: 'error',
      message: `Failed to validate SQL syntax: ${error.message}`,
      suggestion: 'Check database connection and SQL format'
    });
  } finally {
    await pool.end();
  }

  return { errors, warnings };
}

/**
 * Validates migration against current schema state.
 */
function validateSchemaState(
  sql: string,
  currentSchema: DatabaseTable[]
): { errors: ValidationError[]; warnings: ValidationWarning[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  const statements = parseSQLStatements(sql);
  const schemaMap = new Map<string, DatabaseTable>();
  currentSchema.forEach(table => {
    schemaMap.set(table.name.toLowerCase(), table);
  });

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const line = getLineNumber(sql, statement.startIndex);
    
    if (isCommentOrTransaction(statement.sql)) {
      continue;
    }

    const upperSQL = statement.sql.toUpperCase().trim();

    // Check for ALTER TABLE on non-existent table
    if (upperSQL.startsWith('ALTER TABLE')) {
      const tableMatch = statement.sql.match(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/i);
      if (tableMatch) {
        const tableName = tableMatch[1].toLowerCase();
        if (!schemaMap.has(tableName)) {
          errors.push({
            type: 'schema',
            severity: 'error',
            message: `Table "${tableMatch[1]}" does not exist in current schema`,
            line,
            sql: statement.sql,
            suggestion: `Create the table first or use IF EXISTS clause`
          });
        }
      }
    }

    // Check for DROP TABLE on non-existent table
    if (upperSQL.startsWith('DROP TABLE')) {
      const tableMatch = statement.sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["']?(\w+)["']?/i);
      if (tableMatch && !statement.sql.toUpperCase().includes('IF EXISTS')) {
        const tableName = tableMatch[1].toLowerCase();
        if (!schemaMap.has(tableName)) {
          warnings.push({
            type: 'data_loss',
            severity: 'warning',
            message: `Attempting to drop table "${tableMatch[1]}" that may not exist`,
            line,
            sql: statement.sql,
            suggestion: 'Use DROP TABLE IF EXISTS to avoid errors'
          });
        }
      }
    }

    // Check for ALTER TABLE ... DROP COLUMN
    if (upperSQL.includes('DROP COLUMN')) {
      const columnMatch = statement.sql.match(/ALTER\s+TABLE\s+["']?(\w+)["']?\s+DROP\s+COLUMN\s+["']?(\w+)["']?/i);
      if (columnMatch) {
        const [, tableName, columnName] = columnMatch;
        const table = schemaMap.get(tableName.toLowerCase());
        if (table) {
          const column = table.columns.find(c => c.name.toLowerCase() === columnName.toLowerCase());
          if (!column) {
            warnings.push({
              type: 'data_loss',
              severity: 'warning',
              message: `Column "${columnName}" does not exist in table "${tableName}"`,
              line,
              sql: statement.sql,
              suggestion: 'Use DROP COLUMN IF EXISTS to avoid errors'
            });
          }
        }
      }
    }

    // Check for ALTER TABLE ... ADD COLUMN on existing column
    if (upperSQL.includes('ADD COLUMN')) {
      const columnMatch = statement.sql.match(/ALTER\s+TABLE\s+["']?(\w+)["']?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/i);
      if (columnMatch) {
        const [, tableName, columnName] = columnMatch;
        const table = schemaMap.get(tableName.toLowerCase());
        if (table) {
          const column = table.columns.find(c => c.name.toLowerCase() === columnName.toLowerCase());
          if (column && !statement.sql.toUpperCase().includes('IF NOT EXISTS')) {
            errors.push({
              type: 'schema',
              severity: 'error',
              message: `Column "${columnName}" already exists in table "${tableName}"`,
              line,
              sql: statement.sql,
              suggestion: 'Use ADD COLUMN IF NOT EXISTS or ALTER COLUMN instead'
            });
          }
        }
      }
    }

    // Check for CREATE TABLE on existing table
    if (upperSQL.startsWith('CREATE TABLE')) {
      const tableMatch = statement.sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?/i);
      if (tableMatch && !statement.sql.toUpperCase().includes('IF NOT EXISTS')) {
        const tableName = tableMatch[1].toLowerCase();
        if (schemaMap.has(tableName)) {
          errors.push({
            type: 'schema',
            severity: 'error',
            message: `Table "${tableMatch[1]}" already exists`,
            line,
            sql: statement.sql,
            suggestion: 'Use CREATE TABLE IF NOT EXISTS or DROP TABLE first'
          });
        }
      }
    }
  }

  return { errors, warnings };
}

/**
 * Detects breaking changes in migration SQL.
 */
function detectBreakingChanges(
  sql: string,
  currentSchema?: DatabaseTable[]
): BreakingChange[] {
  const breakingChanges: BreakingChange[] = [];
  const statements = parseSQLStatements(sql);
  
  const schemaMap = currentSchema 
    ? new Map(currentSchema.map(t => [t.name.toLowerCase(), t]))
    : new Map<string, DatabaseTable>();

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const line = getLineNumber(sql, statement.startIndex);
    const upperSQL = statement.sql.toUpperCase().trim();

    if (isCommentOrTransaction(statement.sql)) {
      continue;
    }

    // DROP TABLE
    if (upperSQL.startsWith('DROP TABLE') && !upperSQL.includes('IF EXISTS')) {
      const tableMatch = statement.sql.match(/DROP\s+TABLE\s+["']?(\w+)["']?/i);
      if (tableMatch) {
        breakingChanges.push({
          type: 'drop_table',
          severity: 'error',
          message: `Dropping table "${tableMatch[1]}" will permanently delete all data`,
          affectedTable: tableMatch[1],
          line,
          sql: statement.sql,
          impact: 'All data in the table will be lost. This cannot be undone.',
          mitigation: 'Backup the table data before dropping, or use a soft delete pattern'
        });
      }
    }

    // DROP COLUMN
    if (upperSQL.includes('DROP COLUMN')) {
      const columnMatch = statement.sql.match(/ALTER\s+TABLE\s+["']?(\w+)["']?\s+DROP\s+COLUMN\s+["']?(\w+)["']?/i);
      if (columnMatch) {
        breakingChanges.push({
          type: 'drop_column',
          severity: 'error',
          message: `Dropping column "${columnMatch[2]}" from "${columnMatch[1]}" will permanently delete all data in that column`,
          affectedTable: columnMatch[1],
          affectedColumn: columnMatch[2],
          line,
          sql: statement.sql,
          impact: 'All data in the column will be lost. This cannot be undone.',
          mitigation: 'Backup the column data or migrate data to another column before dropping'
        });
      }
    }

    // TRUNCATE
    if (upperSQL.startsWith('TRUNCATE')) {
      const tableMatch = statement.sql.match(/TRUNCATE\s+(?:TABLE\s+)?["']?(\w+)["']?/i);
      if (tableMatch) {
        breakingChanges.push({
          type: 'truncate',
          severity: 'error',
          message: `TRUNCATE on table "${tableMatch[1]}" will delete all rows`,
          affectedTable: tableMatch[1],
          line,
          sql: statement.sql,
          impact: 'All rows in the table will be deleted. This cannot be undone.',
          mitigation: 'Use DELETE with WHERE clause for selective deletion, or backup data first'
        });
      }
    }

    // Type narrowing (e.g., VARCHAR(100) -> VARCHAR(50))
    if (upperSQL.includes('ALTER COLUMN') && upperSQL.includes('TYPE')) {
      const typeMatch = statement.sql.match(/ALTER\s+TABLE\s+["']?(\w+)["']?\s+ALTER\s+COLUMN\s+["']?(\w+)["']?\s+TYPE\s+(\w+)/i);
      if (typeMatch) {
        const [, tableName, columnName, newType] = typeMatch;
        const table = schemaMap.get(tableName.toLowerCase());
        if (table) {
          const column = table.columns.find(c => c.name.toLowerCase() === columnName.toLowerCase());
          if (column) {
            const oldType = column.type.toLowerCase();
            const newTypeLower = newType.toLowerCase();
            
            // Check for type narrowing
            if (isTypeNarrowing(oldType, newTypeLower)) {
              breakingChanges.push({
                type: 'type_narrowing',
                severity: 'error',
                message: `Type change from ${oldType} to ${newTypeLower} may cause data loss or truncation`,
                affectedTable: tableName,
                affectedColumn: columnName,
                line,
                sql: statement.sql,
                impact: 'Data that doesn\'t fit the new type will be lost or truncated',
                mitigation: 'Migrate data to compatible types first, or use a multi-step migration'
              });
            }
          }
        }
      }
    }

    // Adding NOT NULL constraint to existing nullable column
    if (upperSQL.includes('ALTER COLUMN') && upperSQL.includes('SET NOT NULL')) {
      const columnMatch = statement.sql.match(/ALTER\s+TABLE\s+["']?(\w+)["']?\s+ALTER\s+COLUMN\s+["']?(\w+)["']?\s+SET\s+NOT\s+NULL/i);
      if (columnMatch) {
        const [, tableName, columnName] = columnMatch;
        const table = schemaMap.get(tableName.toLowerCase());
        if (table) {
          const column = table.columns.find(c => c.name.toLowerCase() === columnName.toLowerCase());
          if (column && column.nullable) {
            breakingChanges.push({
              type: 'not_null_add',
              severity: 'error',
              message: `Adding NOT NULL constraint to nullable column "${columnName}" in "${tableName}" may fail if NULL values exist`,
              affectedTable: tableName,
              affectedColumn: columnName,
              line,
              sql: statement.sql,
              impact: 'Migration will fail if any rows have NULL values in this column',
              mitigation: 'Update all NULL values to a default value before adding the constraint'
            });
          }
        }
      }
    }

    // DROP CONSTRAINT
    if (upperSQL.includes('DROP CONSTRAINT')) {
      const constraintMatch = statement.sql.match(/ALTER\s+TABLE\s+["']?(\w+)["']?\s+DROP\s+CONSTRAINT\s+["']?(\w+)["']?/i);
      if (constraintMatch) {
        breakingChanges.push({
          type: 'drop_constraint',
          severity: 'warning',
          message: `Dropping constraint "${constraintMatch[2]}" from "${constraintMatch[1]}" may allow invalid data`,
          affectedTable: constraintMatch[1],
          line,
          sql: statement.sql,
          impact: 'Data integrity may be compromised',
          mitigation: 'Ensure application-level validation or add replacement constraint'
        });
      }
    }
  }

  return breakingChanges;
}

/**
 * Validates database permissions for migration operations.
 */
async function validatePermissions(
  sql: string,
  connectionString: string
): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const pool = new Pool({ connectionString });

  try {
    const client = await pool.connect();
    
    try {
      // Check if user has CREATE privilege
      const createMatch = sql.match(/CREATE\s+(?:TABLE|INDEX|SEQUENCE)/i);
      if (createMatch) {
        const result = await client.query(`
          SELECT has_database_privilege(current_user, current_database(), 'CREATE') as can_create
        `);
        if (!result.rows[0]?.can_create) {
          errors.push({
            type: 'permission',
            severity: 'error',
            message: 'User does not have CREATE privilege on database',
            suggestion: 'Grant CREATE privilege to the database user'
          });
        }
      }

      // Check if user has ALTER privilege
      const alterMatch = sql.match(/ALTER\s+TABLE/i);
      if (alterMatch) {
        const result = await client.query(`
          SELECT has_table_privilege(current_user, 'information_schema.tables', 'SELECT') as can_alter
        `);
        // This is a simplified check - in production, check actual table privileges
        warnings.push({
          type: 'compatibility',
          severity: 'warning',
          message: 'Verify user has ALTER privilege on target tables',
          suggestion: 'Test migration in a development environment first'
        });
      }
    } finally {
      client.release();
    }
  } catch (error: any) {
    warnings.push({
      type: 'compatibility',
      severity: 'warning',
      message: `Could not verify permissions: ${error.message}`,
      suggestion: 'Ensure database user has necessary privileges'
    });
  } finally {
    await pool.end();
  }

  return { errors, warnings };
}

/**
 * Helper: Parse SQL into statements.
 */
interface SQLStatement {
  sql: string;
  startIndex: number;
}

function parseSQLStatements(sql: string): SQLStatement[] {
  const statements: SQLStatement[] = [];
  let currentStatement = '';
  let startIndex = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    // Handle comments
    if (!inString && char === '-' && nextChar === '-') {
      inComment = true;
      currentStatement += char;
      continue;
    }
    if (inComment && char === '\n') {
      inComment = false;
      currentStatement += char;
      continue;
    }
    if (inComment) {
      currentStatement += char;
      continue;
    }

    // Handle string literals
    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      currentStatement += char;
      continue;
    }
    if (inString && char === stringChar && sql[i - 1] !== '\\') {
      inString = false;
      stringChar = '';
      currentStatement += char;
      continue;
    }
    if (inString) {
      currentStatement += char;
      continue;
    }

    // Handle statement termination
    if (char === ';') {
      currentStatement += char;
      const trimmed = currentStatement.trim();
      if (trimmed.length > 0) {
        statements.push({
          sql: trimmed,
          startIndex
        });
      }
      currentStatement = '';
      startIndex = i + 1;
      continue;
    }

    currentStatement += char;
  }

  // Add final statement if exists
  const trimmed = currentStatement.trim();
  if (trimmed.length > 0) {
    statements.push({
      sql: trimmed,
      startIndex
    });
  }

  return statements;
}

/**
 * Helper: Check if statement is comment or transaction command.
 */
function isCommentOrTransaction(sql: string): boolean {
  const trimmed = sql.trim().toUpperCase();
  return (
    trimmed.startsWith('--') ||
    trimmed.startsWith('/*') ||
    trimmed === 'BEGIN' ||
    trimmed === 'COMMIT' ||
    trimmed === 'ROLLBACK' ||
    trimmed.length === 0
  );
}

/**
 * Helper: Get line number from index.
 */
function getLineNumber(sql: string, index: number): number {
  return sql.substring(0, index).split('\n').length;
}

/**
 * Helper: Check if type change is narrowing.
 */
function isTypeNarrowing(oldType: string, newType: string): boolean {
  // VARCHAR length narrowing
  const varcharOld = oldType.match(/varchar\((\d+)\)/i);
  const varcharNew = newType.match(/varchar\((\d+)\)/i);
  if (varcharOld && varcharNew) {
    return parseInt(varcharNew[1]) < parseInt(varcharOld[1]);
  }

  // TEXT to VARCHAR is narrowing
  if (oldType === 'text' && newType.includes('varchar')) {
    return true;
  }

  // INTEGER to SMALLINT is narrowing
  if (oldType.includes('int') && newType.includes('smallint')) {
    return true;
  }

  // NUMERIC precision narrowing
  const numericOld = oldType.match(/numeric\((\d+),(\d+)\)/i);
  const numericNew = newType.match(/numeric\((\d+),(\d+)\)/i);
  if (numericOld && numericNew) {
    return parseInt(numericNew[1]) < parseInt(numericOld[1]);
  }

  return false;
}

/**
 * Helper: Get syntax error suggestion.
 */
function getSyntaxSuggestion(errorMessage: string): string | undefined {
  const lower = errorMessage.toLowerCase();
  
  if (lower.includes('syntax error')) {
    return 'Check SQL syntax against PostgreSQL documentation';
  }
  if (lower.includes('unterminated')) {
    return 'Check for missing quotes or parentheses';
  }
  if (lower.includes('unexpected')) {
    return 'Check for typos or invalid keywords';
  }
  if (lower.includes('missing')) {
    return 'Check for missing required clauses or keywords';
  }
  
  return undefined;
}

