/**
 * Database type definitions and enums.
 * 
 * Supports all major database types and their specific features.
 */

/**
 * Supported database types.
 */
export enum DatabaseType {
  PostgreSQL = 'postgresql',
  MySQL = 'mysql',
  MariaDB = 'mariadb',
  SQLite = 'sqlite',
  SQLServer = 'sqlserver',
  Oracle = 'oracle',
  MongoDB = 'mongodb',
  CockroachDB = 'cockroachdb',
  PlanetScale = 'planetscale',
  Supabase = 'supabase',
  Neon = 'neon',
  Turso = 'turso',
  Xata = 'xata',
  D1 = 'd1',
  Prisma = 'prisma', // Prisma-specific schema
}

/**
 * Database connection configuration.
 */
export interface DatabaseConnection {
  /**
   * Database type.
   */
  type: DatabaseType;
  
  /**
   * Connection string or URL.
   */
  connectionString: string;
  
  /**
   * Optional connection options.
   */
  options?: DatabaseOptions;
  
  /**
   * Optional connection name for identification.
   */
  name?: string;
}

/**
 * Database connection options.
 */
export interface DatabaseOptions {
  /**
   * Connection timeout in milliseconds.
   */
  timeout?: number;
  
  /**
   * Maximum number of connections in pool.
   */
  poolSize?: number;
  
  /**
   * SSL/TLS configuration.
   */
  ssl?: SSLConfig;
  
  /**
   * Schema name (for databases that support schemas).
   */
  schema?: string;
  
  /**
   * Database name.
   */
  database?: string;
  
  /**
   * Additional connection parameters.
   */
  [key: string]: any;
}

/**
 * SSL/TLS configuration.
 */
export interface SSLConfig {
  /**
   * Require SSL connection.
   */
  require?: boolean;
  
  /**
   * Reject unauthorized certificates.
   */
  rejectUnauthorized?: boolean;
  
  /**
   * CA certificate path or content.
   */
  ca?: string;
  
  /**
   * Client certificate path or content.
   */
  cert?: string;
  
  /**
   * Client key path or content.
   */
  key?: string;
}

/**
 * Database feature capabilities.
 */
export interface DatabaseCapabilities {
  /**
   * Supports schemas (namespace).
   */
  supportsSchemas: boolean;
  
  /**
   * Supports transactions.
   */
  supportsTransactions: boolean;
  
  /**
   * Supports foreign keys.
   */
  supportsForeignKeys: boolean;
  
  /**
   * Supports indexes.
   */
  supportsIndexes: boolean;
  
  /**
   * Supports views.
   */
  supportsViews: boolean;
  
  /**
   * Supports stored procedures.
   */
  supportsStoredProcedures: boolean;
  
  /**
   * Supports triggers.
   */
  supportsTriggers: boolean;
  
  /**
   * Supports enums.
   */
  supportsEnums: boolean;
  
  /**
   * Supports JSON/JSONB.
   */
  supportsJson: boolean;
  
  /**
   * Supports arrays.
   */
  supportsArrays: boolean;
  
  /**
   * Supports full-text search.
   */
  supportsFullTextSearch: boolean;
  
  /**
   * Maximum identifier length.
   */
  maxIdentifierLength?: number;
  
  /**
   * Case sensitivity for identifiers.
   */
  caseSensitiveIdentifiers: boolean;
}

