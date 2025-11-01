export interface CodeSchema {
  models: Model[];
  type: 'prisma' | 'typeorm' | 'raw-sql';
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

export interface Mismatch {
  type: 'missing_table' | 'missing_field' | 'type_mismatch' | 'extra_field' | 'constraint_mismatch';
  model: string;
  field?: string;
  codeValue?: any;
  dbValue?: any;
  severity: 'error' | 'warning' | 'info';
  suggestedFix?: string;
}

export interface SchemaDiff {
  mismatches: Mismatch[];
  warnings: string[];
  metadata: {
    codeVersion: string;
    dbVersion: string;
    timestamp: Date;
  };
}

export interface ScanOptions {
  path: string;
  db?: string;
  config?: string;
  projectId?: string; // Project ID from dashboard
  apiUrl?: string; // Dashboard API URL
  apiKey?: string; // API key / JWT token
  sync?: boolean; // Whether to sync to cloud (default: true if projectId is set)
  output?: string; // Output JSON results file path
  failOnWarnings?: boolean; // Exit with error code on warnings
  json?: boolean; // Output JSON instead of human-readable format
}

export interface InitOptions {
  path: string;
}

export interface Config {
  version: string;
  project: {
    name: string;
    schemaType: 'prisma' | 'typeorm' | 'raw-sql';
    id?: string; // Project ID from dashboard
  };
  database: {
    connectionString?: string;
    provider: 'postgresql' | 'mysql' | 'sqlite';
  };
  scan?: {
    watch?: boolean;
    autoFix?: boolean;
  };
  api?: {
    url?: string; // Dashboard API URL (e.g., http://localhost:3000)
    key?: string; // API key / JWT token
    enabled?: boolean; // Whether to send reports to cloud
  };
}

