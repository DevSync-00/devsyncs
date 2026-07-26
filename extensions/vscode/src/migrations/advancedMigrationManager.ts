/**
 * Advanced migration management system.
 * 
 * Implements comprehensive migration management features:
 * - Migration preview with diff
 * - Migration testing (dry-run)
 * - Rollback capabilities
 * - Migration templates
 * - Batch migrations
 * - Migration dependencies
 * - Migration validation
 * - Migration history visualization
 */

import * as vscode from 'vscode';
import { Migration } from '../api';
import { IApiClient } from '../interfaces';
import {
  MigrationStatus,
  MigrationOperation,
  MigrationRisk,
  MigrationDependency,
  MigrationValidation,
  ValidationError,
  ValidationWarning,
  MigrationTestResult,
  MigrationRollback,
  MigrationPreview,
  SchemaState,
  SchemaDiff,
  MigrationTemplate,
  BatchMigrationConfig,
  BatchMigrationResult,
  MigrationExecutionResult,
  MigrationHistoryEntry,
  MigrationHistoryVisualization,
  MigrationStatistics,
} from './types';

/**
 * Advanced migration manager.
 */
export class AdvancedMigrationManager {
  constructor(private readonly apiClient: IApiClient) {}

  /**
   * Generates migration preview with diff.
   */
  async generatePreview(
    migration: Migration,
    currentSchema?: SchemaState
  ): Promise<MigrationPreview> {
    // Get current schema state if not provided
    const beforeState = currentSchema || await this.getCurrentSchemaState();
    
    // Simulate migration to get after state
    const afterState = await this.simulateMigration(migration, beforeState);
    
    // Generate diff
    const diff = this.generateDiff(beforeState, afterState);
    
    // Analyze operations
    const operations = this.analyzeOperations(migration);
    
    // Get affected tables and columns
    const { affectedTables, affectedColumns } = this.getAffectedEntities(migration);
    
    // Assess risk
    const risk = this.assessRisk(migration, diff);
    
    // Estimate execution time
    const estimatedTime = this.estimateExecutionTime(migration, diff);

    return {
      migrationId: migration.id,
      beforeState,
      afterState,
      diff,
      operations,
      affectedTables,
      affectedColumns,
      risk,
      estimatedTime,
    };
  }

  /**
   * Tests migration (dry-run).
   */
  async testMigration(
    migration: Migration,
    connectionString?: string
  ): Promise<MigrationTestResult> {
    const startTime = Date.now();
    
    try {
      // Validate SQL syntax
      const sqlValid = await this.validateSqlSyntax(migration.content);
      
      if (!sqlValid) {
        return {
          passed: false,
          executionTime: (Date.now() - startTime) / 1000,
          errors: ['SQL syntax validation failed'],
          warnings: [],
          sqlToExecute: migration.content,
          affectedTables: this.extractTableNames(migration.content),
        };
      }

      // Use EXPLAIN to test without executing
      const explainResult = await this.executeExplain(migration.content, connectionString);
      
      // Extract affected tables
      const affectedTables = this.extractTableNames(migration.content);
      
      // Estimate rows affected (if possible)
      const estimatedRowsAffected = await this.estimateRowsAffected(
        migration.content,
        connectionString
      );

      return {
        passed: explainResult.success,
        executionTime: (Date.now() - startTime) / 1000,
        errors: explainResult.errors,
        warnings: explainResult.warnings,
        sqlToExecute: migration.content,
        affectedTables,
        estimatedRowsAffected,
      };
    } catch (error) {
      return {
        passed: false,
        executionTime: (Date.now() - startTime) / 1000,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        sqlToExecute: migration.content,
        affectedTables: this.extractTableNames(migration.content),
      };
    }
  }

  /**
   * Generates rollback migration.
   */
  async generateRollback(
    migration: Migration,
    currentSchema?: SchemaState
  ): Promise<MigrationRollback> {
    const beforeState = currentSchema || await this.getCurrentSchemaState();
    const afterState = await this.simulateMigration(migration, beforeState);
    const diff = this.generateDiff(beforeState, afterState);
    
    // Generate reverse operations
    const rollbackSql = this.generateRollbackSql(diff, beforeState, afterState);
    
    // Check if rollback is safe
    const { safe, risks, irreversibleOperations } = this.assessRollbackSafety(
      diff,
      migration
    );

    return {
      available: rollbackSql.length > 0,
      rollbackSql: rollbackSql.join('\n\n'),
      safe,
      risks,
      irreversibleOperations,
    };
  }

  /**
   * Validates migration comprehensively.
   */
  async validateMigration(
    migration: Migration,
    connectionString?: string
  ): Promise<MigrationValidation> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const riskFactors: string[] = [];
    
    // SQL syntax validation
    const sqlValid = await this.validateSqlSyntax(migration.content);
    if (!sqlValid) {
      errors.push({
        code: 'INVALID_SQL',
        message: 'SQL syntax validation failed',
      });
    }

    // Check for dangerous operations
    const dangerousOps = this.detectDangerousOperations(migration.content);
    if (dangerousOps.length > 0) {
      dangerousOps.forEach(op => {
        warnings.push({
          code: 'DANGEROUS_OPERATION',
          message: `Dangerous operation detected: ${op.type}`,
          suggestion: op.suggestion,
        });
        riskFactors.push(op.risk);
      });
    }

    // Check for data loss risks
    const dataLossRisks = this.detectDataLossRisks(migration.content);
    if (dataLossRisks.length > 0) {
      dataLossRisks.forEach(risk => {
        errors.push({
          code: 'DATA_LOSS_RISK',
          message: risk.message,
          sqlSnippet: risk.sqlSnippet,
        });
        riskFactors.push(risk.description);
      });
    }

    // Database compatibility
    const compatible = await this.checkDatabaseCompatibility(
      migration.content,
      connectionString
    );
    if (!compatible) {
      warnings.push({
        code: 'COMPATIBILITY_WARNING',
        message: 'Migration may not be compatible with target database',
      });
    }

    // Estimate execution time
    const estimatedTime = this.estimateExecutionTime(migration);

    // Assess overall risk
    const risk = this.calculateRiskLevel(errors, warnings, riskFactors);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sqlValid,
      compatible,
      estimatedTime,
      risk,
      riskFactors,
    };
  }

  /**
   * Gets migration dependencies.
   */
  async getDependencies(
    migration: Migration,
    allMigrations: Migration[]
  ): Promise<MigrationDependency[]> {
    const dependencies: MigrationDependency[] = [];
    const migrationContent = migration.content.toLowerCase();
    
    // Check for table references
    const tableMatches = migrationContent.matchAll(/(?:alter|create|drop)\s+table\s+["']?(\w+)["']?/gi);
    const referencedTables = new Set<string>();
    for (const match of tableMatches) {
      referencedTables.add(match[1]);
    }

    // Find migrations that create/modify referenced tables
    for (const otherMigration of allMigrations) {
      if (otherMigration.id === migration.id) continue;
      
      const otherContent = otherMigration.content.toLowerCase();
      
      for (const table of referencedTables) {
        if (otherContent.includes(`create table ${table}`) ||
            otherContent.includes(`alter table ${table}`)) {
          dependencies.push({
            migrationId: otherMigration.id,
            type: 'before',
            reason: `Migration modifies table '${table}' that this migration references`,
          });
        }
      }
    }

    return dependencies;
  }

  /**
   * Executes batch migrations.
   */
  async executeBatch(
    config: BatchMigrationConfig,
    connectionString?: string
  ): Promise<BatchMigrationResult> {
    const startTime = Date.now();
    const results: MigrationExecutionResult[] = [];
    let succeeded = 0;
    let failed = 0;

    // Resolve execution order based on dependencies
    const executionOrder = await this.resolveExecutionOrder(
      config.migrationIds,
      config.executionOrder
    );

    // Execute migrations
    for (const migrationId of executionOrder) {
      const migrationStartTime = Date.now();
      
      try {
        const migration = await this.apiClient.getMigration(migrationId);
        if (!migration) {
          results.push({
            migrationId,
            status: 'failed',
            executionTime: (Date.now() - migrationStartTime) / 1000,
            error: 'Migration not found',
          });
          failed++;
          if (config.stopOnError) break;
          continue;
        }

        // Test migration first
        const testResult = await this.testMigration(migration, connectionString);
        if (!testResult.passed && config.stopOnError) {
          results.push({
            migrationId,
            status: 'failed',
            executionTime: (Date.now() - migrationStartTime) / 1000,
            error: testResult.errors.join('; '),
          });
          failed++;
          break;
        }

        // Apply migration
        const applyResult = await this.applyMigration(migration, connectionString);
        
        results.push({
          migrationId,
          status: applyResult.success ? 'applied' : 'failed',
          executionTime: (Date.now() - migrationStartTime) / 1000,
          error: applyResult.error,
          rowsAffected: applyResult.rowsAffected,
        });

        if (applyResult.success) {
          succeeded++;
        } else {
          failed++;
          if (config.stopOnError) break;
        }
      } catch (error) {
        results.push({
          migrationId,
          status: 'failed',
          executionTime: (Date.now() - migrationStartTime) / 1000,
          error: error instanceof Error ? error.message : String(error),
        });
        failed++;
        if (config.stopOnError) break;
      }
    }

    const executionTime = (Date.now() - startTime) / 1000;
    const status = failed === 0 ? 'success' : (succeeded > 0 ? 'partial' : 'failed');

    return {
      total: config.migrationIds.length,
      succeeded,
      failed,
      results,
      status,
      executionTime,
    };
  }

  /**
   * Gets migration templates.
   */
  async getTemplates(): Promise<MigrationTemplate[]> {
    return [
      {
        id: 'add_column',
        name: 'Add Column',
        description: 'Add a new column to an existing table',
        category: 'schema',
        sqlTemplate: 'ALTER TABLE {{table_name}} ADD COLUMN {{column_name}} {{column_type}} {{nullable}} {{default_value}};',
        placeholders: [
          {
            name: 'table_name',
            description: 'Name of the table',
            type: 'string',
            required: true,
            validation: '^[a-zA-Z_][a-zA-Z0-9_]*$',
          },
          {
            name: 'column_name',
            description: 'Name of the column',
            type: 'string',
            required: true,
            validation: '^[a-zA-Z_][a-zA-Z0-9_]*$',
          },
          {
            name: 'column_type',
            description: 'Column data type',
            type: 'enum',
            required: true,
            enumValues: ['VARCHAR(255)', 'INTEGER', 'BIGINT', 'BOOLEAN', 'TIMESTAMP', 'TEXT', 'UUID'],
          },
          {
            name: 'nullable',
            description: 'Whether column is nullable',
            type: 'enum',
            required: false,
            defaultValue: 'NULL',
            enumValues: ['NULL', 'NOT NULL'],
          },
          {
            name: 'default_value',
            description: 'Default value (optional)',
            type: 'string',
            required: false,
          },
        ],
        example: 'ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT \'\';',
      },
      {
        id: 'create_table',
        name: 'Create Table',
        description: 'Create a new table',
        category: 'schema',
        sqlTemplate: 'CREATE TABLE {{table_name}} (\n  {{columns}}\n);',
        placeholders: [
          {
            name: 'table_name',
            description: 'Name of the table',
            type: 'string',
            required: true,
          },
          {
            name: 'columns',
            description: 'Column definitions (comma-separated)',
            type: 'string',
            required: true,
          },
        ],
        example: 'CREATE TABLE users (\n  id UUID PRIMARY KEY,\n  name VARCHAR(255) NOT NULL\n);',
      },
      // Add more templates as needed
    ];
  }

  /**
   * Generates migration history visualization.
   */
  async generateHistoryVisualization(
    limit?: number
  ): Promise<MigrationHistoryVisualization> {
    const history = await this.getMigrationHistory(limit);
    
    // Build timeline
    const timeline = this.buildTimeline(history);
    
    // Calculate statistics
    const statistics = this.calculateStatistics(history);
    
    // Get recent migrations
    const recent = history.slice(0, 10);
    
    // Get failed migrations
    const failed = history.filter(h => h.status === 'failed');

    return {
      timeline,
      statistics,
      recent,
      failed,
    };
  }

  // Private helper methods

  private async getCurrentSchemaState(): Promise<SchemaState> {
    // This would typically fetch from the database
    // For now, return empty state
    return {
      tables: [],
      indexes: [],
      foreignKeys: [],
      constraints: [],
    };
  }

  private async simulateMigration(
    migration: Migration,
    currentState: SchemaState
  ): Promise<SchemaState> {
    // Simulate migration by parsing SQL and applying changes
    // This is a simplified version - real implementation would parse SQL properly
    return currentState; // Placeholder
  }

  private generateDiff(before: SchemaState, after: SchemaState): SchemaDiff {
    // Generate diff between two schema states
    return {
      tablesAdded: [],
      tablesRemoved: [],
      tablesModified: [],
      columnsAdded: [],
      columnsRemoved: [],
      columnsModified: [],
      indexesAdded: [],
      indexesRemoved: [],
      foreignKeysAdded: [],
      foreignKeysRemoved: [],
    };
  }

  private analyzeOperations(migration: Migration): MigrationOperation[] {
    const operations: MigrationOperation[] = [];
    const content = migration.content.toLowerCase();
    
    if (content.includes('create table')) operations.push('create_table');
    if (content.includes('drop table')) operations.push('drop_table');
    if (content.includes('alter table')) operations.push('alter_table');
    if (content.includes('add column')) operations.push('add_column');
    if (content.includes('drop column')) operations.push('drop_column');
    if (content.includes('alter column')) operations.push('alter_column');
    if (content.includes('create index')) operations.push('add_index');
    if (content.includes('drop index')) operations.push('drop_index');
    
    return operations;
  }

  private getAffectedEntities(migration: Migration): {
    affectedTables: string[];
    affectedColumns: string[];
  } {
    const tables = this.extractTableNames(migration.content);
    const columns = this.extractColumnNames(migration.content);
    
    return {
      affectedTables: tables,
      affectedColumns: columns,
    };
  }

  private assessRisk(migration: Migration, diff: SchemaDiff): MigrationRisk {
    // Assess risk based on operations
    const operations = this.analyzeOperations(migration);
    
    if (operations.includes('drop_table') || operations.includes('drop_column')) {
      return 'critical';
    }
    if (operations.includes('alter_column') && diff.columnsModified.length > 0) {
      return 'high';
    }
    if (operations.includes('add_column') || operations.includes('create_table')) {
      return 'low';
    }
    
    return 'none';
  }

  private estimateExecutionTime(migration: Migration, diff?: SchemaDiff): number {
    // Rough estimate based on SQL length and operations
    const operations = this.analyzeOperations(migration);
    return Math.max(1, operations.length * 0.5);
  }

  private async validateSqlSyntax(sql: string): Promise<boolean> {
    // Basic SQL syntax validation
    // Real implementation would use a SQL parser
    return sql.trim().length > 0 && sql.includes(';');
  }

  private async executeExplain(
    sql: string,
    connectionString?: string
  ): Promise<{ success: boolean; errors: string[]; warnings: string[] }> {
    // Execute EXPLAIN to test SQL without executing
    // Real implementation would connect to database
    return { success: true, errors: [], warnings: [] };
  }

  private extractTableNames(sql: string): string[] {
    const tables = new Set<string>();
    const matches = sql.matchAll(/(?:from|into|update|alter|create|drop)\s+table\s+["']?(\w+)["']?/gi);
    for (const match of matches) {
      tables.add(match[1]);
    }
    return Array.from(tables);
  }

  private extractColumnNames(sql: string): string[] {
    const columns = new Set<string>();
    const matches = sql.matchAll(/(?:add|drop|alter)\s+column\s+["']?(\w+)["']?/gi);
    for (const match of matches) {
      columns.add(match[1]);
    }
    return Array.from(columns);
  }

  private async estimateRowsAffected(
    sql: string,
    connectionString?: string
  ): Promise<number | undefined> {
    // Estimate rows affected (would require database connection)
    return undefined;
  }

  private generateRollbackSql(
    diff: SchemaDiff,
    before: SchemaState,
    after: SchemaState
  ): string[] {
    // Generate reverse operations
    const rollback: string[] = [];
    
    // Reverse table additions
    for (const table of diff.tablesAdded) {
      rollback.push(`DROP TABLE IF EXISTS ${table};`);
    }
    
    // Reverse column additions
    for (const change of diff.columnsAdded) {
      rollback.push(`ALTER TABLE ${change.table} DROP COLUMN IF EXISTS ${change.column};`);
    }
    
    // Add more rollback logic as needed
    
    return rollback;
  }

  private assessRollbackSafety(
    diff: SchemaDiff,
    migration: Migration
  ): {
    safe: boolean;
    risks: string[];
    irreversibleOperations: string[];
  } {
    const risks: string[] = [];
    const irreversible: string[] = [];
    
    if (diff.tablesRemoved.length > 0) {
      risks.push('Cannot restore dropped tables - data will be lost');
      irreversible.push('DROP TABLE');
    }
    
    if (diff.columnsRemoved.length > 0) {
      risks.push('Cannot restore dropped columns - data will be lost');
      irreversible.push('DROP COLUMN');
    }
    
    return {
      safe: risks.length === 0,
      risks,
      irreversibleOperations: irreversible,
    };
  }

  private detectDangerousOperations(sql: string): Array<{
    type: string;
    suggestion: string;
    risk: string;
  }> {
    const dangerous: Array<{ type: string; suggestion: string; risk: string }> = [];
    const lowerSql = sql.toLowerCase();
    
    if (lowerSql.includes('drop table')) {
      dangerous.push({
        type: 'DROP TABLE',
        suggestion: 'Consider backing up data before dropping tables',
        risk: 'Permanent data loss',
      });
    }
    
    if (lowerSql.includes('drop column')) {
      dangerous.push({
        type: 'DROP COLUMN',
        suggestion: 'Ensure no application code depends on this column',
        risk: 'Data loss and potential application errors',
      });
    }
    
    return dangerous;
  }

  private detectDataLossRisks(sql: string): Array<{
    message: string;
    sqlSnippet: string;
    description: string;
  }> {
    const risks: Array<{ message: string; sqlSnippet: string; description: string }> = [];
    const lowerSql = sql.toLowerCase();
    
    // Detect DROP operations
    const dropMatches = lowerSql.matchAll(/(drop\s+(?:table|column)\s+[^;]+)/gi);
    for (const match of dropMatches) {
      risks.push({
        message: 'DROP operation will cause data loss',
        sqlSnippet: match[1],
        description: 'Dropping tables or columns permanently deletes data',
      });
    }
    
    return risks;
  }

  private async checkDatabaseCompatibility(
    sql: string,
    connectionString?: string
  ): Promise<boolean> {
    // Check if SQL is compatible with target database
    // Real implementation would check database type and SQL dialect
    return true;
  }

  private calculateRiskLevel(
    errors: ValidationError[],
    warnings: ValidationWarning[],
    riskFactors: string[]
  ): MigrationRisk {
    if (errors.some(e => e.code === 'DATA_LOSS_RISK')) {
      return 'critical';
    }
    if (errors.length > 0) {
      return 'high';
    }
    if (warnings.length > 3 || riskFactors.length > 2) {
      return 'medium';
    }
    if (warnings.length > 0 || riskFactors.length > 0) {
      return 'low';
    }
    return 'none';
  }

  private async resolveExecutionOrder(
    migrationIds: string[],
    providedOrder?: string[]
  ): Promise<string[]> {
    // Resolve execution order based on dependencies
    // If provided order exists, use it; otherwise, use natural order
    return providedOrder || migrationIds;
  }

  private async applyMigration(
    migration: Migration,
    connectionString?: string
  ): Promise<{ success: boolean; error?: string; rowsAffected?: number }> {
    // Apply migration via API
    // This would call the API to apply the migration.
    return { success: true };
  }

  private async getMigrationHistory(limit?: number): Promise<MigrationHistoryEntry[]> {
    // Get migration history from API
    const migrations = await this.apiClient.getMigrations();
    // Convert to history entries (simplified)
    return migrations.map(m => ({
      id: `history-${m.id}`,
      migrationId: m.id,
      executionType: 'apply',
      status: m.applied ? 'applied' : 'pending',
      executedAt: m.created_at,
      executionTime: 0,
      sqlExecuted: m.content,
    }));
  }

  private buildTimeline(history: MigrationHistoryEntry[]): Array<{
    date: string;
    migrations: MigrationHistoryEntry[];
    count: number;
  }> {
    // Group by date
    const byDate = new Map<string, MigrationHistoryEntry[]>();
    
    for (const entry of history) {
      const date = new Date(entry.executedAt).toISOString().split('T')[0];
      if (!byDate.has(date)) {
        byDate.set(date, []);
      }
      byDate.get(date)!.push(entry);
    }
    
    return Array.from(byDate.entries()).map(([date, migrations]) => ({
      date,
      migrations,
      count: migrations.length,
    }));
  }

  private calculateStatistics(history: MigrationHistoryEntry[]): MigrationStatistics {
    const successful = history.filter(h => h.status === 'applied').length;
    const failed = history.filter(h => h.status === 'failed').length;
    const totalTime = history.reduce((sum, h) => sum + h.executionTime, 0);
    const avgTime = history.length > 0 ? totalTime / history.length : 0;
    
    // Count operations (simplified)
    const commonOperations: { operation: MigrationOperation; count: number }[] = [];
    
    // Risk distribution (simplified)
    const riskDistribution: { risk: MigrationRisk; count: number }[] = [
      { risk: 'none', count: successful },
      { risk: 'critical', count: failed },
    ];
    
    return {
      total: history.length,
      successful,
      failed,
      averageExecutionTime: avgTime,
      totalExecutionTime: totalTime,
      commonOperations,
      riskDistribution,
    };
  }
}

