/**
 * Schema type definitions for unified schema representation.
 * 
 * These types represent database schemas in a database-agnostic way,
 * allowing comparison across different database types.
 */

/**
 * Complete database schema.
 */
export interface DatabaseSchema {
  /**
   * Database type.
   */
  databaseType: string;
  
  /**
   * Schema name (for databases that support schemas).
   */
  schemaName?: string;
  
  /**
   * Database name.
   */
  databaseName?: string;
  
  /**
   * Tables in the schema.
   */
  tables: Table[];
  
  /**
   * Views in the schema.
   */
  views?: View[];
  
  /**
   * Enums in the schema.
   */
  enums?: Enum[];
  
  /**
   * Functions/stored procedures.
   */
  functions?: Function[];
  
  /**
   * Triggers.
   */
  triggers?: Trigger[];
  
  /**
   * Metadata about the schema.
   */
  metadata?: SchemaMetadata;
}

/**
 * Database table.
 */
export interface Table {
  /**
   * Table name.
   */
  name: string;
  
  /**
   * Schema name (if applicable).
   */
  schema?: string;
  
  /**
   * Columns in the table.
   */
  columns: Column[];
  
  /**
   * Primary key constraint.
   */
  primaryKey?: PrimaryKey;
  
  /**
   * Foreign keys.
   */
  foreignKeys?: ForeignKey[];
  
  /**
   * Indexes.
   */
  indexes?: Index[];
  
  /**
   * Unique constraints.
   */
  uniqueConstraints?: UniqueConstraint[];
  
  /**
   * Check constraints.
   */
  checkConstraints?: CheckConstraint[];
  
  /**
   * Table comment/description.
   */
  comment?: string;
  
  /**
   * Table type (table, view, materialized view, etc.).
   */
  type?: 'table' | 'view' | 'materialized_view';
}

/**
 * Table column.
 */
export interface Column {
  /**
   * Column name.
   */
  name: string;
  
  /**
   * Column data type.
   */
  type: ColumnType;
  
  /**
   * Is column nullable.
   */
  nullable: boolean;
  
  /**
   * Default value.
   */
  defaultValue?: any;
  
  /**
   * Is column auto-increment/identity.
   */
  autoIncrement?: boolean;
  
  /**
   * Column comment/description.
   */
  comment?: string;
  
  /**
   * Column position/order.
   */
  position?: number;
  
  /**
   * Column length/precision (for types like VARCHAR(255)).
   */
  length?: number;
  
  /**
   * Column precision (for decimal types).
   */
  precision?: number;
  
  /**
   * Column scale (for decimal types).
   */
  scale?: number;
  
  /**
   * Is column generated/computed.
   */
  generated?: boolean;
  
  /**
   * Generation expression (for generated columns).
   */
  generationExpression?: string;
  
  /**
   * Database-specific properties.
   */
  databaseSpecific?: Record<string, any>;
}

/**
 * Column data type (normalized).
 */
export interface ColumnType {
  /**
   * Base type name (normalized).
   */
  name: string;
  
  /**
   * Original database-specific type name.
   */
  originalName?: string;
  
  /**
   * Type category.
   */
  category: TypeCategory;
  
  /**
   * Type parameters (length, precision, scale, etc.).
   */
  parameters?: TypeParameters;
  
  /**
   * Is array type.
   */
  isArray?: boolean;
  
  /**
   * Is JSON type.
   */
  isJson?: boolean;
  
  /**
   * Enum values (if enum type).
   */
  enumValues?: string[];
  
  /**
   * Database-specific type information.
   */
  databaseSpecific?: Record<string, any>;
}

/**
 * Type category.
 */
export enum TypeCategory {
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Date = 'date',
  DateTime = 'datetime',
  Time = 'time',
  Binary = 'binary',
  Json = 'json',
  Array = 'array',
  Enum = 'enum',
  Decimal = 'decimal',
  Integer = 'integer',
  Float = 'float',
  UUID = 'uuid',
  Text = 'text',
  Blob = 'blob',
  Geometry = 'geometry',
  Other = 'other',
}

/**
 * Type parameters.
 */
export interface TypeParameters {
  /**
   * Length (for VARCHAR, CHAR, etc.).
   */
  length?: number;
  
  /**
   * Precision (for DECIMAL, NUMERIC, etc.).
   */
  precision?: number;
  
  /**
   * Scale (for DECIMAL, NUMERIC, etc.).
   */
  scale?: number;
  
  /**
   * Array dimensions (for array types).
   */
  dimensions?: number;
}

/**
 * Primary key constraint.
 */
export interface PrimaryKey {
  /**
   * Column names that form the primary key.
   */
  columns: string[];
  
  /**
   * Constraint name.
   */
  name?: string;
}

/**
 * Foreign key constraint.
 */
export interface ForeignKey {
  /**
   * Constraint name.
   */
  name: string;
  
  /**
   * Local column names.
   */
  columns: string[];
  
  /**
   * Referenced table name.
   */
  referencedTable: string;
  
  /**
   * Referenced schema (if applicable).
   */
  referencedSchema?: string;
  
  /**
   * Referenced column names.
   */
  referencedColumns: string[];
  
  /**
   * On delete action.
   */
  onDelete?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
  
  /**
   * On update action.
   */
  onUpdate?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
}

/**
 * Index definition.
 */
export interface Index {
  /**
   * Index name.
   */
  name: string;
  
  /**
   * Column names in the index.
   */
  columns: IndexColumn[];
  
  /**
   * Is unique index.
   */
  unique?: boolean;
  
  /**
   * Index type (B-tree, Hash, GIN, etc.).
   */
  type?: string;
  
  /**
   * Is partial index (with WHERE clause).
   */
  partial?: boolean;
  
  /**
   * Partial index expression.
   */
  where?: string;
}

/**
 * Index column.
 */
export interface IndexColumn {
  /**
   * Column name.
   */
  name: string;
  
  /**
   * Sort order (ASC, DESC).
   */
  order?: 'ASC' | 'DESC';
  
  /**
   * Nulls order (FIRST, LAST).
   */
  nullsOrder?: 'FIRST' | 'LAST';
  
  /**
   * Expression (for expression indexes).
   */
  expression?: string;
}

/**
 * Unique constraint.
 */
export interface UniqueConstraint {
  /**
   * Constraint name.
   */
  name: string;
  
  /**
   * Column names.
   */
  columns: string[];
  
  /**
   * Is deferrable.
   */
  deferrable?: boolean;
  
  /**
   * Initially deferred.
   */
  initiallyDeferred?: boolean;
}

/**
 * Check constraint.
 */
export interface CheckConstraint {
  /**
   * Constraint name.
   */
  name: string;
  
  /**
   * Check expression.
   */
  expression: string;
}

/**
 * Database view.
 */
export interface View {
  /**
   * View name.
   */
  name: string;
  
  /**
   * Schema name (if applicable).
   */
  schema?: string;
  
  /**
   * View definition (SQL).
   */
  definition: string;
  
  /**
   * Is materialized view.
   */
  materialized?: boolean;
  
  /**
   * View comment/description.
   */
  comment?: string;
}

/**
 * Enum type.
 */
export interface Enum {
  /**
   * Enum name.
   */
  name: string;
  
  /**
   * Schema name (if applicable).
   */
  schema?: string;
  
  /**
   * Enum values.
   */
  values: string[];
  
  /**
   * Enum comment/description.
   */
  comment?: string;
}

/**
 * Database function/stored procedure.
 */
export interface Function {
  /**
   * Function name.
   */
  name: string;
  
  /**
   * Schema name (if applicable).
   */
  schema?: string;
  
  /**
   * Function parameters.
   */
  parameters: FunctionParameter[];
  
  /**
   * Return type.
   */
  returnType?: string;
  
  /**
   * Function body/definition.
   */
  body?: string;
  
  /**
   * Function language.
   */
  language?: string;
}

/**
 * Function parameter.
 */
export interface FunctionParameter {
  /**
   * Parameter name.
   */
  name: string;
  
  /**
   * Parameter type.
   */
  type: string;
  
  /**
   * Parameter mode (IN, OUT, INOUT).
   */
  mode?: 'IN' | 'OUT' | 'INOUT';
  
  /**
   * Default value.
   */
  defaultValue?: any;
}

/**
 * Database trigger.
 */
export interface Trigger {
  /**
   * Trigger name.
   */
  name: string;
  
  /**
   * Schema name (if applicable).
   */
  schema?: string;
  
  /**
   * Table name.
   */
  table: string;
  
  /**
   * Trigger timing (BEFORE, AFTER, INSTEAD OF).
   */
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
  
  /**
   * Trigger events (INSERT, UPDATE, DELETE).
   */
  events: ('INSERT' | 'UPDATE' | 'DELETE')[];
  
  /**
   * Trigger function/procedure.
   */
  function: string;
  
  /**
   * Trigger condition (WHEN clause).
   */
  condition?: string;
}

/**
 * Schema metadata.
 */
export interface SchemaMetadata {
  /**
   * Schema version.
   */
  version?: string;
  
  /**
   * Last modified timestamp.
   */
  lastModified?: Date;
  
  /**
   * Database version.
   */
  databaseVersion?: string;
  
  /**
   * Character set.
   */
  characterSet?: string;
  
  /**
   * Collation.
   */
  collation?: string;
  
  /**
   * Additional metadata.
   */
  [key: string]: any;
}

