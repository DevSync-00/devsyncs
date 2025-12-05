/**
 * Database schema parser interface and implementations.
 * 
 * Parses database schemas from various sources and formats.
 */

import { DatabaseType, DatabaseConnection } from './types';
import { DatabaseSchema, Table, Column, Index, ForeignKey, CheckConstraint, UniqueConstraint } from '../schema/types';

/**
 * Base interface for database schema parsers.
 */
export interface IDatabaseParser {
  /**
   * Database type this parser supports.
   */
  readonly databaseType: DatabaseType;
  
  /**
   * Parse schema from connection.
   */
  parseFromConnection(connection: DatabaseConnection): Promise<DatabaseSchema>;
  
  /**
   * Parse schema from SQL DDL.
   */
  parseFromSQL(sql: string): Promise<DatabaseSchema>;
  
  /**
   * Parse schema from connection string.
   */
  parseFromConnectionString(connectionString: string): Promise<DatabaseSchema>;
  
  /**
   * Validate connection string format.
   */
  validateConnectionString(connectionString: string): boolean;
}

/**
 * Database schema parser registry.
 */
export class DatabaseParserRegistry {
  private parsers: Map<DatabaseType, IDatabaseParser> = new Map();
  
  /**
   * Register a parser for a database type.
   */
  register(parser: IDatabaseParser): void {
    this.parsers.set(parser.databaseType, parser);
  }
  
  /**
   * Get parser for database type.
   */
  getParser(databaseType: DatabaseType): IDatabaseParser {
    const parser = this.parsers.get(databaseType);
    if (!parser) {
      throw new Error(`No parser registered for database type: ${databaseType}`);
    }
    return parser;
  }
  
  /**
   * Get parser for connection string.
   */
  getParserForConnectionString(connectionString: string): IDatabaseParser {
    const databaseType = this.detectDatabaseType(connectionString);
    return this.getParser(databaseType);
  }
  
  /**
   * Detect database type from connection string.
   */
  detectDatabaseType(connectionString: string): DatabaseType {
    const lower = connectionString.toLowerCase();
    
    if (lower.startsWith('postgresql://') || lower.startsWith('postgres://')) {
      return DatabaseType.PostgreSQL;
    }
    if (lower.startsWith('mysql://')) {
      return DatabaseType.MySQL;
    }
    if (lower.startsWith('mariadb://')) {
      return DatabaseType.MariaDB;
    }
    if (lower.startsWith('sqlite://') || lower.startsWith('file:')) {
      return DatabaseType.SQLite;
    }
    if (lower.startsWith('sqlserver://') || lower.startsWith('mssql://')) {
      return DatabaseType.SQLServer;
    }
    if (lower.startsWith('oracle://')) {
      return DatabaseType.Oracle;
    }
    if (lower.startsWith('mongodb://') || lower.startsWith('mongodb+srv://')) {
      return DatabaseType.MongoDB;
    }
    if (lower.startsWith('cockroachdb://')) {
      return DatabaseType.CockroachDB;
    }
    if (lower.includes('planetscale')) {
      return DatabaseType.PlanetScale;
    }
    if (lower.includes('supabase')) {
      return DatabaseType.Supabase;
    }
    if (lower.includes('neon')) {
      return DatabaseType.Neon;
    }
    if (lower.includes('turso')) {
      return DatabaseType.Turso;
    }
    if (lower.includes('xata')) {
      return DatabaseType.Xata;
    }
    if (lower.includes('d1')) {
      return DatabaseType.D1;
    }
    
    // Default to PostgreSQL for Prisma
    return DatabaseType.PostgreSQL;
  }
  
  /**
   * Get all registered parsers.
   */
  getAllParsers(): IDatabaseParser[] {
    return Array.from(this.parsers.values());
  }
  
  /**
   * Check if parser exists for database type.
   */
  hasParser(databaseType: DatabaseType): boolean {
    return this.parsers.has(databaseType);
  }
}

