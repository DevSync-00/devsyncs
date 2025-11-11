import { Client, Pool } from 'pg';
import type { DbSchema, Model, Field } from '../types/index.js';
import { retry, withTimeout } from '../utils/retry.js';
import { ProgressIndicator } from '../utils/progress.js';

export interface ScanDatabaseOptions {
  connectionString: string;
  schema?: string;
  timeout?: number;
  maxRetries?: number;
  showProgress?: boolean;
  excludeTables?: string[];
  includeTables?: string[];
}

// Connection pools cache - one pool per connection string
const connectionPools = new Map<string, Pool>();

function getPool(connectionString: string): Pool {
  // Check if we already have a pool for this connection string
  if (!connectionPools.has(connectionString)) {
    const pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    connectionPools.set(connectionString, pool);
  }
  return connectionPools.get(connectionString)!;
}

export async function scanDatabase(options: ScanDatabaseOptions | string): Promise<DbSchema> {
  const opts: ScanDatabaseOptions = typeof options === 'string' 
    ? { connectionString: options }
    : options;

  const {
    connectionString,
    schema = 'public',
    timeout = 30000,
    maxRetries = 3,
    showProgress = true,
    excludeTables = [],
    includeTables = []
  } = opts;

  // Validate connection string
  if (!connectionString || !connectionString.trim()) {
    throw new Error('Database connection string is required');
  }

  const progress = showProgress ? new ProgressIndicator({ message: 'Connecting to database...' }) : null;

  try {
    // Use connection pool for better performance
    const pool = getPool(connectionString);
    
    // Test connection with retry
    await retry(
      async () => {
        const testClient = await pool.connect();
        testClient.release();
      },
      {
        maxAttempts: maxRetries,
        retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'timeout', 'connection']
      }
    );

    progress?.update(0, 'Fetching tables...');

    // Get all tables in schema with better query
    const tablesQuery = `
      SELECT 
        t.table_name,
        t.table_type,
        obj_description(c.oid, 'pg_class') as table_comment
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
      WHERE t.table_schema = $1
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `;

    const tablesResult = await withTimeout(
      pool.query(tablesQuery, [schema]),
      timeout,
      'Database query timed out'
    );

    let tables = tablesResult.rows;

    // Filter tables
    if (includeTables.length > 0) {
      tables = tables.filter(t => includeTables.includes(t.table_name));
    }
    if (excludeTables.length > 0) {
      tables = tables.filter(t => !excludeTables.includes(t.table_name));
    }

    progress?.update(0, `Scanning ${tables.length} tables...`);

    // Process tables in parallel batches for better performance
    const batchSize = 10;
    const models: Model[] = [];

    for (let i = 0; i < tables.length; i += batchSize) {
      const batch = tables.slice(i, i + batchSize);
      
      const batchModels = await Promise.all(
        batch.map(async (table, idx) => {
          const tableName = table.table_name;
          progress?.update(
            i + idx + 1,
            `Scanning table: ${tableName} (${i + idx + 1}/${tables.length})`
          );

          try {
            return await scanTable(pool, tableName, schema, timeout);
          } catch (error) {
            console.warn(`Warning: Failed to scan table ${tableName}: ${error instanceof Error ? error.message : String(error)}`);
            // Return empty model on error to continue scanning
            return {
              name: tableName,
              fields: []
            };
          }
        })
      );

      models.push(...batchModels);
    }

    progress?.complete(`Scanned ${models.length} tables successfully`);

    return {
      models: models.filter(m => m.fields.length > 0), // Filter out empty models
      type: 'postgresql'
    };
  } catch (error) {
    progress?.complete();
    if (error instanceof Error) {
      throw new Error(`Failed to scan database: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Scan a single table with comprehensive information
 */
async function scanTable(
  pool: Pool,
  tableName: string,
  schema: string,
  timeout: number
): Promise<Model> {
  // Get columns with comprehensive information
  const columnsQuery = `
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
      col_description(pgc.oid, c.ordinal_position) as column_comment
    FROM information_schema.columns c
    LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
    LEFT JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace AND pgn.nspname = c.table_schema
    WHERE c.table_name = $1
      AND c.table_schema = $2
    ORDER BY c.ordinal_position
  `;

  const columnsResult = await withTimeout(
    pool.query(columnsQuery, [tableName, schema]),
    timeout
  );

  // Get constraints (primary keys, unique, foreign keys, check constraints)
  const constraintsQuery = `
    SELECT
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    LEFT JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    LEFT JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    WHERE tc.table_name = $1
      AND tc.table_schema = $2
  `;

  const constraintsResult = await withTimeout(
    pool.query(constraintsQuery, [tableName, schema]),
    timeout
  );

  // Get indexes
  const indexesQuery = `
    SELECT
      i.relname AS index_name,
      a.attname AS column_name,
      ix.indisunique AS is_unique,
      ix.indisprimary AS is_primary
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = $1
      AND n.nspname = $2
      AND t.relkind = 'r'
  `;

  const indexesResult = await withTimeout(
    pool.query(indexesQuery, [tableName, schema]),
    timeout
  ).catch(() => ({ rows: [] })); // Indexes are optional

  // Build constraints map
  const constraintsMap = new Map<string, string[]>();
  const foreignKeysMap = new Map<string, { table: string; column: string; onUpdate?: string; onDelete?: string }>();

  constraintsResult.rows.forEach((constraint) => {
    const columnName = constraint.column_name;
    if (!columnName) return;

    if (!constraintsMap.has(columnName)) {
      constraintsMap.set(columnName, []);
    }
    
    if (constraint.constraint_type === 'FOREIGN KEY') {
      constraintsMap.get(columnName)!.push('FOREIGN KEY');
      foreignKeysMap.set(columnName, {
        table: constraint.foreign_table_name,
        column: constraint.foreign_column_name,
        onUpdate: constraint.update_rule,
        onDelete: constraint.delete_rule
      });
    } else {
      constraintsMap.get(columnName)!.push(constraint.constraint_type);
    }
  });

  // Build indexes map
  const indexesMap = new Map<string, { unique: boolean; primary: boolean }>();
  indexesResult.rows.forEach((index) => {
    const columnName = index.column_name;
    if (!indexesMap.has(columnName)) {
      indexesMap.set(columnName, { unique: false, primary: false });
    }
    const idx = indexesMap.get(columnName)!;
    if (index.is_unique) idx.unique = true;
    if (index.is_primary) idx.primary = true;
  });

  const fields: Field[] = columnsResult.rows.map((col) => {
    let dataType = normalizeDataType(col.data_type, col.udt_name, {
      maxLength: col.character_maximum_length,
      precision: col.numeric_precision,
      scale: col.numeric_scale
    });

    const field: Field = {
      name: col.column_name,
      type: dataType,
      nullable: col.is_nullable === 'YES',
      defaultValue: col.column_default
    };

    // Add constraints
    const constraints = constraintsMap.get(col.column_name);
    if (constraints && constraints.length > 0) {
      field.constraints = constraints;
    }

    // Add index information
    const indexInfo = indexesMap.get(col.column_name);
    if (indexInfo) {
      if (!field.constraints) field.constraints = [];
      if (indexInfo.primary && !field.constraints.includes('PRIMARY KEY')) {
        field.constraints.push('PRIMARY KEY');
      }
      if (indexInfo.unique && !field.constraints.includes('UNIQUE')) {
        field.constraints.push('UNIQUE');
      }
    }

    return field;
  });

  return {
    name: tableName,
    fields
  };
}

/**
 * Normalize PostgreSQL data types to standard format
 */
function normalizeDataType(
  dataType: string,
  udtName: string,
  options: { maxLength?: number; precision?: number; scale?: number } = {}
): string {
  const { maxLength, precision, scale } = options;

  // Use UDT name if available (more accurate)
  const type = udtName || dataType;

  // Handle common PostgreSQL types
  switch (type.toLowerCase()) {
    case 'varchar':
    case 'character varying':
      return maxLength ? `varchar(${maxLength})` : 'text';
    
    case 'char':
    case 'character':
      return maxLength ? `char(${maxLength})` : 'char(1)';
    
    case 'numeric':
    case 'decimal':
      if (precision !== null && scale !== null) {
        return `numeric(${precision},${scale})`;
      } else if (precision !== null) {
        return `numeric(${precision})`;
      }
      return 'numeric';
    
    case 'timestamp without time zone':
    case 'timestamp':
      return 'timestamp';
    
    case 'timestamp with time zone':
    case 'timestamptz':
      return 'timestamptz';
    
    case 'time without time zone':
      return 'time';
    
    case 'time with time zone':
      return 'timetz';
    
    case 'double precision':
    case 'float8':
      return 'double precision';
    
    case 'real':
    case 'float4':
      return 'real';
    
    case 'smallint':
    case 'int2':
      return 'smallint';
    
    case 'integer':
    case 'int':
    case 'int4':
      return 'integer';
    
    case 'bigint':
    case 'int8':
      return 'bigint';
    
    case 'boolean':
    case 'bool':
      return 'boolean';
    
    case 'json':
      return 'json';
    
    case 'jsonb':
      return 'jsonb';
    
    case 'uuid':
      return 'uuid';
    
    case 'bytea':
      return 'bytea';
    
    case 'text':
      return 'text';
    
    case 'date':
      return 'date';
    
    default:
      // For array types
      if (type.endsWith('[]') || type.includes('_array')) {
        const baseType = type.replace('[]', '').replace('_array', '');
        return `${normalizeDataType(baseType, baseType)}[]`;
      }
      
      // Return as-is if unknown
      return type.toLowerCase();
  }
}

/**
 * Close connection pool (call when done)
 */
export async function closeDatabaseConnections(connectionString?: string): Promise<void> {
  if (connectionString) {
    // Close specific pool
    const pool = connectionPools.get(connectionString);
    if (pool) {
      await pool.end();
      connectionPools.delete(connectionString);
    }
  } else {
    // Close all pools
    const closePromises = Array.from(connectionPools.values()).map(pool => pool.end());
    await Promise.all(closePromises);
    connectionPools.clear();
  }
}

