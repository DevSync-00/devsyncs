/**
 * Comprehensive type definitions for schema objects
 */

/**
 * Prisma schema model definition
 */
export interface PrismaModel {
  name: string;
  fields: PrismaField[];
  attributes?: PrismaAttribute[];
}

/**
 * Prisma field definition
 */
export interface PrismaField {
  name: string;
  type: string;
  isOptional: boolean;
  isList: boolean;
  attributes?: PrismaAttribute[];
  relation?: PrismaRelation;
}

/**
 * Prisma attribute (e.g., @id, @default, @relation)
 */
export interface PrismaAttribute {
  name: string;
  args?: string[];
}

/**
 * Prisma relation definition
 */
export interface PrismaRelation {
  model: string;
  fields?: string[];
  references?: string[];
}

/**
 * Database schema table definition
 */
export interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
  constraints?: DatabaseConstraint[];
  indexes?: DatabaseIndex[];
}

/**
 * Database column definition
 */
export interface DatabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey?: boolean;
  isUnique?: boolean;
  foreignKey?: ForeignKeyReference;
}

/**
 * Database constraint definition
 */
export interface DatabaseConstraint {
  name: string;
  type: 'PRIMARY_KEY' | 'FOREIGN_KEY' | 'UNIQUE' | 'CHECK';
  columns: string[];
  references?: ForeignKeyReference;
}

/**
 * Database index definition
 */
export interface DatabaseIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

/**
 * Foreign key reference
 */
export interface ForeignKeyReference {
  table: string;
  column: string;
}

/**
 * Schema value types (for codeValue and dbValue in mismatches)
 */
export type SchemaValue = 
  | string 
  | number 
  | boolean 
  | null 
  | SchemaValue[] 
  | { [key: string]: SchemaValue };

/**
 * Discriminated union for mismatch types with specific payloads
 */
export type MismatchType = 
  | { type: 'missing_table'; model: string }
  | { type: 'missing_field'; model: string; field: string }
  | { type: 'type_mismatch'; model: string; field: string; codeValue: SchemaValue; dbValue: SchemaValue }
  | { type: 'extra_field'; model: string; field: string; dbValue: SchemaValue }
  | { type: 'constraint_mismatch'; model: string; field?: string; codeValue?: SchemaValue; dbValue?: SchemaValue };

