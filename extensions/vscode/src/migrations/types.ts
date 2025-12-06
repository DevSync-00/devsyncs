/**
 * Migration management types and interfaces.
 * 
 * Comprehensive type definitions for advanced migration management features.
 */

/**
 * Migration execution status.
 */
export type MigrationStatus = 
  | 'pending'
  | 'validating'
  | 'validated'
  | 'testing'
  | 'tested'
  | 'applying'
  | 'applied'
  | 'failed'
  | 'rolled_back';

/**
 * Migration operation type.
 */
export type MigrationOperation = 
  | 'create_table'
  | 'drop_table'
  | 'alter_table'
  | 'add_column'
  | 'drop_column'
  | 'alter_column'
  | 'add_index'
  | 'drop_index'
  | 'add_constraint'
  | 'drop_constraint'
  | 'add_foreign_key'
  | 'drop_foreign_key'
  | 'data_migration'
  | 'other';

/**
 * Migration risk level.
 */
export type MigrationRisk = 
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

/**
 * Migration dependency relationship.
 */
export interface MigrationDependency {
  /**
   * ID of the migration this depends on.
   */
  migrationId: string;
  
  /**
   * Type of dependency.
   */
  type: 'before' | 'after' | 'requires';
  
  /**
   * Reason for the dependency.
   */
  reason?: string;
}

/**
 * Migration validation result.
 */
export interface MigrationValidation {
  /**
   * Whether the migration is valid.
   */
  valid: boolean;
  
  /**
   * Validation errors.
   */
  errors: ValidationError[];
  
  /**
   * Validation warnings.
   */
  warnings: ValidationWarning[];
  
  /**
   * SQL syntax validation result.
   */
  sqlValid: boolean;
  
  /**
   * Database compatibility check.
   */
  compatible: boolean;
  
  /**
   * Estimated execution time (seconds).
   */
  estimatedTime: number;
  
  /**
   * Risk assessment.
   */
  risk: MigrationRisk;
  
  /**
   * Risk factors identified.
   */
  riskFactors: string[];
}

/**
 * Validation error.
 */
export interface ValidationError {
  /**
   * Error code.
   */
  code: string;
  
  /**
   * Error message.
   */
  message: string;
  
  /**
   * Line number in SQL (if applicable).
   */
  line?: number;
  
  /**
   * Column number (if applicable).
   */
  column?: number;
  
  /**
   * SQL snippet causing the error.
   */
  sqlSnippet?: string;
}

/**
 * Validation warning.
 */
export interface ValidationWarning {
  /**
   * Warning code.
   */
  code: string;
  
  /**
   * Warning message.
   */
  message: string;
  
  /**
   * Suggested fix.
   */
  suggestion?: string;
}

/**
 * Migration test result (dry-run).
 */
export interface MigrationTestResult {
  /**
   * Whether the test passed.
   */
  passed: boolean;
  
  /**
   * Test execution time (seconds).
   */
  executionTime: number;
  
  /**
   * Errors encountered during testing.
   */
  errors: string[];
  
  /**
   * Warnings encountered.
   */
  warnings: string[];
  
  /**
   * SQL that would be executed.
   */
  sqlToExecute: string;
  
  /**
   * Tables that would be affected.
   */
  affectedTables: string[];
  
  /**
   * Estimated row count affected.
   */
  estimatedRowsAffected?: number;
}

/**
 * Migration rollback information.
 */
export interface MigrationRollback {
  /**
   * Whether rollback is available.
   */
  available: boolean;
  
  /**
   * Rollback SQL.
   */
  rollbackSql?: string;
  
  /**
   * Whether rollback is safe (no data loss).
   */
  safe: boolean;
  
  /**
   * Rollback risks.
   */
  risks: string[];
  
  /**
   * Operations that cannot be rolled back.
   */
  irreversibleOperations: string[];
}

/**
 * Migration preview with diff.
 */
export interface MigrationPreview {
  /**
   * Migration ID.
   */
  migrationId: string;
  
  /**
   * Current schema state (before migration).
   */
  beforeState: SchemaState;
  
  /**
   * Expected schema state (after migration).
   */
  afterState: SchemaState;
  
  /**
   * Diff between before and after states.
   */
  diff: SchemaDiff;
  
  /**
   * Operations that will be performed.
   */
  operations: MigrationOperation[];
  
  /**
   * Affected tables.
   */
  affectedTables: string[];
  
  /**
   * Affected columns.
   */
  affectedColumns: string[];
  
  /**
   * Risk assessment.
   */
  risk: MigrationRisk;
  
  /**
   * Estimated execution time.
   */
  estimatedTime: number;
}

/**
 * Schema state snapshot.
 */
export interface SchemaState {
  /**
   * Tables in the schema.
   */
  tables: TableState[];
  
  /**
   * Indexes.
   */
  indexes: IndexState[];
  
  /**
   * Foreign keys.
   */
  foreignKeys: ForeignKeyState[];
  
  /**
   * Constraints.
   */
  constraints: ConstraintState[];
}

/**
 * Table state.
 */
export interface TableState {
  /**
   * Table name.
   */
  name: string;
  
  /**
   * Schema name.
   */
  schema?: string;
  
  /**
   * Columns.
   */
  columns: ColumnState[];
  
  /**
   * Primary key.
   */
  primaryKey?: string[];
  
  /**
   * Row count (if available).
   */
  rowCount?: number;
}

/**
 * Column state.
 */
export interface ColumnState {
  /**
   * Column name.
   */
  name: string;
  
  /**
   * Column type.
   */
  type: string;
  
  /**
   * Is nullable.
   */
  nullable: boolean;
  
  /**
   * Default value.
   */
  defaultValue?: string;
  
  /**
   * Is primary key.
   */
  isPrimaryKey?: boolean;
  
  /**
   * Is foreign key.
   */
  isForeignKey?: boolean;
}

/**
 * Index state.
 */
export interface IndexState {
  /**
   * Index name.
   */
  name: string;
  
  /**
   * Table name.
   */
  table: string;
  
  /**
   * Column names.
   */
  columns: string[];
  
  /**
   * Is unique.
   */
  unique: boolean;
}

/**
 * Foreign key state.
 */
export interface ForeignKeyState {
  /**
   * Constraint name.
   */
  name: string;
  
  /**
   * Source table.
   */
  sourceTable: string;
  
  /**
   * Source columns.
   */
  sourceColumns: string[];
  
  /**
   * Target table.
   */
  targetTable: string;
  
  /**
   * Target columns.
   */
  targetColumns: string[];
}

/**
 * Constraint state.
 */
export interface ConstraintState {
  /**
   * Constraint name.
   */
  name: string;
  
  /**
   * Table name.
   */
  table: string;
  
  /**
   * Constraint type.
   */
  type: 'check' | 'unique' | 'not_null' | 'default';
  
  /**
   * Constraint definition.
   */
  definition: string;
}

/**
 * Schema diff.
 */
export interface SchemaDiff {
  /**
   * Tables added.
   */
  tablesAdded: string[];
  
  /**
   * Tables removed.
   */
  tablesRemoved: string[];
  
  /**
   * Tables modified.
   */
  tablesModified: TableModification[];
  
  /**
   * Columns added.
   */
  columnsAdded: ColumnChange[];
  
  /**
   * Columns removed.
   */
  columnsRemoved: ColumnChange[];
  
  /**
   * Columns modified.
   */
  columnsModified: ColumnModification[];
  
  /**
   * Indexes added.
   */
  indexesAdded: IndexChange[];
  
  /**
   * Indexes removed.
   */
  indexesRemoved: IndexChange[];
  
  /**
   * Foreign keys added.
   */
  foreignKeysAdded: ForeignKeyChange[];
  
  /**
   * Foreign keys removed.
   */
  foreignKeysRemoved: ForeignKeyChange[];
}

/**
 * Table modification.
 */
export interface TableModification {
  /**
   * Table name.
   */
  table: string;
  
  /**
   * Changes made.
   */
  changes: string[];
}

/**
 * Column change.
 */
export interface ColumnChange {
  /**
   * Table name.
   */
  table: string;
  
  /**
   * Column name.
   */
  column: string;
  
  /**
   * Column type (for added columns).
   */
  type?: string;
}

/**
 * Column modification.
 */
export interface ColumnModification {
  /**
   * Table name.
   */
  table: string;
  
  /**
   * Column name.
   */
  column: string;
  
  /**
   * Changes made.
   */
  changes: {
    type?: { from: string; to: string };
    nullable?: { from: boolean; to: boolean };
    defaultValue?: { from?: string; to?: string };
  };
}

/**
 * Index change.
 */
export interface IndexChange {
  /**
   * Index name.
   */
  index: string;
  
  /**
   * Table name.
   */
  table: string;
  
  /**
   * Column names.
   */
  columns: string[];
}

/**
 * Foreign key change.
 */
export interface ForeignKeyChange {
  /**
   * Constraint name.
   */
  constraint: string;
  
  /**
   * Source table.
   */
  sourceTable: string;
  
  /**
   * Target table.
   */
  targetTable: string;
}

/**
 * Migration template.
 */
export interface MigrationTemplate {
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
  description: string;
  
  /**
   * Template category.
   */
  category: 'schema' | 'data' | 'index' | 'constraint' | 'custom';
  
  /**
   * Template SQL with placeholders.
   */
  sqlTemplate: string;
  
  /**
   * Placeholder definitions.
   */
  placeholders: TemplatePlaceholder[];
  
  /**
   * Example usage.
   */
  example?: string;
}

/**
 * Template placeholder.
 */
export interface TemplatePlaceholder {
  /**
   * Placeholder name (e.g., {{table_name}}).
   */
  name: string;
  
  /**
   * Placeholder description.
   */
  description: string;
  
  /**
   * Placeholder type.
   */
  type: 'string' | 'number' | 'boolean' | 'enum';
  
  /**
   * Whether the placeholder is required.
   */
  required: boolean;
  
  /**
   * Default value.
   */
  defaultValue?: string;
  
  /**
   * Enum values (if type is 'enum').
   */
  enumValues?: string[];
  
  /**
   * Validation pattern.
   */
  validation?: string;
}

/**
 * Batch migration configuration.
 */
export interface BatchMigrationConfig {
  /**
   * Migration IDs to include in the batch.
   */
  migrationIds: string[];
  
  /**
   * Execution order (if dependencies exist).
   */
  executionOrder: string[];
  
  /**
   * Whether to stop on first error.
   */
  stopOnError: boolean;
  
  /**
   * Whether to run in transaction.
   */
  transactional: boolean;
  
  /**
   * Rollback strategy.
   */
  rollbackStrategy: 'none' | 'all' | 'partial';
}

/**
 * Batch migration result.
 */
export interface BatchMigrationResult {
  /**
   * Total migrations in batch.
   */
  total: number;
  
  /**
   * Successfully applied migrations.
   */
  succeeded: number;
  
  /**
   * Failed migrations.
   */
  failed: number;
  
  /**
   * Results for each migration.
   */
  results: MigrationExecutionResult[];
  
  /**
   * Overall status.
   */
  status: 'success' | 'partial' | 'failed';
  
  /**
   * Total execution time (seconds).
   */
  executionTime: number;
}

/**
 * Migration execution result.
 */
export interface MigrationExecutionResult {
  /**
   * Migration ID.
   */
  migrationId: string;
  
  /**
   * Execution status.
   */
  status: MigrationStatus;
  
  /**
   * Execution time (seconds).
   */
  executionTime: number;
  
  /**
   * Error message (if failed).
   */
  error?: string;
  
  /**
   * Rows affected.
   */
  rowsAffected?: number;
}

/**
 * Migration history entry.
 */
export interface MigrationHistoryEntry {
  /**
   * History entry ID.
   */
  id: string;
  
  /**
   * Migration ID.
   */
  migrationId: string;
  
  /**
   * Execution type.
   */
  executionType: 'apply' | 'rollback' | 'test' | 'validate';
  
  /**
   * Execution status.
   */
  status: MigrationStatus;
  
  /**
   * Executed by (user ID).
   */
  executedBy?: string;
  
  /**
   * Execution timestamp.
   */
  executedAt: string;
  
  /**
   * Execution time (seconds).
   */
  executionTime: number;
  
  /**
   * SQL executed.
   */
  sqlExecuted: string;
  
  /**
   * Error message (if failed).
   */
  error?: string;
  
  /**
   * Rows affected.
   */
  rowsAffected?: number;
  
  /**
   * Environment.
   */
  environment?: string;
}

/**
 * Migration history visualization data.
 */
export interface MigrationHistoryVisualization {
  /**
   * Timeline of migrations.
   */
  timeline: MigrationTimelineEntry[];
  
  /**
   * Statistics.
   */
  statistics: MigrationStatistics;
  
  /**
   * Recent migrations.
   */
  recent: MigrationHistoryEntry[];
  
  /**
   * Failed migrations.
   */
  failed: MigrationHistoryEntry[];
}

/**
 * Migration timeline entry.
 */
export interface MigrationTimelineEntry {
  /**
   * Date/time.
   */
  date: string;
  
  /**
   * Migrations executed on this date.
   */
  migrations: MigrationHistoryEntry[];
  
  /**
   * Count of migrations.
   */
  count: number;
}

/**
 * Migration statistics.
 */
export interface MigrationStatistics {
  /**
   * Total migrations.
   */
  total: number;
  
  /**
   * Successful migrations.
   */
  successful: number;
  
  /**
   * Failed migrations.
   */
  failed: number;
  
  /**
   * Average execution time (seconds).
   */
  averageExecutionTime: number;
  
  /**
   * Total execution time (seconds).
   */
  totalExecutionTime: number;
  
  /**
   * Most common operations.
   */
  commonOperations: { operation: MigrationOperation; count: number }[];
  
  /**
   * Risk distribution.
   */
  riskDistribution: { risk: MigrationRisk; count: number }[];
}

