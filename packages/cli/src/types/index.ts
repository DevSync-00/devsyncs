export type OutputFormat = 'json' | 'table';

// Schema types (used by extraction and normalization)
export interface CodeSchema {
  models: Model[];
  type: 'prisma' | 'typeorm' | 'raw-sql' | 'sequelize' | 'drizzle' | 'mongoose' | 'knex';
}

export interface DbSchema {
  models: Model[];
  type: 'postgresql' | 'mysql' | 'sqlite';
}

export interface Model {
  name: string;
  fields: Field[];
}

export interface Field {
  name: string;
  type: string;
  nullable?: boolean;
  defaultValue?: any;
  constraints?: string[];
}

export interface ScanOptions {
  path?: string;
  format?: OutputFormat;
  planOnly?: boolean;
  allowWrites?: boolean;
  allowDbWrites?: boolean;
  yes?: boolean;
  guided?: boolean;
  project?: string;
  config?: string;
  local?: boolean;
}

export interface StatusOptions {
  path?: string;
  format?: OutputFormat;
  config?: string;
  db?: string;
}

export interface InitOptions {
  path: string;
  wizard?: boolean;
}

export interface Config {
  version: string;
  project: {
    name: string;
    schemaType?: string;
    id?: string;
  };
  database: {
    mode: 'auto' | 'url' | 'skip';
    connectionString?: string;
    writeAccess: boolean;
  };
  ai: {
    provider?: 'openai' | 'anthropic' | 'ollama';
    apiKey?: string; // User-provided API key (never use service-configured)
    model?: {
      reasoning?: string;
      apply?: string;
      autocomplete?: string;
    };
    ollamaUrl?: string; // For local Ollama
  };
  safety: {
    allowWrites: boolean;
    allowDbWrites: boolean;
    requirePlanApproval: boolean;
  };
  paths?: {
    ignores?: string[];
  };
}

export interface ConnectionStringFinding {
  source: 'env' | 'file';
  key: string;
  file?: string;
  confidence: number;
  value?: string;
  provider?: string;
}

export interface SchemaFileFinding {
  path: string;
  type: 'sql' | 'prisma' | 'migration' | 'orm';
  size: number;
  sha256: string;
}

export interface OrmDetection {
  orm: 'prisma' | 'typeorm' | 'sequelize' | 'drizzle' | 'mongoose' | 'knex';
  files: string[];
}

export interface SqlFinding {
  path: string;
  kind: 'migration' | 'raw-sql';
}

export interface ScanResult {
  status: 'ok' | 'error';
  root: string;
  connectionStrings: ConnectionStringFinding[];
  databases?: DatabaseScanSummary[];
  projectSummary?: ProjectScanSummary;
  schemaFiles: SchemaFileFinding[];
  ormDetections: OrmDetection[];
  sqlFindings: SqlFinding[];
  nextActions: string[];
  warnings: string[];
  error?: string;
}

export interface DatabaseScanSummary {
  name: string;
  provider: string;
  source: 'env' | 'file';
  key: string;
  file?: string;
  connectionPreview: string;
  reachable: boolean;
  error?: string;
  schema?: string;
  tableCount?: number;
  modelCount?: number;
  sampleTables?: string[];
}

export interface ProjectScanSummary {
  fileCount: number;
  schemaFileCount: number;
  ormCount: number;
  sqlFileCount: number;
  connectionStringCount: number;
  reachableDatabaseCount: number;
}

// Legacy/compatibility types used by diff/migration utilities
export interface Mismatch {
  type:
    | 'missing_table'
    | 'extra_table'
    | 'missing_field'
    | 'extra_field'
    | 'type_mismatch'
    | 'constraint_mismatch';
  model: string;
  field?: string;
  codeValue?: any;
  dbValue?: any;
  severity?: 'info' | 'warning' | 'error';
  suggestedFix?: string;
}

export interface SchemaDiff {
  mismatches: Mismatch[];
  warnings?: string[];
  metadata?: {
    codeVersion?: string;
    dbVersion?: string;
    timestamp?: Date;
  };
}

export interface DatabaseColumn {
  name: string;
  type?: string;
  nullable?: boolean;
  constraints?: string[];
  defaultValue?: any;
}

export interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
  constraints?: string[];
  indexes?: string[];
}

