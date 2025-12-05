/**
 * Database parser exports and registry initialization.
 */

import { DatabaseParserRegistry } from '../parser';
import { PostgreSQLParser } from './postgresql';
import { MySQLParser } from './mysql';
import { SQLiteParser } from './sqlite';

/**
 * Initialize default parser registry with all supported parsers.
 */
export function initializeParserRegistry(): DatabaseParserRegistry {
  const registry = new DatabaseParserRegistry();
  
  // Register all parsers
  registry.register(new PostgreSQLParser());
  registry.register(new MySQLParser());
  registry.register(new SQLiteParser());
  
  // TODO: Add more parsers:
  // - SQL Server
  // - Oracle
  // - MongoDB
  // - CockroachDB
  // - PlanetScale
  // - Supabase
  // - Neon
  // - Turso
  // - Xata
  // - D1
  
  return registry;
}

/**
 * Get default parser registry instance.
 */
let defaultRegistry: DatabaseParserRegistry | null = null;

export function getDefaultParserRegistry(): DatabaseParserRegistry {
  if (!defaultRegistry) {
    defaultRegistry = initializeParserRegistry();
  }
  return defaultRegistry;
}

export { DatabaseParserRegistry } from '../parser';
export { PostgreSQLParser } from './postgresql';
export { MySQLParser } from './mysql';
export { SQLiteParser } from './sqlite';

