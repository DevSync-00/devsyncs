/**
 * PostgreSQL database schema parser.
 * 
 * Parses PostgreSQL schemas including advanced features like:
 * - Schemas (namespaces)
 * - Enums
 * - Arrays
 * - JSON/JSONB
 * - Custom types
 * - Materialized views
 * - Functions
 * - Triggers
 */

import { IDatabaseParser } from '../parser';
import { DatabaseType, DatabaseConnection, DatabaseCapabilities } from '../types';
import { DatabaseSchema, Table, Column, ColumnType, TypeCategory, Index, ForeignKey, Trigger, View, Enum, Function } from '../../schema/types';
// Optional dependency - install with: npm install pg
// @ts-ignore - Optional dependency
import * as pg from 'pg';

/**
 * PostgreSQL database parser.
 */
export class PostgreSQLParser implements IDatabaseParser {
  readonly databaseType = DatabaseType.PostgreSQL;
  
  /**
   * PostgreSQL capabilities.
   */
  static readonly capabilities: DatabaseCapabilities = {
    supportsSchemas: true,
    supportsTransactions: true,
    supportsForeignKeys: true,
    supportsIndexes: true,
    supportsViews: true,
    supportsStoredProcedures: true,
    supportsTriggers: true,
    supportsEnums: true,
    supportsJson: true,
    supportsArrays: true,
    supportsFullTextSearch: true,
    maxIdentifierLength: 63,
    caseSensitiveIdentifiers: false,
  };
  
  async parseFromConnection(connection: DatabaseConnection): Promise<DatabaseSchema> {
    const client = new pg.Client({
      connectionString: connection.connectionString,
      ...connection.options,
    });
    
    try {
      await client.connect();
      
      const schema = await this.parseSchema(client, connection.options?.schema || 'public');
      
      return schema;
    } finally {
      await client.end();
    }
  }
  
  async parseFromSQL(sql: string): Promise<DatabaseSchema> {
    // Parse SQL DDL statements
    // This is a simplified version - full implementation would use a SQL parser
    throw new Error('SQL parsing not yet implemented for PostgreSQL');
  }
  
  async parseFromConnectionString(connectionString: string): Promise<DatabaseSchema> {
    return this.parseFromConnection({
      type: DatabaseType.PostgreSQL,
      connectionString,
    });
  }
  
  validateConnectionString(connectionString: string): boolean {
    return connectionString.startsWith('postgresql://') || 
           connectionString.startsWith('postgres://');
  }
  
  /**
   * Parse schema from PostgreSQL connection.
   */
  private async parseSchema(client: pg.Client, schemaName: string): Promise<DatabaseSchema> {
    const tables = await this.parseTables(client, schemaName);
    const views = await this.parseViews(client, schemaName);
    const enums = await this.parseEnums(client, schemaName);
    const functions = await this.parseFunctions(client, schemaName);
    const triggers = await this.parseTriggers(client, schemaName);
    
    return {
      databaseType: DatabaseType.PostgreSQL,
      schemaName,
      tables,
      views,
      enums,
      functions,
      triggers,
    };
  }
  
  /**
   * Parse tables from PostgreSQL.
   */
  private async parseTables(client: pg.Client, schemaName: string): Promise<Table[]> {
    const query = `
      SELECT 
        t.table_name,
        obj_description(c.oid, 'pg_class') as comment
      FROM information_schema.tables t
      JOIN pg_class c ON c.relname = t.table_name
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = $1
      WHERE t.table_schema = $1
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name;
    `;
    
    const result = await client.query(query, [schemaName]);
    const tables: Table[] = [];
    
    for (const row of result.rows) {
      const tableName = row.table_name;
      const columns = await this.parseColumns(client, schemaName, tableName);
      const primaryKey = await this.parsePrimaryKey(client, schemaName, tableName);
      const foreignKeys = await this.parseForeignKeys(client, schemaName, tableName);
      const indexes = await this.parseIndexes(client, schemaName, tableName);
      const uniqueConstraints = await this.parseUniqueConstraints(client, schemaName, tableName);
      const checkConstraints = await this.parseCheckConstraints(client, schemaName, tableName);
      
      tables.push({
        name: tableName,
        schema: schemaName,
        columns,
        primaryKey,
        foreignKeys,
        indexes,
        uniqueConstraints,
        checkConstraints,
        comment: row.comment || undefined,
      });
    }
    
    return tables;
  }
  
  /**
   * Parse columns from PostgreSQL table.
   */
  private async parseColumns(client: pg.Client, schemaName: string, tableName: string): Promise<Column[]> {
    const query = `
      SELECT 
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.ordinal_position,
        col_description(pgc.oid, c.ordinal_position) as comment,
        CASE WHEN c.identity_generation IS NOT NULL THEN true ELSE false END as is_identity,
        CASE WHEN c.is_generated = 'ALWAYS' THEN true ELSE false END as is_generated
      FROM information_schema.columns c
      JOIN pg_class pgc ON pgc.relname = c.table_name
      JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace AND pgn.nspname = $1
      WHERE c.table_schema = $1
        AND c.table_name = $2
      ORDER BY c.ordinal_position;
    `;
    
    const result = await client.query(query, [schemaName, tableName]);
    const columns: Column[] = [];
    
    for (const row of result.rows) {
      const type = this.parseColumnType(row.data_type, row.udt_name);
      
      columns.push({
        name: row.column_name,
        type,
        nullable: row.is_nullable === 'YES',
        defaultValue: row.column_default || undefined,
        autoIncrement: row.is_identity || false,
        comment: row.comment || undefined,
        position: parseInt(row.ordinal_position),
        length: row.character_maximum_length ? parseInt(row.character_maximum_length) : undefined,
        precision: row.numeric_precision ? parseInt(row.numeric_precision) : undefined,
        scale: row.numeric_scale ? parseInt(row.numeric_scale) : undefined,
        generated: row.is_generated || false,
      });
    }
    
    return columns;
  }
  
  /**
   * Parse PostgreSQL column type.
   */
  private parseColumnType(dataType: string, udtName: string): ColumnType {
    const lower = udtName.toLowerCase();
    let category: TypeCategory;
    let name: string;
    let isArray = false;
    let isJson = false;
    
    // Check for array type
    if (lower.endsWith('[]') || lower.includes('_array')) {
      isArray = true;
      const baseType = lower.replace('[]', '').replace('_array', '');
      return this.parseColumnType(dataType, baseType);
    }
    
    // Check for JSON types
    if (lower === 'json' || lower === 'jsonb') {
      isJson = true;
      category = TypeCategory.Json;
      name = lower === 'jsonb' ? 'jsonb' : 'json';
    }
    // String types
    else if (['varchar', 'char', 'text', 'bpchar'].includes(lower)) {
      category = TypeCategory.String;
      name = lower === 'text' ? 'text' : lower === 'bpchar' ? 'char' : 'varchar';
    }
    // Integer types
    else if (['int2', 'int4', 'int8', 'smallint', 'integer', 'bigint'].includes(lower)) {
      category = TypeCategory.Integer;
      name = lower === 'int2' ? 'smallint' : lower === 'int4' ? 'integer' : lower === 'int8' ? 'bigint' : lower;
    }
    // Decimal types
    else if (['numeric', 'decimal', 'money'].includes(lower)) {
      category = TypeCategory.Decimal;
      name = lower;
    }
    // Float types
    else if (['real', 'double precision', 'float4', 'float8'].includes(lower)) {
      category = TypeCategory.Float;
      name = lower === 'float4' ? 'real' : lower === 'float8' ? 'double precision' : lower;
    }
    // Boolean
    else if (lower === 'bool' || lower === 'boolean') {
      category = TypeCategory.Boolean;
      name = 'boolean';
    }
    // Date/Time types
    else if (['date'].includes(lower)) {
      category = TypeCategory.Date;
      name = 'date';
    }
    else if (['timestamp', 'timestamptz', 'timestamp without time zone', 'timestamp with time zone'].includes(lower)) {
      category = TypeCategory.DateTime;
      name = lower.includes('tz') ? 'timestamptz' : 'timestamp';
    }
    else if (['time', 'timetz', 'time without time zone', 'time with time zone'].includes(lower)) {
      category = TypeCategory.Time;
      name = lower.includes('tz') ? 'timetz' : 'time';
    }
    // UUID
    else if (lower === 'uuid') {
      category = TypeCategory.UUID;
      name = 'uuid';
    }
    // Binary types
    else if (['bytea'].includes(lower)) {
      category = TypeCategory.Binary;
      name = 'bytea';
    }
    // Enum (check if it's a custom enum)
    else {
      // Check if it's a custom enum type
      category = TypeCategory.Other;
      name = udtName;
    }
    
    return {
      name,
      originalName: udtName,
      category,
      isArray,
      isJson,
    };
  }
  
  /**
   * Parse primary key constraint.
   */
  private async parsePrimaryKey(client: pg.Client, schemaName: string, tableName: string): Promise<{ columns: string[]; name?: string } | undefined> {
    const query = `
      SELECT 
        kcu.column_name,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
      ORDER BY kcu.ordinal_position;
    `;
    
    const result = await client.query(query, [schemaName, tableName]);
    
    if (result.rows.length === 0) {
      return undefined;
    }
    
    return {
      columns: result.rows.map((r: any) => r.column_name),
      name: result.rows[0].constraint_name,
    };
  }
  
  /**
   * Parse foreign key constraints.
   */
  private async parseForeignKeys(client: pg.Client, schemaName: string, tableName: string): Promise<ForeignKey[]> {
    const query = `
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
      ORDER BY kcu.ordinal_position;
    `;
    
    const result = await client.query(query, [schemaName, tableName]);
    const foreignKeys: Map<string, ForeignKey> = new Map();
    
    for (const row of result.rows) {
      const constraintName = row.constraint_name;
      
      if (!foreignKeys.has(constraintName)) {
        foreignKeys.set(constraintName, {
          name: constraintName,
          columns: [],
          referencedTable: row.foreign_table_name,
          referencedSchema: row.foreign_table_schema,
          referencedColumns: [],
          onDelete: row.delete_rule as any,
          onUpdate: row.update_rule as any,
        });
      }
      
      const fk = foreignKeys.get(constraintName)!;
      fk.columns.push(row.column_name);
      fk.referencedColumns.push(row.foreign_column_name);
    }
    
    return Array.from(foreignKeys.values());
  }
  
  /**
   * Parse indexes.
   */
  private async parseIndexes(client: pg.Client, schemaName: string, tableName: string): Promise<Index[]> {
    const query = `
      SELECT
        i.relname AS index_name,
        a.attname AS column_name,
        ix.indisunique AS is_unique,
        am.amname AS index_type
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_am am ON i.relam = am.oid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE n.nspname = $1
        AND t.relname = $2
        AND NOT ix.indisprimary
      ORDER BY i.relname, array_position(ix.indkey, a.attnum);
    `;
    
    const result = await client.query(query, [schemaName, tableName]);
    const indexes: Map<string, Index> = new Map();
    
    for (const row of result.rows) {
      const indexName = row.index_name;
      
      if (!indexes.has(indexName)) {
        indexes.set(indexName, {
          name: indexName,
          columns: [],
          unique: row.is_unique,
          type: row.index_type,
        });
      }
      
      indexes.get(indexName)!.columns.push({
        name: row.column_name,
      });
    }
    
    return Array.from(indexes.values());
  }
  
  /**
   * Parse unique constraints.
   */
  private async parseUniqueConstraints(client: pg.Client, schemaName: string, tableName: string): Promise<Array<{ name: string; columns: string[] }>> {
    const query = `
      SELECT
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = $1
        AND tc.table_name = $2
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc2
          WHERE tc2.constraint_name = tc.constraint_name
            AND tc2.constraint_type = 'PRIMARY KEY'
        )
      ORDER BY kcu.ordinal_position;
    `;
    
    const result = await client.query(query, [schemaName, tableName]);
    const constraints: Map<string, string[]> = new Map();
    
    for (const row of result.rows) {
      const constraintName = row.constraint_name;
      if (!constraints.has(constraintName)) {
        constraints.set(constraintName, []);
      }
      constraints.get(constraintName)!.push(row.column_name);
    }
    
    return Array.from(constraints.entries()).map(([name, columns]) => ({ name, columns }));
  }
  
  /**
   * Parse check constraints.
   */
  private async parseCheckConstraints(client: pg.Client, schemaName: string, tableName: string): Promise<Array<{ name: string; expression: string }>> {
    const query = `
      SELECT
        constraint_name,
        check_clause
      FROM information_schema.check_constraints
      WHERE constraint_schema = $1
        AND constraint_name IN (
          SELECT constraint_name
          FROM information_schema.table_constraints
          WHERE table_schema = $1
            AND table_name = $2
            AND constraint_type = 'CHECK'
        );
    `;
    
    const result = await client.query(query, [schemaName, tableName]);
    return result.rows.map((r: any) => ({
      name: r.constraint_name,
      expression: r.check_clause,
    }));
  }
  
  /**
   * Parse views.
   */
  private async parseViews(client: pg.Client, schemaName: string): Promise<Array<{ name: string; schema?: string; definition: string; materialized?: boolean; comment?: string }>> {
    const query = `
      SELECT
        table_name,
        view_definition,
        obj_description(c.oid, 'pg_class') as comment
      FROM information_schema.views v
      JOIN pg_class c ON c.relname = v.table_name
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = $1
      WHERE table_schema = $1;
    `;
    
    const result = await client.query(query, [schemaName]);
    return result.rows.map((r: any) => ({
      name: r.table_name,
      schema: schemaName,
      definition: r.view_definition,
      comment: r.comment || undefined,
    }));
  }
  
  /**
   * Parse enums.
   */
  private async parseEnums(client: pg.Client, schemaName: string): Promise<Array<{ name: string; schema?: string; values: string[]; comment?: string }>> {
    const query = `
      SELECT
        t.typname AS enum_name,
        array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values,
        obj_description(t.oid, 'pg_type') AS comment
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = $1
        AND t.typtype = 'e'
      GROUP BY t.typname, t.oid;
    `;
    
    const result = await client.query(query, [schemaName]);
    return result.rows.map((r: any) => ({
      name: r.enum_name,
      schema: schemaName,
      values: r.enum_values,
      comment: r.comment || undefined,
    }));
  }
  
  /**
   * Parse functions.
   */
  private async parseFunctions(client: pg.Client, schemaName: string): Promise<Array<{ name: string; schema?: string; parameters: any[]; returnType?: string; body?: string; language?: string }>> {
    const query = `
      SELECT
        p.proname AS function_name,
        pg_get_function_result(p.oid) AS return_type,
        pg_get_functiondef(p.oid) AS function_definition,
        l.lanname AS language
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
      WHERE n.nspname = $1;
    `;
    
    const result = await client.query(query, [schemaName]);
    return result.rows.map((r: any) => ({
      name: r.function_name,
      schema: schemaName,
      parameters: [], // Would need additional query to parse parameters
      returnType: r.return_type,
      body: r.function_definition,
      language: r.language,
    }));
  }
  
  /**
   * Parse triggers.
   */
  private async parseTriggers(client: pg.Client, schemaName: string): Promise<Trigger[]> {
    const query = `
      SELECT
        t.tgname AS trigger_name,
        c.relname AS table_name,
        CASE t.tgtype & 2 WHEN 0 THEN 'AFTER' ELSE 'BEFORE' END AS timing,
        CASE 
          WHEN t.tgtype & 4 > 0 THEN 'INSERT'
          WHEN t.tgtype & 8 > 0 THEN 'DELETE'
          WHEN t.tgtype & 16 > 0 THEN 'UPDATE'
        END AS event,
        p.proname AS function_name,
        pg_get_triggerdef(t.oid) AS trigger_definition
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname = $1
        AND NOT t.tgisinternal;
    `;
    
    const result = await client.query(query, [schemaName]);
    const triggers: Map<string, Trigger> = new Map();
    
    for (const row of result.rows) {
      const triggerName = row.trigger_name;
      if (!triggers.has(triggerName)) {
        triggers.set(triggerName, {
          name: triggerName,
          schema: schemaName,
          table: row.table_name,
          timing: row.timing as 'BEFORE' | 'AFTER' | 'INSTEAD OF',
          events: [],
          function: row.function_name,
        });
      }
      triggers.get(triggerName)!.events.push(row.event as 'INSERT' | 'UPDATE' | 'DELETE');
    }
    
    return Array.from(triggers.values());
  }
}

