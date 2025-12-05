/**
 * MySQL/MariaDB database schema parser.
 */

import { IDatabaseParser } from '../parser';
import { DatabaseType, DatabaseConnection, DatabaseCapabilities } from '../types';
import { DatabaseSchema, Table, Column, ColumnType, TypeCategory } from '../../schema/types';
// Optional dependency - install with: npm install mysql2
// @ts-ignore - Optional dependency
import * as mysql from 'mysql2/promise';

export class MySQLParser implements IDatabaseParser {
  readonly databaseType = DatabaseType.MySQL;
  
  static readonly capabilities: DatabaseCapabilities = {
    supportsSchemas: false, // MySQL uses databases instead
    supportsTransactions: true,
    supportsForeignKeys: true,
    supportsIndexes: true,
    supportsViews: true,
    supportsStoredProcedures: true,
    supportsTriggers: true,
    supportsEnums: true,
    supportsJson: true,
    supportsArrays: false,
    supportsFullTextSearch: true,
    maxIdentifierLength: 64,
    caseSensitiveIdentifiers: false,
  };
  
  async parseFromConnection(connection: DatabaseConnection): Promise<DatabaseSchema> {
    const config = this.parseConnectionString(connection.connectionString);
    const pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database || connection.options?.database,
      ...connection.options,
    });
    
    try {
      const schema = await this.parseSchema(pool, config.database || connection.options?.database);
      return schema;
    } finally {
      await pool.end();
    }
  }
  
  async parseFromSQL(sql: string): Promise<DatabaseSchema> {
    throw new Error('SQL parsing not yet implemented for MySQL');
  }
  
  async parseFromConnectionString(connectionString: string): Promise<DatabaseSchema> {
    return this.parseFromConnection({
      type: DatabaseType.MySQL,
      connectionString,
    });
  }
  
  validateConnectionString(connectionString: string): boolean {
    return connectionString.startsWith('mysql://');
  }
  
  private parseConnectionString(connectionString: string): {
    host: string;
    port: number;
    user: string;
    password: string;
    database?: string;
  } {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1) || undefined,
    };
  }
  
  private async parseSchema(pool: mysql.Pool, databaseName?: string): Promise<DatabaseSchema> {
    const tables = await this.parseTables(pool, databaseName);
    const views = await this.parseViews(pool, databaseName);
    const functions = await this.parseFunctions(pool, databaseName);
    
    return {
      databaseType: DatabaseType.MySQL,
      databaseName,
      tables,
      views,
      functions,
    };
  }
  
  private async parseTables(pool: mysql.Pool, databaseName?: string): Promise<Table[]> {
    const query = databaseName
      ? `SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`
      : `SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`;
    
    const [rows] = await pool.execute<any[]>(query, databaseName ? [databaseName] : []);
    const tables: Table[] = [];
    
    for (const row of rows) {
      const tableName = row.TABLE_NAME;
      const columns = await this.parseColumns(pool, databaseName, tableName);
      const primaryKey = await this.parsePrimaryKey(pool, databaseName, tableName);
      const foreignKeys = await this.parseForeignKeys(pool, databaseName, tableName);
      const indexes = await this.parseIndexes(pool, databaseName, tableName);
      
      tables.push({
        name: tableName,
        columns,
        primaryKey,
        foreignKeys,
        indexes,
        comment: row.TABLE_COMMENT || undefined,
      });
    }
    
    return tables;
  }
  
  private async parseColumns(pool: mysql.Pool, databaseName: string | undefined, tableName: string): Promise<Column[]> {
    const query = databaseName
      ? `SELECT * FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`
      : `SELECT * FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`;
    
    const [rows] = await pool.execute<any[]>(query, databaseName ? [databaseName, tableName] : [tableName]);
    const columns: Column[] = [];
    
    for (const row of rows) {
      const type = this.parseColumnType(row.DATA_TYPE, row.COLUMN_TYPE);
      
      columns.push({
        name: row.COLUMN_NAME,
        type,
        nullable: row.IS_NULLABLE === 'YES',
        defaultValue: row.COLUMN_DEFAULT || undefined,
        autoIncrement: row.EXTRA?.includes('auto_increment') || false,
        comment: row.COLUMN_COMMENT || undefined,
        position: row.ORDINAL_POSITION,
        length: this.extractLength(row.COLUMN_TYPE),
        precision: row.NUMERIC_PRECISION ? parseInt(row.NUMERIC_PRECISION) : undefined,
        scale: row.NUMERIC_SCALE ? parseInt(row.NUMERIC_SCALE) : undefined,
      });
    }
    
    return columns;
  }
  
  private parseColumnType(dataType: string, columnType: string): ColumnType {
    const lower = dataType.toLowerCase();
    let category: TypeCategory;
    let name: string;
    
    // String types
    if (['varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext'].includes(lower)) {
      category = TypeCategory.String;
      name = lower === 'text' || lower.includes('text') ? 'text' : lower;
    }
    // Integer types
    else if (['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint'].includes(lower)) {
      category = TypeCategory.Integer;
      name = lower;
    }
    // Decimal types
    else if (['decimal', 'numeric', 'fixed'].includes(lower)) {
      category = TypeCategory.Decimal;
      name = 'decimal';
    }
    // Float types
    else if (['float', 'double', 'double precision', 'real'].includes(lower)) {
      category = TypeCategory.Float;
      name = lower;
    }
    // Boolean
    else if (lower === 'bool' || lower === 'boolean' || (lower === 'tinyint' && columnType.includes('(1)'))) {
      category = TypeCategory.Boolean;
      name = 'boolean';
    }
    // Date/Time types
    else if (lower === 'date') {
      category = TypeCategory.Date;
      name = 'date';
    }
    else if (['datetime', 'timestamp'].includes(lower)) {
      category = TypeCategory.DateTime;
      name = lower;
    }
    else if (lower === 'time') {
      category = TypeCategory.Time;
      name = 'time';
    }
    else if (lower === 'year') {
      category = TypeCategory.Integer;
      name = 'year';
    }
    // JSON
    else if (lower === 'json') {
      category = TypeCategory.Json;
      name = 'json';
    }
    // Binary types
    else if (['binary', 'varbinary', 'blob', 'tinyblob', 'mediumblob', 'longblob'].includes(lower)) {
      category = TypeCategory.Binary;
      name = lower.includes('blob') ? 'blob' : lower;
    }
    // Enum
    else if (lower === 'enum') {
      category = TypeCategory.Enum;
      name = 'enum';
      const enumValues = this.extractEnumValues(columnType);
      return { name, category, enumValues };
    }
    // Set
    else if (lower === 'set') {
      category = TypeCategory.Enum;
      name = 'set';
      const enumValues = this.extractEnumValues(columnType);
      return { name, category, enumValues };
    }
    else {
      category = TypeCategory.Other;
      name = dataType;
    }
    
    return { name, originalName: dataType, category };
  }
  
  private extractLength(columnType: string): number | undefined {
    const match = columnType.match(/\((\d+)\)/);
    return match ? parseInt(match[1]) : undefined;
  }
  
  private extractEnumValues(columnType: string): string[] {
    const match = columnType.match(/\((.+)\)/);
    if (!match) return [];
    return match[1].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
  }
  
  private async parsePrimaryKey(pool: mysql.Pool, databaseName: string | undefined, tableName: string): Promise<{ columns: string[]; name?: string } | undefined> {
    const query = databaseName
      ? `SELECT COLUMN_NAME, CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION`
      : `SELECT COLUMN_NAME, CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION`;
    
    const [rows] = await pool.execute<any[]>(query, databaseName ? [databaseName, tableName] : [tableName]);
    
    if (rows.length === 0) {
      return undefined;
    }
    
    return {
      columns: rows.map((r: any) => r.COLUMN_NAME),
      name: rows[0].CONSTRAINT_NAME,
    };
  }
  
  private async parseForeignKeys(pool: mysql.Pool, databaseName: string | undefined, tableName: string): Promise<any[]> {
    const query = databaseName
      ? `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, UPDATE_RULE, DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY ORDINAL_POSITION`
      : `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, UPDATE_RULE, DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY ORDINAL_POSITION`;
    
    const [rows] = await pool.execute<any[]>(query, databaseName ? [databaseName, tableName] : [tableName]);
    const foreignKeys: Map<string, any> = new Map();
    
    for (const row of rows) {
      const constraintName = row.CONSTRAINT_NAME;
      if (!foreignKeys.has(constraintName)) {
        foreignKeys.set(constraintName, {
          name: constraintName,
          columns: [],
          referencedTable: row.REFERENCED_TABLE_NAME,
          referencedColumns: [],
          onDelete: row.DELETE_RULE,
          onUpdate: row.UPDATE_RULE,
        });
      }
      foreignKeys.get(constraintName)!.columns.push(row.COLUMN_NAME);
      foreignKeys.get(constraintName)!.referencedColumns.push(row.REFERENCED_COLUMN_NAME);
    }
    
    return Array.from(foreignKeys.values());
  }
  
  private async parseIndexes(pool: mysql.Pool, databaseName: string | undefined, tableName: string): Promise<any[]> {
    const query = databaseName
      ? `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, INDEX_TYPE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME != 'PRIMARY' ORDER BY INDEX_NAME, SEQ_IN_INDEX`
      : `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, INDEX_TYPE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME != 'PRIMARY' ORDER BY INDEX_NAME, SEQ_IN_INDEX`;
    
    const [rows] = await pool.execute<any[]>(query, databaseName ? [databaseName, tableName] : [tableName]);
    const indexes: Map<string, any> = new Map();
    
    for (const row of rows) {
      const indexName = row.INDEX_NAME;
      if (!indexes.has(indexName)) {
        indexes.set(indexName, {
          name: indexName,
          columns: [],
          unique: row.NON_UNIQUE === 0,
          type: row.INDEX_TYPE,
        });
      }
      indexes.get(indexName)!.columns.push({ name: row.COLUMN_NAME });
    }
    
    return Array.from(indexes.values());
  }
  
  private async parseViews(pool: mysql.Pool, databaseName: string | undefined): Promise<any[]> {
    const query = databaseName
      ? `SELECT TABLE_NAME, VIEW_DEFINITION FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ?`
      : `SELECT TABLE_NAME, VIEW_DEFINITION FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE()`;
    
    const [rows] = await pool.execute<any[]>(query, databaseName ? [databaseName] : []);
    return rows.map((r: any) => ({
      name: r.TABLE_NAME,
      definition: r.VIEW_DEFINITION,
    }));
  }
  
  private async parseFunctions(pool: mysql.Pool, databaseName: string | undefined): Promise<any[]> {
    const query = databaseName
      ? `SELECT ROUTINE_NAME, ROUTINE_DEFINITION, DATA_TYPE, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'FUNCTION'`
      : `SELECT ROUTINE_NAME, ROUTINE_DEFINITION, DATA_TYPE, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'FUNCTION'`;
    
    const [rows] = await pool.execute<any[]>(query, databaseName ? [databaseName] : []);
    return rows.map((r: any) => ({
      name: r.ROUTINE_NAME,
      returnType: r.DATA_TYPE,
      body: r.ROUTINE_DEFINITION,
    }));
  }
}

