import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import chalk from 'chalk';
import type {
  ScanOptions,
  ScanResult,
  ConnectionStringFinding,
  DatabaseScanSummary,
  ProjectScanSummary,
  SchemaFileFinding,
  OrmDetection,
  SqlFinding,
  OutputFormat,
} from '../types/index.js';
import { scanDatabase, closeDatabaseConnections } from '../services/db-scanner.js';

const DEFAULT_IGNORES = new Set(['node_modules', '.git', '.devsync', '.turbo', '.next']);
const ENV_FILES = ['.env', '.env.local', '.env.development', '.env.production', '.env.test'];
const CONFIG_LIKE = ['config', 'config.json', 'config.yaml', 'config.yml', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
const CONNECTION_STRING_REGEXES = [
  /postgres(?:ql)?:\/\/[^\s'"]+/gi,
  /mysql:\/\/[^\s'"]+/gi,
  /mariadb:\/\/[^\s'"]+/gi,
  /sqlserver:\/\/[^\s'"]+/gi,
  /mongodb(?:\+srv)?:\/\/[^\s'"]+/gi,
  /sqlite:\/\/[^\s'"]+/gi,
];

export async function scanCommand(options: ScanOptions = {}): Promise<void> {
  const root = resolvePath(options.path ?? process.cwd());
  const format = (options.format || 'table') as OutputFormat;

  const guided = options.guided || false;

  if (options.allowDbWrites) {
    const message = 'DB writes are blocked in Phase 1. Remove --allow-db-writes.';
    emitResult(format, {
      status: 'error',
      root,
      connectionStrings: [],
      schemaFiles: [],
      ormDetections: [],
      sqlFindings: [],
      nextActions: [],
      warnings: [message],
      error: message,
    });
    return;
  }

  const logProgress = (pct: number, msg: string) => {
    if (format === 'table') {
      console.log(chalk.gray(`[${pct.toString().padStart(3, ' ')}%] ${msg}`));
    }
  };

  if (guided && format === 'table') {
    console.log(chalk.blue('🧭 Guided scan (read-only)\n'));
    console.log(chalk.gray('Steps: detect connection → detect schema files → detect ORM → detect SQL\n'));
  }

  logProgress(5, 'Loading ignore rules');
  const ignores = loadIgnoreSet(root);
  logProgress(15, 'Walking project files');
  const files = listFiles(root, ignores);

  logProgress(35, 'Detecting connection strings');
  const connectionStrings = detectConnectionStrings(files, root);
  logProgress(55, 'Detecting schema files');
  const schemaFiles = detectSchemaFiles(files, root);
  logProgress(70, 'Detecting ORM signatures');
  const ormDetections = detectOrms(files, root);
  logProgress(85, 'Detecting SQL files');
  const sqlFindings = detectSql(files, root);
  logProgress(92, 'Inspecting discovered databases');
  const inferredDatabases = inferProjectDatabases(schemaFiles, ormDetections, root);
  const inspectedDatabases = await inspectDatabases(connectionStrings);
  const databases = mergeDatabases(inferredDatabases, inspectedDatabases);

  const nextActions: string[] = [];
  if (databases.some((d) => d.reachable)) {
    nextActions.push('Review table details and run status/fix for reachable databases.');
  } else if (databases.length > 0) {
    nextActions.push('Configure a database URL to enable live introspection for detected project databases.');
  } else if (connectionStrings.length > 0) {
    nextActions.push('Validate DB connectivity and rerun scan for live database details.');
  } else if (schemaFiles.length > 0) {
    nextActions.push('Proceed to schema extraction from files (Phase 3).');
        } else {
    nextActions.push('Run deep code scan to infer schema intent (Phase 3).');
  }

  const result: ScanResult = {
    status: 'ok',
    root,
    connectionStrings,
    databases,
    projectSummary: buildProjectSummary({
      files,
      schemaFiles,
      ormDetections,
      sqlFindings,
      connectionStrings,
      databases,
    }),
    schemaFiles,
    ormDetections,
    sqlFindings,
    nextActions,
    warnings: [],
  };

  emitResult(format, result);
}

export function formatLastScan(value?: string | null): string {
  if (!value) {
    return 'Never';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function emitResult(format: OutputFormat, result: ScanResult) {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.status === 'error') {
    console.log(chalk.red(`❌ ${result.error}`));
    return;
  }
        
  console.log(chalk.blue('📂 Scan (read-only)'));
  console.log(chalk.gray(`Root: ${result.root}\n`));
  if (result.projectSummary) {
    const p = result.projectSummary;
    console.log(chalk.blue('📊 Project summary'));
    console.log(chalk.gray(`  - Files scanned: ${p.fileCount}`));
    console.log(chalk.gray(`  - Schema files: ${p.schemaFileCount}`));
    console.log(chalk.gray(`  - ORM signals: ${p.ormCount}`));
    console.log(chalk.gray(`  - SQL files: ${p.sqlFileCount}`));
    console.log(chalk.gray(`  - Databases detected: ${p.connectionStringCount}`));
    console.log(chalk.gray(`  - Reachable databases: ${p.reachableDatabaseCount}`));
  }

  console.log(chalk.blue('🔑 Connection strings'));
  if (result.connectionStrings.length === 0) {
    console.log(chalk.gray('  (none found)'));
        } else {
    for (const cs of result.connectionStrings) {
      const provider = cs.provider ? ` ${cs.provider}` : '';
      const valuePreview = cs.value ? ` ${maskConnectionString(cs.value)}` : '';
      console.log(chalk.gray(`  - ${cs.key}${provider}${valuePreview} (${cs.source}${cs.file ? `:${cs.file}` : ''}) [conf ${Math.round(cs.confidence * 100)}%]`));
    }
  }

  console.log(chalk.blue('\n🗄 Databases'));
  if (!result.databases || result.databases.length === 0) {
    console.log(chalk.gray('  (none detected)'));
  } else {
    for (const db of result.databases) {
      const reachability = db.reachable ? chalk.green('reachable') : chalk.yellow('unreachable');
      const detail = db.reachable
        ? `tables=${db.tableCount ?? 0}, sample=${(db.sampleTables || []).slice(0, 5).join(', ') || 'n/a'}`
        : db.error || 'connection failed';
      console.log(chalk.gray(`  - ${db.name} [${db.provider}] ${reachability} (${db.source}${db.file ? `:${db.file}` : ''})`));
      console.log(chalk.gray(`    ${db.connectionPreview}`));
      console.log(chalk.gray(`    ${detail}`));
    }
  }

  console.log(chalk.blue('\n📄 Schema files'));
  if (result.schemaFiles.length === 0) {
    console.log(chalk.gray('  (none found)'));
  } else {
    for (const f of result.schemaFiles) {
      console.log(chalk.gray(`  - ${f.type}: ${f.path} (${f.size} bytes)`));
    }
  }

  console.log(chalk.blue('\n🛠 ORM detections'));
  if (result.ormDetections.length === 0) {
    console.log(chalk.gray('  (none found)'));
    } else {
    for (const orm of result.ormDetections) {
      console.log(chalk.gray(`  - ${orm.orm}: ${orm.files.join(', ')}`));
    }
  }

  console.log(chalk.blue('\n📜 SQL findings'));
  if (result.sqlFindings.length === 0) {
    console.log(chalk.gray('  (none found)'));
      } else {
    for (const s of result.sqlFindings) {
      console.log(chalk.gray(`  - ${s.kind}: ${s.path}`));
    }
  }

  console.log(chalk.blue('\n➡️  Next actions'));
  for (const action of result.nextActions) {
    console.log(chalk.gray(`  - ${action}`));
  }

  // Guided recap and safety reminder
  if (result.connectionStrings.length === 0 && result.schemaFiles.length === 0 && result.sqlFindings.length === 0) {
    console.log(chalk.yellow('\n⚠️  No obvious schema signals found.'));
    console.log(chalk.gray('   Tip: Add a database URL or schema file for deeper analysis.'));
  }
}

function resolvePath(inputPath: string): string {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

function loadIgnoreSet(root: string): Set<string> {
  const set = new Set(DEFAULT_IGNORES);
  const ignoreFiles = ['.gitignore', '.devsyncignore'];
  for (const file of ignoreFiles) {
    const full = path.join(root, file);
    if (fs.existsSync(full)) {
      const lines = fs.readFileSync(full, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const simple = trimmed.replace(/\/+$/, '');
        if (simple) set.add(simple);
      }
    }
  }
  return set;
}

function listFiles(root: string, ignores: Set<string>): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (ignores.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
    } else {
        out.push(full);
      }
    }
  }
  return out;
}

function detectConnectionStrings(files: string[], root: string): ConnectionStringFinding[] {
  const findings: ConnectionStringFinding[] = [];

  if (process.env.DATABASE_URL) {
    findings.push({
      source: 'env',
      key: 'DATABASE_URL',
      confidence: 0.9,
      value: process.env.DATABASE_URL,
      provider: inferProvider(process.env.DATABASE_URL),
    });
  }

  for (const envFile of ENV_FILES) {
    const full = path.join(root, envFile);
    if (!fs.existsSync(full)) continue;
    const content = readLimitedText(full);
    const matches = Array.from(content.matchAll(/(DATABASE_URL|DB_URL|DB_CONNECTION|DATABASE_URI)\s*=\s*(.+)/gi));
    for (const match of matches) {
      const key = match[1];
      const rawValue = sanitizeConnectionValue(match[2]);
      findings.push({
        source: 'file',
        key,
        file: envFile,
        confidence: 0.85,
        value: rawValue,
        provider: inferProvider(rawValue),
      });
    }
  }

  const configCandidates = files.filter((f) => {
    const base = path.basename(f).toLowerCase();
    return CONFIG_LIKE.includes(base) || base.endsWith('.yml') || base.endsWith('.yaml') || base.endsWith('.json');
  });

  for (const file of configCandidates) {
    const rel = path.relative(root, file);
    const content = readLimitedText(file);
    for (const regex of CONNECTION_STRING_REGEXES) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const rawValue = sanitizeConnectionValue(match[0]);
        findings.push({
          source: 'file',
          key: 'detected_connection',
          file: rel,
          confidence: 0.75,
          value: rawValue,
          provider: inferProvider(rawValue),
        });
      }
    }
    const envStyle = Array.from(content.matchAll(/(DATABASE_URL|DB_URL|DB_CONNECTION|DATABASE_URI)\s*[:=]\s*["']?([^\s"']+)/gi));
    for (const m of envStyle) {
      const key = m[1];
      const rawValue = sanitizeConnectionValue(m[2]);
      findings.push({
        source: 'file',
        key,
        file: rel,
        confidence: 0.78,
        value: rawValue,
        provider: inferProvider(rawValue),
      });
    }
  }

  return dedupe(findings, (f) => `${f.source}:${f.key}:${f.file ?? ''}:${f.value ?? ''}`);
}

function detectSchemaFiles(files: string[], root: string): SchemaFileFinding[] {
  const results: SchemaFileFinding[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    const lower = rel.toLowerCase();
    if (lower.endsWith('.prisma')) {
      results.push(buildSchemaFinding(rel, 'prisma', file));
    } else if (lower.endsWith('.sql')) {
      const kind = lower.includes('migration') ? 'migration' : 'sql';
      results.push(buildSchemaFinding(rel, kind as any, file));
    } else if (lower.includes('migration') || lower.includes('migrations/')) {
      results.push(buildSchemaFinding(rel, 'migration', file));
    }
  }
  return dedupe(results, (f) => f.path);
}

function buildSchemaFinding(relPath: string, type: SchemaFileFinding['type'], full: string): SchemaFileFinding {
  const stat = fs.statSync(full);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  return { path: relPath, type, size: stat.size, sha256: hash };
}

function detectOrms(files: string[], root: string): OrmDetection[] {
  const orms: Record<OrmDetection['orm'], Set<string>> = {
    prisma: new Set(),
    typeorm: new Set(),
    sequelize: new Set(),
    drizzle: new Set(),
    mongoose: new Set(),
    knex: new Set(),
  };

  for (const file of files) {
    const rel = path.relative(root, file);
    const lower = rel.toLowerCase();
    if (lower.endsWith('.prisma')) orms.prisma.add(rel);
    if (lower.endsWith('drizzle.config.ts') || lower.endsWith('drizzle.config.mjs') || lower.endsWith('drizzle.config.js')) {
      orms.drizzle.add(rel);
    }
    if (lower.endsWith('typeorm.config.ts') || lower.endsWith('typeorm.config.js') || lower.includes('typeorm')) {
      orms.typeorm.add(rel);
    }
    if (lower.endsWith('sequelize.config.js') || lower.includes('sequelize')) {
      orms.sequelize.add(rel);
    }
    if (lower.includes('mongoose')) {
      orms.mongoose.add(rel);
    }
    if (lower.includes('knexfile')) {
      orms.knex.add(rel);
    }
    if (lower.includes('typeorm')) orms.typeorm.add(rel);
    if (lower.includes('sequelize')) orms.sequelize.add(rel);
    if (lower.includes('drizzle')) orms.drizzle.add(rel);
    if (lower.includes('mongoose')) orms.mongoose.add(rel);
    if (lower.includes('knex')) orms.knex.add(rel);
  }

  return Object.entries(orms)
    .filter(([, filesSet]) => filesSet.size > 0)
    .map(([orm, set]) => ({ orm: orm as OrmDetection['orm'], files: Array.from(set).sort() }));
}

function detectSql(files: string[], root: string): SqlFinding[] {
  const findings: SqlFinding[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    const lower = rel.toLowerCase();
    if (lower.endsWith('.sql')) {
      const kind = lower.includes('migration') || lower.includes('/migrations/') ? 'migration' : 'raw-sql';
      findings.push({ path: rel, kind });
    }
  }
  return dedupe(findings, (f) => `${f.path}:${f.kind}`);
}

function readLimitedText(filePath: string, maxBytes = 128 * 1024): string {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > maxBytes) return '';
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function dedupe<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function inspectDatabases(connectionStrings: ConnectionStringFinding[]): Promise<DatabaseScanSummary[]> {
  const summaries: DatabaseScanSummary[] = [];
  const candidates = connectionStrings.filter((c) => c.value && isLikelyLiveConnectionString(c.value));

  for (const candidate of candidates) {
    const connection = candidate.value!;
    const provider = inferProvider(connection) || candidate.provider || 'unknown';
    const schema = inferSchemaFromConnection(connection);
    const name = inferDatabaseName(connection);

    if (provider !== 'postgresql') {
      summaries.push({
        name,
        provider,
        source: candidate.source,
        key: candidate.key,
        file: candidate.file,
        connectionPreview: maskConnectionString(connection),
        reachable: false,
        schema,
        error: `Live introspection currently supports postgresql; detected ${provider}.`,
      });
      continue;
    }

    try {
      const dbSchema = await scanDatabase({
        connectionString: connection,
        schema: schema || 'public',
        showProgress: false,
        timeout: 15000,
      });
      summaries.push({
        name,
        provider,
        source: candidate.source,
        key: candidate.key,
        file: candidate.file,
        connectionPreview: maskConnectionString(connection),
        reachable: true,
        schema: schema || 'public',
        tableCount: dbSchema.models.length,
        modelCount: dbSchema.models.length,
        sampleTables: dbSchema.models.slice(0, 8).map((m) => m.name),
      });
    } catch (error) {
      summaries.push({
        name,
        provider,
        source: candidate.source,
        key: candidate.key,
        file: candidate.file,
        connectionPreview: maskConnectionString(connection),
        reachable: false,
        schema,
        error: error instanceof Error ? error.message : 'Unknown connection error',
      });
    } finally {
      await closeDatabaseConnections(connection);
    }
  }

  return summaries;
}

function inferProjectDatabases(
  schemaFiles: SchemaFileFinding[],
  ormDetections: OrmDetection[],
  root: string
): DatabaseScanSummary[] {
  const databases: DatabaseScanSummary[] = [];

  const hasSupabaseMigrations = schemaFiles.some((f) => f.path.toLowerCase().includes('supabase\\migrations') || f.path.toLowerCase().includes('supabase/migrations'));
  if (hasSupabaseMigrations) {
    const migrationTables = extractTableNamesFromSchemaFiles(schemaFiles, root, (p) => p.toLowerCase().includes('supabase\\migrations') || p.toLowerCase().includes('supabase/migrations'));
    databases.push({
      name: 'supabase_project_db',
      provider: 'postgresql',
      source: 'file',
      key: 'supabase_migrations',
      file: 'supabase/migrations',
      connectionPreview: '(connection not configured)',
      reachable: false,
      schema: 'public',
      tableCount: migrationTables.length,
      sampleTables: migrationTables.slice(0, 8),
      error: 'Detected from project migrations only. Add DATABASE_URL for live introspection.',
    });
  }

  if (ormDetections.some((o) => o.orm === 'prisma')) {
    databases.push({
      name: 'prisma_project_db',
      provider: 'postgresql',
      source: 'file',
      key: 'prisma_schema',
      file: 'prisma/schema.prisma',
      connectionPreview: '(connection not configured)',
      reachable: false,
      error: 'Detected from Prisma schema only. Add DATABASE_URL for live introspection.',
    });
  }

  return databases;
}

function mergeDatabases(
  inferred: DatabaseScanSummary[],
  inspected: DatabaseScanSummary[]
): DatabaseScanSummary[] {
  const map = new Map<string, DatabaseScanSummary>();
  for (const db of inferred) {
    map.set(`${db.provider}:${db.name}:${db.key}:${db.file ?? ''}`, db);
  }
  for (const db of inspected) {
    map.set(`${db.provider}:${db.name}:${db.key}:${db.file ?? ''}`, db);
  }
  return Array.from(map.values());
}

function extractTableNamesFromSchemaFiles(
  schemaFiles: SchemaFileFinding[],
  root: string,
  includePath: (relativePath: string) => boolean
): string[] {
  const tableNames = new Set<string>();
  const createTableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?)/gi;

  for (const schemaFile of schemaFiles) {
    if (!includePath(schemaFile.path)) continue;
    const fullPath = path.join(root, schemaFile.path);
    const content = readLimitedText(fullPath, 256 * 1024);
    createTableRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = createTableRegex.exec(content)) !== null) {
      const table = match[2]?.toLowerCase();
      if (table) tableNames.add(table);
    }
  }

  return Array.from(tableNames).sort();
}

function buildProjectSummary(input: {
  files: string[];
  schemaFiles: SchemaFileFinding[];
  ormDetections: OrmDetection[];
  sqlFindings: SqlFinding[];
  connectionStrings: ConnectionStringFinding[];
  databases: DatabaseScanSummary[];
}): ProjectScanSummary {
  return {
    fileCount: input.files.length,
    schemaFileCount: input.schemaFiles.length,
    ormCount: input.ormDetections.length,
    sqlFileCount: input.sqlFindings.length,
    connectionStringCount: input.databases.length,
    reachableDatabaseCount: input.databases.filter((d) => d.reachable).length,
  };
}

function sanitizeConnectionValue(raw: string): string {
  return raw.trim().replace(/^['"]/, '').replace(/['"]$/, '').split(/\s+/)[0];
}

function inferProvider(value?: string): string | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower.startsWith('postgres://') || lower.startsWith('postgresql://')) return 'postgresql';
  if (lower.startsWith('mysql://')) return 'mysql';
  if (lower.startsWith('mariadb://')) return 'mariadb';
  if (lower.startsWith('sqlite://')) return 'sqlite';
  if (lower.startsWith('sqlserver://')) return 'sqlserver';
  if (lower.startsWith('mongodb://') || lower.startsWith('mongodb+srv://')) return 'mongodb';
  return 'unknown';
}

function inferDatabaseName(connection: string): string {
  try {
    const url = new URL(connection);
    const dbName = url.pathname.replace(/^\//, '') || 'unknown';
    return dbName;
  } catch {
    return 'unknown';
  }
}

function inferSchemaFromConnection(connection: string): string | undefined {
  try {
    const url = new URL(connection);
    const schema = url.searchParams.get('schema');
    return schema || undefined;
  } catch {
    return undefined;
  }
}

function maskConnectionString(connection: string): string {
  try {
    const url = new URL(connection);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return connection.replace(/:[^:@/]+@/, ':***@');
  }
}

function isLikelyLiveConnectionString(connection: string): boolean {
  return /^(postgres|postgresql|mysql|mariadb|sqlite|sqlserver):\/\//i.test(connection);
}

