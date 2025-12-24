import type { CodeSchema, DbSchema, Model, Field } from '../types/index.js';

/**
 * Canonical Schema Format
 * 
 * This is the unified format that all schema sources are converted into
 * before comparison. It ensures deterministic comparisons regardless of source.
 */
export interface CanonicalSchema {
  tables: CanonicalTable[];
  metadata: {
    source: string; // 'code' | 'database'
    sourceType: string; // 'prisma' | 'postgresql' | 'typeorm' | etc.
    timestamp: Date;
  };
}

export interface CanonicalTable {
  name: string;
  columns: CanonicalColumn[];
  indexes?: CanonicalIndex[];
  constraints?: CanonicalConstraint[];
  relations?: CanonicalRelation[];
}

export interface CanonicalColumn {
  name: string;
  type: string; // Normalized PostgreSQL type
  nullable: boolean;
  defaultValue?: any;
  constraints?: string[]; // PRIMARY KEY, UNIQUE, etc.
}

export interface CanonicalIndex {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface CanonicalConstraint {
  name: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
  columns: string[];
  references?: {
    table: string;
    column: string;
  };
}

export interface CanonicalRelation {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  from: { table: string; column: string };
  to: { table: string; column: string };
}

/**
 * Normalize CodeSchema to CanonicalSchema
 */
export function normalizeCodeSchema(codeSchema: CodeSchema): CanonicalSchema {
  return {
    tables: codeSchema.models.map(model => normalizeModelToTable(model)),
    metadata: {
      source: 'code',
      sourceType: codeSchema.type,
      timestamp: new Date()
    }
  };
}

/**
 * Normalize DbSchema to CanonicalSchema
 */
export function normalizeDbSchema(dbSchema: DbSchema): CanonicalSchema {
  return {
    tables: dbSchema.models.map(model => normalizeModelToTable(model)),
    metadata: {
      source: 'database',
      sourceType: dbSchema.type,
      timestamp: new Date()
    }
  };
}

/**
 * Normalize a Model to CanonicalTable
 */
function normalizeModelToTable(model: Model): CanonicalTable {
  const columns: CanonicalColumn[] = model.fields.map(field => normalizeFieldToColumn(field));
  
  // Extract indexes and constraints from fields
  const indexes: CanonicalIndex[] = [];
  const constraints: CanonicalConstraint[] = [];
  
  for (const field of model.fields) {
    if (field.constraints) {
      for (const constraint of field.constraints) {
        if (constraint === 'PRIMARY KEY') {
          constraints.push({
            name: `${model.name}_pkey`,
            type: 'PRIMARY KEY',
            columns: [field.name]
          });
        } else if (constraint === 'UNIQUE') {
          indexes.push({
            name: `${model.name}_${field.name}_unique`,
            columns: [field.name],
            unique: true
          });
        }
      }
    }
  }

  return {
    name: model.name,
    columns,
    indexes: indexes.length > 0 ? indexes : undefined,
    constraints: constraints.length > 0 ? constraints : undefined
  };
}

/**
 * Normalize a Field to CanonicalColumn
 */
function normalizeFieldToColumn(field: Field): CanonicalColumn {
  return {
    name: field.name,
    type: normalizeType(field.type),
    nullable: field.nullable !== false, // Default to nullable if not specified
    defaultValue: field.defaultValue,
    constraints: field.constraints
  };
}

/**
 * Normalize database type to canonical PostgreSQL type
 * 
 * This is the core normalization function that ensures all types
 * are converted to a standard format for comparison.
 */
export function normalizeType(type: string): string {
  if (!type) return 'text';

  // Normalize to lowercase and trim
  let normalized = type.toLowerCase().trim();

  // Remove array brackets for comparison (we'll add them back if needed)
  const isArray = normalized.endsWith('[]') || normalized.includes('[]');
  normalized = normalized.replace(/\[\]$/g, '').replace(/\[\]/g, '');

  // Extract base type (remove length/precision/scale)
  const baseType = normalized.split('(')[0].trim();

  // Map to canonical PostgreSQL types
  const typeMap: Record<string, string> = {
    // Text types
    'varchar': 'text',
    'char': 'text',
    'character': 'text',
    'character varying': 'text',
    'text': 'text',
    'string': 'text',
    
    // Integer types
    'int': 'integer',
    'int2': 'smallint',
    'int4': 'integer',
    'int8': 'bigint',
    'smallint': 'smallint',
    'integer': 'integer',
    'bigint': 'bigint',
    'serial': 'integer',
    'bigserial': 'bigint',
    
    // Float types
    'float': 'double precision',
    'float4': 'real',
    'float8': 'double precision',
    'real': 'real',
    'double': 'double precision',
    'double precision': 'double precision',
    
    // Decimal types
    'numeric': 'numeric',
    'decimal': 'numeric',
    
    // Boolean
    'bool': 'boolean',
    'boolean': 'boolean',
    
    // Date/Time types
    'timestamp': 'timestamp',
    'timestamp without time zone': 'timestamp',
    'timestamptz': 'timestamptz',
    'timestamp with time zone': 'timestamptz',
    'date': 'date',
    'time': 'time',
    'time without time zone': 'time',
    'timetz': 'timetz',
    'time with time zone': 'timetz',
    
    // JSON types
    'json': 'json',
    'jsonb': 'jsonb',
    
    // Other types
    'bytea': 'bytea',
    'bytes': 'bytea',
    'uuid': 'uuid',
    'inet': 'inet',
    'cidr': 'cidr',
    'macaddr': 'macaddr',
  };

  const canonicalType = typeMap[baseType] || baseType;

  // Add array brackets back if original was array
  return isArray ? `${canonicalType}[]` : canonicalType;
}

/**
 * Compare two canonical schemas and return differences
 * 
 * This provides a more structured comparison than the basic diff-engine
 */
export function compareCanonicalSchemas(
  codeSchema: CanonicalSchema,
  dbSchema: CanonicalSchema
): SchemaComparison {
  const differences: SchemaDifference[] = [];
  
  // Create lookup maps
  const codeTablesMap = new Map(codeSchema.tables.map(t => [t.name.toLowerCase(), t]));
  const dbTablesMap = new Map(dbSchema.tables.map(t => [t.name.toLowerCase(), t]));

  // Check each table in code schema
  for (const codeTable of codeSchema.tables) {
    const dbTable = dbTablesMap.get(codeTable.name.toLowerCase());
    
    if (!dbTable) {
      differences.push({
        type: 'missing_table',
        table: codeTable.name,
        severity: 'error',
        message: `Table "${codeTable.name}" exists in code but not in database`,
        codeValue: codeTable,
        dbValue: null
      });
      continue;
    }

    // Compare columns
    const columnDiffs = compareTableColumns(codeTable, dbTable);
    differences.push(...columnDiffs);
  }

  // Check for extra tables in database
  for (const dbTable of dbSchema.tables) {
    const codeTable = codeTablesMap.get(dbTable.name.toLowerCase());
    
    if (!codeTable) {
      differences.push({
        type: 'extra_table',
        table: dbTable.name,
        severity: 'info',
        message: `Table "${dbTable.name}" exists in database but not in code`,
        codeValue: null,
        dbValue: dbTable
      });
    }
  }

  return {
    differences,
    summary: {
      total: differences.length,
      errors: differences.filter(d => d.severity === 'error').length,
      warnings: differences.filter(d => d.severity === 'warning').length,
      infos: differences.filter(d => d.severity === 'info').length
    }
  };
}

function compareTableColumns(
  codeTable: CanonicalTable,
  dbTable: CanonicalTable
): SchemaDifference[] {
  const differences: SchemaDifference[] = [];
  
  const codeColumnsMap = new Map(codeTable.columns.map(c => [c.name.toLowerCase(), c]));
  const dbColumnsMap = new Map(dbTable.columns.map(c => [c.name.toLowerCase(), c]));

  // Check each column in code table
  for (const codeColumn of codeTable.columns) {
    const dbColumn = dbColumnsMap.get(codeColumn.name.toLowerCase());
    
    if (!dbColumn) {
      differences.push({
        type: 'missing_column',
        table: codeTable.name,
        column: codeColumn.name,
        severity: 'error',
        message: `Column "${codeColumn.name}" in table "${codeTable.name}" exists in code but not in database`,
        codeValue: codeColumn,
        dbValue: null
      });
      continue;
    }

    // Compare type
    if (codeColumn.type !== dbColumn.type) {
      differences.push({
        type: 'type_mismatch',
        table: codeTable.name,
        column: codeColumn.name,
        severity: 'warning',
        message: `Type mismatch for column "${codeColumn.name}" in table "${codeTable.name}": code expects ${codeColumn.type} but database has ${dbColumn.type}`,
        codeValue: codeColumn.type,
        dbValue: dbColumn.type
      });
    }

    // Compare nullable
    if (codeColumn.nullable !== dbColumn.nullable) {
      differences.push({
        type: 'nullable_mismatch',
        table: codeTable.name,
        column: codeColumn.name,
        severity: 'warning',
        message: `Nullable mismatch for column "${codeColumn.name}" in table "${codeTable.name}": code expects ${codeColumn.nullable ? 'nullable' : 'not null'} but database has ${dbColumn.nullable ? 'nullable' : 'not null'}`,
        codeValue: codeColumn.nullable,
        dbValue: dbColumn.nullable
      });
    }
  }

  // Check for extra columns in database
  for (const dbColumn of dbTable.columns) {
    const codeColumn = codeColumnsMap.get(dbColumn.name.toLowerCase());
    
    if (!codeColumn) {
      differences.push({
        type: 'extra_column',
        table: codeTable.name,
        column: dbColumn.name,
        severity: 'info',
        message: `Column "${dbColumn.name}" in table "${codeTable.name}" exists in database but not in code`,
        codeValue: null,
        dbValue: dbColumn
      });
    }
  }

  return differences;
}

export interface SchemaComparison {
  differences: SchemaDifference[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
}

export interface SchemaDifference {
  type: 'missing_table' | 'extra_table' | 'missing_column' | 'extra_column' | 'type_mismatch' | 'nullable_mismatch';
  table: string;
  column?: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  codeValue: any;
  dbValue: any;
}
