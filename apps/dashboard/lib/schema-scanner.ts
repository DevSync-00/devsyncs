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

export type ApplicationReferenceKind =
  | 'schema'
  | 'query'
  | 'repository'
  | 'api'
  | 'job'
  | 'test'
  | 'ui'
  | 'migration'
  | 'unknown';

export interface ApplicationReference {
  id: string;
  table: string;
  column?: string;
  file: string;
  line: number;
  kind: ApplicationReferenceKind;
  operation: 'read' | 'write' | 'delete' | 'define' | 'unknown';
  excerpt: string;
  confidence: number;
}

export interface ImpactFinding {
  mismatchIndex: number;
  object: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
  score: number;
  breaking: boolean;
  references: ApplicationReference[];
  owners: string[];
  evidence: string[];
  compatibilityPlan: string[];
}

export interface ApplicationImpactReport {
  version: 1;
  generatedAt: string;
  summary: {
    score: number;
    risk: 'critical' | 'high' | 'medium' | 'low';
    breakingChanges: number;
    affectedFiles: number;
    affectedApis: number;
    affectedJobs: number;
    testCoverageFiles: number;
    ownerCoveragePercent: number;
  };
  references: ApplicationReference[];
  findings: ImpactFinding[];
  graph: {
    nodes: Array<{
      id: string;
      label: string;
      type: 'database' | 'schema' | 'code' | 'api' | 'job' | 'test' | 'owner';
      risk?: 'critical' | 'high' | 'medium' | 'low';
      metadata?: Record<string, string | number>;
    }>;
    edges: Array<{ id: string; source: string; target: string; label: string }>;
  };
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

/**
 * Builds an evidence-backed map from changed database objects to the application
 * files that use them. This is deliberately deterministic: AI may explain this
 * report later, but it never invents the underlying evidence.
 */
export function analyzeApplicationImpact(
  root: string,
  codeSchema: ScannedSchema,
  mismatches: SchemaMismatch[],
): ApplicationImpactReport {
  const files = collectFiles(root);
  const codeOwners = readCodeOwners(root);
  const tableNames = new Set(codeSchema.tables.map((table) => table.name.toLowerCase()));
  mismatches.forEach((mismatch) => tableNames.add((mismatch.table || mismatch.model).toLowerCase()));

  const references: ApplicationReference[] = [];
  for (const filePath of files) {
    const relativeFile = path.relative(root, filePath).replace(/\\/g, '/');
    const kind = classifyReferenceKind(relativeFile);
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      const normalized = line.toLowerCase();
      for (const table of tableNames) {
        if (!containsIdentifier(normalized, table)) continue;

        const schemaTable = codeSchema.tables.find((item) => item.name.toLowerCase() === table);
        const mentionedColumns = (schemaTable?.columns || [])
          .filter((column) => containsIdentifier(normalized, column.name.toLowerCase()))
          .map((column) => column.name);
        const operation = detectOperation(line);
        const baseConfidence = kind === 'schema' || kind === 'migration' ? 0.98 : operation === 'unknown' ? 0.68 : 0.88;

        references.push({
          id: `ref-${references.length + 1}`,
          table: schemaTable?.name || table,
          column: mentionedColumns.length === 1 ? mentionedColumns[0] : undefined,
          file: relativeFile,
          line: index + 1,
          kind,
          operation,
          excerpt: line.trim().slice(0, 220),
          confidence: baseConfidence,
        });
      }
    });
  }

  const deduplicated = Array.from(
    new Map(references.map((reference) => [
      `${reference.table}:${reference.column || '*'}:${reference.file}:${reference.line}`,
      reference,
    ])).values(),
  );

  const findings = mismatches.map((mismatch, mismatchIndex) => {
    const table = mismatch.table || mismatch.model;
    const column = mismatch.column || mismatch.field;
    const affected = deduplicated.filter((reference) => {
      if (reference.table.toLowerCase() !== table.toLowerCase()) return false;
      return !column || !reference.column || reference.column.toLowerCase() === column.toLowerCase();
    });
    const nonDefinitionReferences = affected.filter((reference) => !['schema', 'migration'].includes(reference.kind));
    const breaking = ['extra_table', 'extra_field', 'type_mismatch', 'nullable_mismatch'].includes(mismatch.type)
      && nonDefinitionReferences.length > 0;
    const score = calculateImpactScore(mismatch, nonDefinitionReferences);
    const owners = Array.from(new Set(
      affected.flatMap((reference) => ownersForFile(reference.file, codeOwners)),
    ));

    return {
      mismatchIndex,
      object: column ? `${table}.${column}` : table,
      risk: scoreToRisk(score),
      score,
      breaking,
      references: affected.slice(0, 50),
      owners,
      evidence: buildImpactEvidence(mismatch, nonDefinitionReferences),
      compatibilityPlan: buildCompatibilityPlan(mismatch, nonDefinitionReferences),
    };
  });

  const affectedReferences = findings.flatMap((finding) => finding.references)
    .filter((reference) => !['schema', 'migration'].includes(reference.kind));
  const affectedFiles = new Set(affectedReferences.map((reference) => reference.file));
  const maximumScore = findings.reduce((maximum, finding) => Math.max(maximum, finding.score), 0);
  const ownedFiles = new Set(
    affectedReferences.filter((reference) => ownersForFile(reference.file, codeOwners).length > 0)
      .map((reference) => reference.file),
  );

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    summary: {
      score: maximumScore,
      risk: scoreToRisk(maximumScore),
      breakingChanges: findings.filter((finding) => finding.breaking).length,
      affectedFiles: affectedFiles.size,
      affectedApis: new Set(affectedReferences.filter((reference) => reference.kind === 'api').map((reference) => reference.file)).size,
      affectedJobs: new Set(affectedReferences.filter((reference) => reference.kind === 'job').map((reference) => reference.file)).size,
      testCoverageFiles: new Set(affectedReferences.filter((reference) => reference.kind === 'test').map((reference) => reference.file)).size,
      ownerCoveragePercent: affectedFiles.size ? Math.round((ownedFiles.size / affectedFiles.size) * 100) : 100,
    },
    references: deduplicated,
    findings,
    graph: buildImpactGraph(findings),
  };
}

function containsIdentifier(line: string, identifier: string): boolean {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9_])${escaped}([^a-z0-9_]|$)`, 'i').test(line);
}

function classifyReferenceKind(file: string): ApplicationReferenceKind {
  const normalized = file.toLowerCase();
  if (/(\.test\.|\.spec\.|\/tests?\/|__tests__)/.test(normalized)) return 'test';
  if (/(migration|migrations|\.prisma$|schema\.)/.test(normalized)) return 'migration';
  if (/(\/api\/|route\.|controller|resolver)/.test(normalized)) return 'api';
  if (/(worker|queue|cron|schedule|job)/.test(normalized)) return 'job';
  if (/(repository|repositories|\/dao\/|service)/.test(normalized)) return 'repository';
  if (/(\.tsx$|\.jsx$|\/components\/|\/pages\/)/.test(normalized)) return 'ui';
  if (/(\.sql$|model|entity)/.test(normalized)) return 'schema';
  return 'query';
}

function detectOperation(line: string): ApplicationReference['operation'] {
  if (/\b(delete|drop|truncate|destroy)\b/i.test(line)) return 'delete';
  if (/\b(insert|update|upsert|create|save|set)\b/i.test(line)) return 'write';
  if (/\b(select|find|query|get|fetch|include|join)\b/i.test(line)) return 'read';
  if (/\b(table|model|entity|column|create table)\b/i.test(line)) return 'define';
  return 'unknown';
}

function calculateImpactScore(mismatch: SchemaMismatch, references: ApplicationReference[]): number {
  const base: Record<SchemaMismatch['type'], number> = {
    extra_table: 72,
    extra_field: 68,
    type_mismatch: 62,
    nullable_mismatch: 52,
    missing_table: 44,
    missing_field: 38,
    missing_relationship: 34,
    extra_relationship: 42,
  };
  const apiCount = references.filter((reference) => reference.kind === 'api').length;
  const jobCount = references.filter((reference) => reference.kind === 'job').length;
  const writeCount = references.filter((reference) => reference.operation === 'write').length;
  const testCount = references.filter((reference) => reference.kind === 'test').length;
  return Math.min(100, Math.max(0,
    base[mismatch.type] + Math.min(18, references.length * 2) + Math.min(10, apiCount * 3 + jobCount * 3 + writeCount * 2) - Math.min(8, testCount * 2),
  ));
}

function scoreToRisk(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function buildImpactEvidence(mismatch: SchemaMismatch, references: ApplicationReference[]): string[] {
  const evidence = [`${mismatch.message}`];
  const kinds = new Map<ApplicationReferenceKind, number>();
  references.forEach((reference) => kinds.set(reference.kind, (kinds.get(reference.kind) || 0) + 1));
  for (const [kind, count] of kinds) {
    evidence.push(`${count} ${kind} reference${count === 1 ? '' : 's'} found in application code.`);
  }
  const writes = references.filter((reference) => reference.operation === 'write').length;
  if (writes) evidence.push(`${writes} write path${writes === 1 ? '' : 's'} may require a compatibility window.`);
  if (!references.length) evidence.push('No direct application references were found; verify dynamic SQL and external consumers.');
  return evidence;
}

function buildCompatibilityPlan(mismatch: SchemaMismatch, references: ApplicationReference[]): string[] {
  const object = mismatch.field ? `${mismatch.model}.${mismatch.field}` : mismatch.model;
  if (['extra_field', 'extra_table', 'type_mismatch'].includes(mismatch.type) && references.length) {
    return [
      `Expand: introduce the replacement for ${object} without removing the current contract.`,
      `Migrate: update ${new Set(references.map((reference) => reference.file)).size} affected file${references.length === 1 ? '' : 's'} and backfill data where required.`,
      'Verify: deploy application readers and writers, replay critical queries, and monitor errors.',
      `Contract: remove ${object} only after all references and older clients are retired.`,
    ];
  }
  if (mismatch.type === 'nullable_mismatch') {
    return [
      `Measure existing null values for ${object}.`,
      'Backfill safely in bounded batches and add application validation.',
      'Apply the constraint only after a rehearsal confirms no violating rows.',
    ];
  }
  return [
    `Review the proposed schema change for ${object}.`,
    'Run migration rehearsal against a production-shaped preview database.',
    'Require an owner approval before promotion to production.',
  ];
}

type CodeOwnerRule = { pattern: string; owners: string[] };

function readCodeOwners(root: string): CodeOwnerRule[] {
  const candidates = [
    path.join(root, 'CODEOWNERS'),
    path.join(root, '.github', 'CODEOWNERS'),
    path.join(root, 'docs', 'CODEOWNERS'),
  ];
  const candidate = candidates.find(existsSync);
  if (!candidate) return [];
  return readFileSync(candidate, 'utf8').split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return [];
    const [pattern, ...owners] = trimmed.split(/\s+/);
    return owners.length ? [{ pattern, owners }] : [];
  });
}

function ownersForFile(file: string, rules: CodeOwnerRule[]): string[] {
  let owners: string[] = [];
  for (const rule of rules) {
    const doubleStarToken = '__DEVSYNC_DOUBLE_STAR__';
    const escaped = rule.pattern
      .replace(/^\/+/, '')
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, doubleStarToken)
      .replace(/\*/g, '[^/]*')
      .replace(new RegExp(doubleStarToken, 'g'), '.*');
    if (new RegExp(`^${escaped}${rule.pattern.endsWith('/') ? '.*' : ''}$`).test(file)) owners = rule.owners;
  }
  return owners;
}

function buildImpactGraph(findings: ImpactFinding[]): ApplicationImpactReport['graph'] {
  const nodes = new Map<string, ApplicationImpactReport['graph']['nodes'][number]>();
  const edges = new Map<string, ApplicationImpactReport['graph']['edges'][number]>();
  for (const finding of findings) {
    const databaseId = `db:${finding.object}`;
    nodes.set(databaseId, { id: databaseId, label: finding.object, type: 'database', risk: finding.risk });
    for (const reference of finding.references.slice(0, 30)) {
      const fileId = `file:${reference.file}`;
      const nodeType = reference.kind === 'api' || reference.kind === 'job' || reference.kind === 'test'
        ? reference.kind
        : reference.kind === 'schema' || reference.kind === 'migration' ? 'schema' : 'code';
      nodes.set(fileId, {
        id: fileId,
        label: reference.file.split('/').pop() || reference.file,
        type: nodeType,
        metadata: { file: reference.file, line: reference.line },
      });
      const edgeId = `${databaseId}->${fileId}`;
      edges.set(edgeId, { id: edgeId, source: databaseId, target: fileId, label: reference.operation });
    }
    for (const owner of finding.owners) {
      const ownerId = `owner:${owner}`;
      nodes.set(ownerId, { id: ownerId, label: owner, type: 'owner' });
      finding.references.forEach((reference) => {
        const fileId = `file:${reference.file}`;
        if (nodes.has(fileId)) {
          const edgeId = `${fileId}->${ownerId}`;
          edges.set(edgeId, { id: edgeId, source: fileId, target: ownerId, label: 'owned by' });
        }
      });
    }
  }
  return { nodes: Array.from(nodes.values()), edges: Array.from(edges.values()) };
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
