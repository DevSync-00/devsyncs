import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import chalk from 'chalk';
import type {
  ScanOptions,
  ScanResult,
  ConnectionStringFinding,
  SchemaFileFinding,
  OrmDetection,
  SqlFinding,
  OutputFormat,
} from '../types/index.js';

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

  const nextActions: string[] = [];
  if (connectionStrings.length > 0) {
    nextActions.push('Select connection for read-only live inspection (Phase 3).');
  } else if (schemaFiles.length > 0) {
    nextActions.push('Proceed to schema extraction from files (Phase 3).');
        } else {
    nextActions.push('Run deep code scan to infer schema intent (Phase 3).');
  }

  const result: ScanResult = {
    status: 'ok',
    root,
    connectionStrings,
    schemaFiles,
    ormDetections,
    sqlFindings,
    nextActions,
    warnings: [],
  };

  emitResult(format, result);
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

  console.log(chalk.blue('🔑 Connection strings'));
  if (result.connectionStrings.length === 0) {
    console.log(chalk.gray('  (none found)'));
        } else {
    for (const cs of result.connectionStrings) {
      console.log(chalk.gray(`  - ${cs.key} (${cs.source}${cs.file ? `:${cs.file}` : ''}) [conf ${Math.round(cs.confidence * 100)}%]`));
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
    findings.push({ source: 'env', key: 'DATABASE_URL', confidence: 0.9 });
  }

  for (const envFile of ENV_FILES) {
    const full = path.join(root, envFile);
    if (!fs.existsSync(full)) continue;
    const content = readLimitedText(full);
    const matches = Array.from(content.matchAll(/(DATABASE_URL|DB_URL|DB_CONNECTION|DATABASE_URI)\s*=\s*(.+)/gi));
    for (const match of matches) {
      const key = match[1];
      findings.push({ source: 'file', key, file: envFile, confidence: 0.85 });
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
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        findings.push({ source: 'file', key: 'detected_connection', file: rel, confidence: 0.75 });
      }
    }
    const envStyle = Array.from(content.matchAll(/(DATABASE_URL|DB_URL|DB_CONNECTION|DATABASE_URI)\s*[:=]\s*["']?([^\s"']+)/gi));
    for (const m of envStyle) {
      const key = m[1];
      findings.push({ source: 'file', key, file: rel, confidence: 0.78 });
    }
  }

  return dedupe(findings, (f) => `${f.source}:${f.key}:${f.file ?? ''}`);
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

