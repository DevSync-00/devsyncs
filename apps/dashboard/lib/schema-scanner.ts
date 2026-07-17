import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import mysql from 'mysql2/promise';

export interface ScannedColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string | null;
  constraints?: string[];
}

export interface ScannedRelationship {
  column: string;
  referencedTable: string;
  referencedColumn?: string;
  constraintName?: string;
  source?: string;
}

export interface ScannedTable {
  name: string;
  columns: ScannedColumn[];
  columnsComplete?: boolean;
  relationships?: ScannedRelationship[];
  source?: string;
}

export interface ScannedSchema {
  tables: ScannedTable[];
  metadata: {
    source: 'code' | 'database';
    sourceType: string;
    tableCount: number;
    columnCount: number;
    inferredTableCount?: number;
    relationshipCount?: number;
    scannedAt: string;
    warnings?: string[];
  };
}

export interface SchemaMismatch {
  type: 'missing_table' | 'extra_table' | 'missing_field' | 'extra_field' | 'type_mismatch' | 'nullable_mismatch' | 'missing_relationship' | 'extra_relationship';
  severity: 'error' | 'warning' | 'info';
  model: string;
  table: string;
  field?: string;
  column?: string;
  message: string;
  codeValue?: any;
  dbValue?: any;
  suggestedFix?: string;
}

const EXCLUDED_DIRS = new Set([
  '.git',
  '.next',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.cache',
]);

const SCANNED_EXTENSIONS = new Set(['.sql', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.prisma']);

export function scanCodebaseSchema(root: string): ScannedSchema {
  if (!root || !existsSync(root)) {
    throw new Error(`Codebase path does not exist: ${root || '(empty)'}`);
  }

  const files = collectFiles(root);
  const tableMap = new Map<string, ScannedTable>();
  const warnings: string[] = [];
  const schemaFiles = files.filter(isSchemaDefinitionFile);
  const referenceFiles = files.filter((filePath) => {
    if (isSchemaDefinitionFile(filePath)) {
      return false;
    }
    if (!SCANNED_EXTENSIONS.has(path.extname(filePath))) {
      return false;
    }
    return isDatabaseAccessFile(filePath) || fileContainsDatabaseReference(filePath);
  });

  for (const filePath of schemaFiles) {
    const content = readFileSync(filePath, 'utf8');
    const relativePath = path.relative(root, filePath);

    if (filePath.endsWith('.sql')) {
      for (const table of parseCreateTables(content, relativePath)) {
        mergeTable(tableMap, table);
      }
    }

    if (filePath.endsWith('.prisma')) {
      for (const table of parsePrismaModels(content, relativePath)) {
        mergeTable(tableMap, table);
      }
    }
  }

  for (const filePath of referenceFiles) {
    const content = readFileSync(filePath, 'utf8');
    const relativePath = path.relative(root, filePath);

    for (const reference of extractReferencedTables(content, filePath)) {
      mergeTable(tableMap, {
        name: reference.name,
        columns: reference.columns.map((name) => ({
          name,
          type: 'unknown',
          nullable: true,
        })),
        columnsComplete: false,
        source: relativePath,
      });
    }
  }

  const tables = Array.from(tableMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const inferredTableCount = tables.filter((table) => table.columnsComplete === false).length;

  if (schemaFiles.length > 0 && referenceFiles.length > 0) {
    warnings.push(`Merged ${schemaFiles.length} schema definition file${schemaFiles.length === 1 ? '' : 's'} with ${referenceFiles.length} database reference file${referenceFiles.length === 1 ? '' : 's'}.`);
  } else if (schemaFiles.length > 0) {
    warnings.push(`Used ${schemaFiles.length} schema definition file${schemaFiles.length === 1 ? '' : 's'} for the code schema.`);
  }

  if (referenceFiles.length > 0 && inferredTableCount > 0) {
    warnings.push(`${inferredTableCount} table${inferredTableCount === 1 ? '' : 's'} inferred from database-client references have incomplete column details.`);
  }

  if (schemaFiles.length === 0 && referenceFiles.length === 0) {
    warnings.push('No schema definition files or database-client files were found. Code schema may be empty.');
  }

  return {
    tables,
    metadata: {
      source: 'code',
      sourceType: 'repository',
      tableCount: tables.length,
      columnCount: tables.reduce((sum, table) => sum + table.columns.length, 0),
      inferredTableCount,
      scannedAt: new Date().toISOString(),
      warnings,
    },
  };
}

export async function scanPostgresSchema(connectionString: string, schema = 'public'): Promise<ScannedSchema> {
  if (!connectionString?.trim()) {
    throw new Error('Project database connection string is required for database scanning.');
  }

  const pgConnectionString = normalizeConnectionStringForPg(connectionString);

  const pool = new Pool({
    connectionString: pgConnectionString,
    max: 2,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 5000,
    query_timeout: 15000,
    statement_timeout: 15000,
    ...getSslOptions(connectionString),
  });

  try {
    const tablesResult = await pool.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `,
      [schema]
    );

    const columnsResult = await pool.query(
      `
        SELECT
          table_name,
          column_name,
          data_type,
          udt_name,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns
        WHERE table_schema = $1
        ORDER BY table_name, ordinal_position
      `,
      [schema]
    );

    const constraintsResult = await pool.query(
      `
        SELECT
          tc.table_name,
          kcu.column_name,
          tc.constraint_type
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = $1
      `,
      [schema]
    );

    const relationshipsResult = await pool.query(
      `
        SELECT
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = $1
          AND tc.constraint_type = 'FOREIGN KEY'
        ORDER BY tc.table_name, tc.constraint_name
      `,
      [schema]
    );

    const constraintsByColumn = new Map<string, string[]>();
    for (const row of constraintsResult.rows) {
      const key = `${row.table_name}.${row.column_name}`;
      const current = constraintsByColumn.get(key) || [];
      current.push(row.constraint_type);
      constraintsByColumn.set(key, current);
    }

    const columnsByTable = new Map<string, ScannedColumn[]>();
    for (const row of columnsResult.rows) {
      const key = `${row.table_name}.${row.column_name}`;
      const columns = columnsByTable.get(row.table_name) || [];
      columns.push({
        name: row.column_name,
        type: normalizeType(row.udt_name || row.data_type),
        nullable: row.is_nullable === 'YES',
        defaultValue: row.column_default,
        constraints: constraintsByColumn.get(key),
      });
      columnsByTable.set(row.table_name, columns);
    }

    const relationshipsByTable = new Map<string, ScannedRelationship[]>();
    for (const row of relationshipsResult.rows) {
      const relationships = relationshipsByTable.get(row.table_name) || [];
      relationships.push({
        column: row.column_name,
        referencedTable: row.referenced_table,
        referencedColumn: row.referenced_column,
        constraintName: row.constraint_name,
      });
      relationshipsByTable.set(row.table_name, relationships);
    }

    const tables = tablesResult.rows.map((row) => ({
      name: row.table_name,
      columns: columnsByTable.get(row.table_name) || [],
      relationships: relationshipsByTable.get(row.table_name) || [],
    }));

    return {
      tables,
      metadata: {
        source: 'database',
        sourceType: 'postgresql',
        tableCount: tables.length,
        columnCount: tables.reduce((sum, table) => sum + table.columns.length, 0),
        relationshipCount: tables.reduce((sum, table) => sum + (table.relationships?.length || 0), 0),
        scannedAt: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    throw new Error(formatDatabaseConnectionError(error, connectionString));
  } finally {
    await pool.end();
  }
}

export async function scanDatabaseSchema(connectionString: string): Promise<ScannedSchema> {
  const dialect = detectDatabaseDialect(connectionString);

  if (dialect === 'mysql') {
    return scanMySqlSchema(connectionString);
  }

  return scanPostgresSchema(connectionString);
}

export async function scanMySqlSchema(connectionString: string): Promise<ScannedSchema> {
  if (!connectionString?.trim()) {
    throw new Error('Project database connection string is required for database scanning.');
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('Invalid MySQL connection string. Use mysql://user:password@host:3306/database');
  }

  const database = url.pathname.replace(/^\//, '');
  if (!database) {
    throw new Error('MySQL connection string must include a database name, for example mysql://root:password@localhost:3306/smart_budget');
  }

  const connection = await mysql.createConnection({
    uri: connectionString,
    connectTimeout: 15000,
  });

  try {
    const [tableRows] = await connection.execute(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `,
      [database]
    );

    const [columnRows] = await connection.execute(
      `
        SELECT
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns
        WHERE table_schema = ?
        ORDER BY table_name, ordinal_position
      `,
      [database]
    );

    const [constraintRows] = await connection.execute(
      `
        SELECT
          table_name,
          column_name,
          constraint_name
        FROM information_schema.key_column_usage
        WHERE table_schema = ?
          AND constraint_name IS NOT NULL
      `,
      [database]
    );

    const [relationshipRows] = await connection.execute(
      `
        SELECT
          constraint_name,
          table_name,
          column_name,
          referenced_table_name,
          referenced_column_name
        FROM information_schema.key_column_usage
        WHERE table_schema = ?
          AND referenced_table_name IS NOT NULL
        ORDER BY table_name, constraint_name
      `,
      [database]
    );

    const constraintsByColumn = new Map<string, string[]>();
    for (const row of constraintRows as any[]) {
      const key = `${row.table_name}.${row.column_name}`;
      const current = constraintsByColumn.get(key) || [];
      current.push(normalizeMySqlConstraint(row.constraint_name));
      constraintsByColumn.set(key, Array.from(new Set(current)));
    }

    const columnsByTable = new Map<string, ScannedColumn[]>();
    for (const row of columnRows as any[]) {
      const key = `${row.table_name}.${row.column_name}`;
      const columns = columnsByTable.get(row.table_name) || [];
      columns.push({
        name: row.column_name,
        type: normalizeType(row.data_type),
        nullable: row.is_nullable === 'YES',
        defaultValue: row.column_default,
        constraints: constraintsByColumn.get(key),
      });
      columnsByTable.set(row.table_name, columns);
    }

    const relationshipsByTable = new Map<string, ScannedRelationship[]>();
    for (const row of relationshipRows as any[]) {
      const relationships = relationshipsByTable.get(row.table_name) || [];
      relationships.push({
        column: row.column_name,
        referencedTable: row.referenced_table_name,
        referencedColumn: row.referenced_column_name,
        constraintName: row.constraint_name,
      });
      relationshipsByTable.set(row.table_name, relationships);
    }

    const tables = (tableRows as any[]).map((row) => ({
      name: row.table_name,
      columns: columnsByTable.get(row.table_name) || [],
      relationships: relationshipsByTable.get(row.table_name) || [],
    }));

    return {
      tables,
      metadata: {
        source: 'database',
        sourceType: 'mysql',
        tableCount: tables.length,
        columnCount: tables.reduce((sum, table) => sum + table.columns.length, 0),
        relationshipCount: tables.reduce((sum, table) => sum + (table.relationships?.length || 0), 0),
        scannedAt: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    throw new Error(formatDatabaseConnectionError(error, connectionString));
  } finally {
    await connection.end();
  }
}

function getSslOptions(connectionString: string) {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode');
    if (
      sslMode === 'require'
      || sslMode === 'no-verify'
      || url.hostname.includes('supabase.co')
      || url.hostname.includes('pooler.supabase.com')
    ) {
      return { ssl: { rejectUnauthorized: false } };
    }
  } catch {
    // Let pg report malformed connection strings.
  }
  return {};
}

function detectDatabaseDialect(connectionString: string): 'postgres' | 'mysql' {
  try {
    const url = new URL(connectionString);
    if (url.protocol === 'mysql:' || url.protocol === 'mysql2:') {
      return 'mysql';
    }
  } catch {
    // Let the dialect-specific scanner report malformed URLs.
  }

  return 'postgres';
}

function normalizeMySqlConstraint(constraintName: string) {
  if (constraintName === 'PRIMARY') {
    return 'PRIMARY KEY';
  }
  if (constraintName?.endsWith('_ibfk_1') || constraintName?.includes('fk')) {
    return 'FOREIGN KEY';
  }
  return constraintName || 'CONSTRAINT';
}

function normalizeConnectionStringForPg(connectionString: string) {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode');

    if (sslMode === 'require' || sslMode === 'no-verify') {
      url.searchParams.delete('sslmode');
      return url.toString();
    }
  } catch {
    // Let pg report malformed connection strings.
  }

  return connectionString;
}

function formatDatabaseConnectionError(error: any, connectionString: string) {
  const message = error?.message || String(error);
  const code = error?.code;

  try {
    const url = new URL(connectionString);
    if (
      code === '28P01'
      || message.toLowerCase().includes('password authentication failed')
      || message.toLowerCase().includes('wrong password')
    ) {
      const isSupabase = url.hostname.includes('supabase.co');
      return isSupabase
        ? 'Database authentication failed. In Supabase, open Connect, copy the Transaction pooler connection string, replace [YOUR-PASSWORD] with the project database password, and save it in Edit Project. Percent-encode special characters in the password.'
        : `Database authentication failed for user "${decodeURIComponent(url.username)}". Verify the username and password in Edit Project.`;
    }

    if (code === 'ENOTFOUND' || message.includes('ENOTFOUND')) {
      return `Could not resolve database host "${url.hostname}". Check that the Supabase project ref/host is correct, the project is active, and prefer the Supabase Shared Pooler connection string if your network cannot reach the direct database host.`;
    }

    if (message.includes('self-signed certificate')) {
      return `Database SSL certificate was rejected for "${url.hostname}". The scanner now forces Supabase pooler SSL compatibility; restart the dev server and try again.`;
    }
  } catch {
    // Fall through to the original message.
  }

  return message;
}

export function compareSchemas(codeSchema: ScannedSchema, dbSchema: ScannedSchema): SchemaMismatch[] {
  const mismatches: SchemaMismatch[] = [];
  const codeTables = new Map(codeSchema.tables.map((table) => [table.name.toLowerCase(), table]));
  const dbTables = new Map(dbSchema.tables.map((table) => [table.name.toLowerCase(), table]));

  for (const codeTable of codeSchema.tables) {
    const dbTable = dbTables.get(codeTable.name.toLowerCase());
    if (!dbTable) {
      mismatches.push({
        type: 'missing_table',
        severity: 'error',
        model: codeTable.name,
        table: codeTable.name,
        message: `Table "${codeTable.name}" exists in code but not in the database.`,
        codeValue: codeTable,
        dbValue: null,
        suggestedFix: buildCreateTableSql(codeTable),
      });
      continue;
    }

    if (codeTable.columns.length === 0) {
      continue;
    }

    const dbColumns = new Map(dbTable.columns.map((column) => [column.name.toLowerCase(), column]));
    const codeColumns = new Map(codeTable.columns.map((column) => [column.name.toLowerCase(), column]));

    for (const codeColumn of codeTable.columns) {
      const dbColumn = dbColumns.get(codeColumn.name.toLowerCase());
      if (!dbColumn) {
        if (codeTable.columnsComplete === false) {
          continue;
        }
        mismatches.push({
          type: 'missing_field',
          severity: 'error',
          model: codeTable.name,
          table: codeTable.name,
          field: codeColumn.name,
          column: codeColumn.name,
          message: `Column "${codeTable.name}.${codeColumn.name}" exists in code but not in the database.`,
          codeValue: codeColumn,
          dbValue: null,
          suggestedFix: `ALTER TABLE ${quoteIdent(codeTable.name)} ADD COLUMN ${quoteIdent(codeColumn.name)} ${codeColumn.type}${codeColumn.nullable ? '' : ' NOT NULL'};`,
        });
        continue;
      }

      if (
        codeColumn.type !== 'unknown'
        && normalizeType(codeColumn.type) !== normalizeType(dbColumn.type)
      ) {
        mismatches.push({
          type: 'type_mismatch',
          severity: 'warning',
          model: codeTable.name,
          table: codeTable.name,
          field: codeColumn.name,
          column: codeColumn.name,
          message: `Column "${codeTable.name}.${codeColumn.name}" type differs: code has ${codeColumn.type}, database has ${dbColumn.type}.`,
          codeValue: codeColumn.type,
          dbValue: dbColumn.type,
        });
      }

      if (codeColumn.type !== 'unknown' && codeColumn.nullable !== dbColumn.nullable) {
        mismatches.push({
          type: 'nullable_mismatch',
          severity: 'warning',
          model: codeTable.name,
          table: codeTable.name,
          field: codeColumn.name,
          column: codeColumn.name,
          message: `Column "${codeTable.name}.${codeColumn.name}" nullability differs.`,
          codeValue: codeColumn.nullable,
          dbValue: dbColumn.nullable,
        });
      }
    }

    for (const dbColumn of dbTable.columns) {
      if (codeTable.columnsComplete !== false && !codeColumns.has(dbColumn.name.toLowerCase())) {
        mismatches.push({
          type: 'extra_field',
          severity: 'info',
          model: codeTable.name,
          table: codeTable.name,
          field: dbColumn.name,
          column: dbColumn.name,
          message: `Column "${codeTable.name}.${dbColumn.name}" exists in the database but not in code.`,
          codeValue: null,
          dbValue: dbColumn,
        });
      }
    }

    const codeRelationships = new Map((codeTable.relationships || []).map((relationship) => [relationshipKey(relationship), relationship]));
    const dbRelationships = new Map((dbTable.relationships || []).map((relationship) => [relationshipKey(relationship), relationship]));

    for (const [key, codeRelationship] of codeRelationships.entries()) {
      if (!dbRelationships.has(key)) {
        mismatches.push({
          type: 'missing_relationship',
          severity: 'warning',
          model: codeTable.name,
          table: codeTable.name,
          field: codeRelationship.column,
          column: codeRelationship.column,
          message: `Relationship "${formatRelationship(codeTable.name, codeRelationship)}" exists in code but not in the database.`,
          codeValue: codeRelationship,
          dbValue: null,
        });
      }
    }

    for (const [key, dbRelationship] of dbRelationships.entries()) {
      if (!codeRelationships.has(key)) {
        mismatches.push({
          type: 'extra_relationship',
          severity: 'info',
          model: codeTable.name,
          table: codeTable.name,
          field: dbRelationship.column,
          column: dbRelationship.column,
          message: `Relationship "${formatRelationship(codeTable.name, dbRelationship)}" exists in the database but not in code.`,
          codeValue: null,
          dbValue: dbRelationship,
        });
      }
    }
  }

  for (const dbTable of dbSchema.tables) {
    if (!codeTables.has(dbTable.name.toLowerCase())) {
      mismatches.push({
        type: 'extra_table',
        severity: 'info',
        model: dbTable.name,
        table: dbTable.name,
        message: `Table "${dbTable.name}" exists in the database but not in code.`,
        codeValue: null,
        dbValue: dbTable,
      });
    }
  }

  return mismatches;
}

function relationshipKey(relationship: ScannedRelationship): string {
  return [
    relationship.column,
    relationship.referencedTable,
    relationship.referencedColumn || 'id',
  ].join(':').toLowerCase();
}

function formatRelationship(tableName: string, relationship: ScannedRelationship): string {
  return `${tableName}.${relationship.column} -> ${relationship.referencedTable}.${relationship.referencedColumn || 'id'}`;
}

export function scopeDatabaseSchemaToCode(codeSchema: ScannedSchema, dbSchema: ScannedSchema): {
  scopedSchema: ScannedSchema;
  ignoredTables: string[];
} {
  const codeTableNames = new Set(codeSchema.tables.map((table) => table.name.toLowerCase()));

  if (codeTableNames.size === 0) {
    return {
      scopedSchema: dbSchema,
      ignoredTables: [],
    };
  }

  const scopedTables = dbSchema.tables.filter((table) => codeTableNames.has(table.name.toLowerCase()));
  const ignoredTables = dbSchema.tables
    .filter((table) => !codeTableNames.has(table.name.toLowerCase()))
    .map((table) => table.name)
    .sort((a, b) => a.localeCompare(b));

  return {
    scopedSchema: {
      ...dbSchema,
      tables: scopedTables,
      metadata: {
        ...dbSchema.metadata,
        tableCount: scopedTables.length,
        columnCount: scopedTables.reduce((sum, table) => sum + table.columns.length, 0),
        warnings: [
          ...(dbSchema.metadata.warnings || []),
          `Scoped database comparison to ${scopedTables.length} table${scopedTables.length === 1 ? '' : 's'} referenced by code; ignored ${ignoredTables.length} unrelated database table${ignoredTables.length === 1 ? '' : 's'}.`,
        ],
      },
    },
    ignoredTables,
  };
}

function collectFiles(root: string): string[] {
  const files: string[] = [];

  function walk(current: string, depth = 0) {
    if (depth > 12) return;

    for (const entry of readdirSync(current)) {
      if (EXCLUDED_DIRS.has(entry)) continue;

      const fullPath = path.join(current, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (stat.isFile() && SCANNED_EXTENSIONS.has(path.extname(entry))) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files;
}

function isSchemaDefinitionFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const extension = path.extname(filePath);

  if (extension === '.prisma') {
    return true;
  }

  if (extension !== '.sql') {
    return false;
  }

  return /(^|\/)(schema|schemas|migration|migrations|database|db|supabase|sql)(\/|$)/.test(normalized)
    || /(?:schema|migration|tables?|setup|init|create).*\.sql$/.test(normalized);
}

function isDatabaseAccessFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const basename = path.basename(normalized);
  const extension = path.extname(normalized);

  if (!SCANNED_EXTENSIONS.has(extension)) {
    return false;
  }

  return /(^|\/)(db|database|supabase|prisma|dao|repositories?|models?|schemas?|services?)(\/|$)/.test(normalized)
    || /(?:supabase|database|db|prisma|repository|dao|model|schema|queries?)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(basename);
}

function fileContainsDatabaseReference(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf8');
    return /from\s+['"]@supabase\/supabase-js['"]/.test(content)
      || /from\s+['"][^'"]*supabase['"]/.test(content)
      || /\b(?:supabase|db|database|client)\s*\.from\s*\(/.test(content)
      || /\b(?:supabase|db|database|client)\s*\.rpc\s*\(/.test(content)
      || /\b(?:query|execute)\s*\(\s*`?\s*(?:SELECT|INSERT|UPDATE|DELETE)\b/i.test(content);
  } catch {
    return false;
  }
}

function parseCreateTables(content: string, source: string): ScannedTable[] {
  const tables: ScannedTable[] = [];
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"?[\w-]+"?)\.)?"?([\w-]+)"?\s*\(/gi;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const openParenIndex = content.indexOf('(', match.index);
    const closeParenIndex = findMatchingParen(content, openParenIndex);
    if (openParenIndex === -1 || closeParenIndex === -1) continue;

    const columnsBlock = content.slice(openParenIndex + 1, closeParenIndex);
    tables.push({
      name: tableName,
      columns: splitSqlColumns(columnsBlock).map(parseSqlColumn).filter(Boolean) as ScannedColumn[],
      relationships: parseSqlRelationships(columnsBlock, source),
      source,
    });
  }

  return tables;
}

function parsePrismaModels(content: string, source: string): ScannedTable[] {
  const tables: ScannedTable[] = [];
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = modelRegex.exec(content)) !== null) {
    const [, modelName, body] = match;
    const mappedTable = body.match(/@@map\(["']([^"']+)["']\)/)?.[1];
    const columns: ScannedColumn[] = [];

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@') || line.startsWith('@')) continue;

      const fieldMatch = line.match(/^(\w+)\s+([\w\[\]]+)(\?)?/);
      if (!fieldMatch) continue;

      const [, fieldName, prismaType, optional] = fieldMatch;
      const mappedColumn = line.match(/@map\(["']([^"']+)["']\)/)?.[1];
      columns.push({
        name: mappedColumn || fieldName,
        type: normalizePrismaType(prismaType),
        nullable: optional === '?',
        constraints: line.includes('@id') ? ['PRIMARY KEY'] : line.includes('@unique') ? ['UNIQUE'] : undefined,
      });
    }

    tables.push({
      name: mappedTable || toSnakeCase(modelName),
      columns,
      relationships: parsePrismaRelationships(body, source),
      source,
    });
  }

  return tables;
}

function extractReferencedTables(
  content: string,
  filePath: string
): Array<{ name: string; columns: string[] }> {
  const tables = new Map<string, Set<string>>();
  const addTable = (name: string, columns: string[] = []) => {
    if (isFalsePositiveTable(name)) return;
    const existing = tables.get(name) || new Set<string>();
    columns.forEach((column) => existing.add(column));
    tables.set(name, existing);
  };

  const clientTablePattern =
    /\b(?:supabase|db|database|client)\s*[\r\n\t ]*\.[\r\n\t ]*from\(\s*["'`]([a-zA-Z_][\w-]*)["'`]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = clientTablePattern.exec(content)) !== null) {
    const nextStatement = content.indexOf(';', clientTablePattern.lastIndex);
    let segmentEnd = nextStatement === -1
      ? Math.min(content.length, clientTablePattern.lastIndex + 4000)
      : Math.min(nextStatement, clientTablePattern.lastIndex + 4000);
    const remainingSegment = content.slice(clientTablePattern.lastIndex, segmentEnd);
    const nextQuery = remainingSegment.search(
      /\b(?:supabase|db|database|client)\s*[\r\n\t ]*\.[\r\n\t ]*from\(/i
    );
    if (nextQuery >= 0) {
      segmentEnd = clientTablePattern.lastIndex + nextQuery;
    }
    addTable(
      match[1],
      extractSupabaseQueryColumns(content.slice(clientTablePattern.lastIndex, segmentEnd))
    );
  }

  const sqlSources = path.extname(filePath).toLowerCase() === '.sql'
    ? [content]
    : extractSqlStringLiterals(content);

  const sqlPatterns = [
    /\bSELECT\b[\s\S]{0,2000}?\bFROM\s+(?:(?:public|dbo)\.)?"?([a-zA-Z_][\w-]*)"?/gi,
    /\bINSERT\s+INTO\s+(?:(?:public|dbo)\.)?"?([a-zA-Z_][\w-]*)"?/gi,
    /\bUPDATE\s+(?:(?:public|dbo)\.)?"?([a-zA-Z_][\w-]*)"?\s+SET\b/gi,
    /\bDELETE\s+FROM\s+(?:(?:public|dbo)\.)?"?([a-zA-Z_][\w-]*)"?/gi,
    /\bJOIN\s+(?:(?:public|dbo)\.)?"?([a-zA-Z_][\w-]*)"?/gi,
  ];

  for (const sqlSource of sqlSources) {
    if (!/\b(?:SELECT|INSERT|UPDATE|DELETE)\b/i.test(sqlSource)) continue;

    for (const pattern of sqlPatterns) {
      pattern.lastIndex = 0;
      while ((match = pattern.exec(sqlSource)) !== null) {
        const tableName = match[1];
        if (tableName) addTable(tableName);
      }
    }
  }

  return Array.from(tables, ([name, columns]) => ({
    name,
    columns: Array.from(columns),
  }));
}

function extractSupabaseQueryColumns(segment: string): string[] {
  const columns = new Set<string>();
  const addColumn = (candidate: string) => {
    const normalized = candidate.trim().replace(/^.*:/, '').replace(/^.*\./, '');
    if (/^[a-zA-Z_]\w*$/.test(normalized)) columns.add(normalized);
  };

  const selectMatch = segment.match(/\.select\(\s*["'`]([\s\S]*?)["'`]\s*[\),]/);
  if (selectMatch) {
    for (const part of splitTopLevelSelectColumns(selectMatch[1])) {
      const candidate = part.trim();
      if (candidate !== '*' && !candidate.includes('(')) addColumn(candidate);
    }
  }

  const mutationPattern = /\.(?:insert|update|upsert)\(\s*\{([\s\S]*?)\}\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = mutationPattern.exec(segment)) !== null) {
    const keyPattern = /(?:^|,)\s*([a-zA-Z_]\w*)\s*:/g;
    let keyMatch: RegExpExecArray | null;
    while ((keyMatch = keyPattern.exec(match[1])) !== null) addColumn(keyMatch[1]);
  }

  const columnArgumentPattern =
    /\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|order)\(\s*["'`]([a-zA-Z_]\w*)["'`]/g;
  while ((match = columnArgumentPattern.exec(segment)) !== null) addColumn(match[1]);

  return Array.from(columns);
}

function splitTopLevelSelectColumns(selection: string): string[] {
  const columns: string[] = [];
  let current = '';
  let depth = 0;

  for (const character of selection) {
    if (character === '(') depth += 1;
    if (character === ')' && depth > 0) depth -= 1;

    if (character === ',' && depth === 0) {
      columns.push(current);
      current = '';
    } else {
      current += character;
    }
  }

  if (current.trim()) columns.push(current);
  return columns;
}

function extractSqlStringLiterals(content: string): string[] {
  const literals: string[] = [];
  const stringPattern = /(["'`])([\s\S]*?)\1/g;
  let match: RegExpExecArray | null;

  while ((match = stringPattern.exec(content)) !== null) {
    const value = match[2];
    if (/\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i.test(value)) {
      literals.push(value);
    }
  }

  return literals;
}

function parseSqlColumn(columnDefinition: string): ScannedColumn | null {
  const trimmed = columnDefinition.trim();
  if (!trimmed || /^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE)\b/i.test(trimmed)) {
    return null;
  }

  const match = trimmed.match(/^"?([\w-]+)"?\s+([\s\S]+)$/);
  if (!match) return null;

  const [, name, definition] = match;
  const constraintIndex = definition.search(
    /\s+(?=CONSTRAINT\b|NOT\s+NULL\b|NULL\b|DEFAULT\b|PRIMARY\s+KEY\b|UNIQUE\b|REFERENCES\b|CHECK\b|GENERATED\b|COLLATE\b)/i
  );
  const rawType = (constraintIndex === -1 ? definition : definition.slice(0, constraintIndex)).trim();
  const rest = constraintIndex === -1 ? '' : definition.slice(constraintIndex).trim();
  if (!rawType) return null;

  return {
    name,
    type: normalizeType(rawType),
    nullable: !/\b(?:NOT\s+NULL|PRIMARY\s+KEY)\b/i.test(rest),
    defaultValue: rest.match(/\bDEFAULT\s+(.+?)(?:\s+CONSTRAINT|\s+PRIMARY|\s+REFERENCES|\s+UNIQUE|\s+CHECK|$)/i)?.[1]?.trim(),
    constraints: [
      /\bPRIMARY\s+KEY\b/i.test(rest) ? 'PRIMARY KEY' : '',
      /\bUNIQUE\b/i.test(rest) ? 'UNIQUE' : '',
      /\bREFERENCES\b/i.test(rest) ? 'FOREIGN KEY' : '',
    ].filter(Boolean),
  };
}

function parseSqlRelationships(columnsBlock: string, source: string): ScannedRelationship[] {
  const relationships: ScannedRelationship[] = [];
  const inlineRegex = /"?([\w-]+)"?\s+[^,\n]+?\s+REFERENCES\s+(?:(?:"?[\w-]+"?)\.)?"?([\w-]+)"?\s*\(\s*"?([\w-]+)"?\s*\)/gi;
  const tableRegex = /FOREIGN\s+KEY\s*\(\s*"?([\w-]+)"?\s*\)\s+REFERENCES\s+(?:(?:"?[\w-]+"?)\.)?"?([\w-]+)"?\s*\(\s*"?([\w-]+)"?\s*\)/gi;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(columnsBlock)) !== null) {
    relationships.push({
      column: match[1],
      referencedTable: match[2],
      referencedColumn: match[3],
      source,
    });
  }

  while ((match = tableRegex.exec(columnsBlock)) !== null) {
    relationships.push({
      column: match[1],
      referencedTable: match[2],
      referencedColumn: match[3],
      source,
    });
  }

  return dedupeRelationships(relationships);
}

function parsePrismaRelationships(modelBody: string, source: string): ScannedRelationship[] {
  const relationships: ScannedRelationship[] = [];
  const relationRegex = /^(\w+)\s+\w+\??\s+@relation\([^)]*fields:\s*\[([^\]]+)\][^)]*references:\s*\[([^\]]+)\]/gm;
  let match: RegExpExecArray | null;

  while ((match = relationRegex.exec(modelBody)) !== null) {
    relationships.push({
      column: match[2].split(',')[0].trim(),
      referencedTable: toSnakeCase(match[1]),
      referencedColumn: match[3].split(',')[0].trim(),
      source,
    });
  }

  return dedupeRelationships(relationships);
}

function mergeTable(tableMap: Map<string, ScannedTable>, table: ScannedTable) {
  const key = table.name.toLowerCase();
  const existing = tableMap.get(key);
  if (!existing) {
    tableMap.set(key, table);
    return;
  }

  const columns = new Map(existing.columns.map((column) => [column.name.toLowerCase(), column]));
  for (const column of table.columns) {
    if (!columns.has(column.name.toLowerCase())) {
      columns.set(column.name.toLowerCase(), column);
    }
  }
  existing.columns = Array.from(columns.values());
  existing.columnsComplete = existing.columnsComplete !== false || table.columnsComplete !== false;
  existing.relationships = dedupeRelationships([
    ...(existing.relationships || []),
    ...(table.relationships || []),
  ]);
}

function dedupeRelationships(relationships: ScannedRelationship[]): ScannedRelationship[] {
  const byKey = new Map<string, ScannedRelationship>();
  for (const relationship of relationships) {
    const key = [
      relationship.column,
      relationship.referencedTable,
      relationship.referencedColumn || '',
    ].join(':').toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, relationship);
    }
  }
  return Array.from(byKey.values());
}

function findMatchingParen(content: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < content.length; i += 1) {
    if (content[i] === '(') depth += 1;
    if (content[i] === ')') depth -= 1;
    if (depth === 0) return i;
  }
  return -1;
}

function splitSqlColumns(block: string): string[] {
  const columns: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;

  for (const char of block) {
    if ((char === "'" || char === '"') && quote === null) quote = char;
    else if (char === quote) quote = null;

    if (!quote) {
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
    }

    if (char === ',' && depth === 0 && !quote) {
      columns.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) columns.push(current);
  return columns;
}

export function normalizeType(type: string): string {
  const base = String(type || 'text')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .split('(')[0];

  const map: Record<string, string> = {
    int: 'integer',
    int4: 'integer',
    integer: 'integer',
    serial: 'integer',
    int8: 'bigint',
    bigint: 'bigint',
    uuid: 'uuid',
    varchar: 'text',
    'character varying': 'text',
    char: 'text',
    text: 'text',
    bool: 'boolean',
    boolean: 'boolean',
    timestamptz: 'timestamptz',
    'timestamp with time zone': 'timestamptz',
    timestamp: 'timestamp',
    'timestamp without time zone': 'timestamp',
    datetime: 'timestamp',
    json: 'json',
    jsonb: 'jsonb',
    numeric: 'numeric',
    decimal: 'numeric',
    date: 'date',
    float8: 'double precision',
    'double precision': 'double precision',
  };

  return map[base] || base;
}

function normalizePrismaType(type: string): string {
  const isArray = type.endsWith('[]');
  const base = isArray ? type.slice(0, -2) : type;
  const map: Record<string, string> = {
    String: 'text',
    Int: 'integer',
    BigInt: 'bigint',
    Float: 'double precision',
    Decimal: 'numeric',
    Boolean: 'boolean',
    DateTime: 'timestamptz',
    Json: 'jsonb',
    Bytes: 'bytea',
  };
  return `${map[base] || base.toLowerCase()}${isArray ? '[]' : ''}`;
}

function buildCreateTableSql(table: ScannedTable): string {
  const columns = table.columns.length > 0
    ? table.columns.map((column) => `  ${quoteIdent(column.name)} ${column.type}${column.nullable ? '' : ' NOT NULL'}`)
    : ['  id uuid PRIMARY KEY DEFAULT gen_random_uuid()'];

  return `CREATE TABLE ${quoteIdent(table.name)} (\n${columns.join(',\n')}\n);`;
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function toSnakeCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function isFalsePositiveTable(tableName: string): boolean {
  return [
    'select',
    'insert',
    'update',
    'delete',
    'users',
  ].includes(tableName.toLowerCase()) && tableName.length < 5;
}
