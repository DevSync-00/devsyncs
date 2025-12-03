/**
 * Runtime type validation using Zod
 */

import { z } from 'zod';
import { PrismaModel, DatabaseTable, SchemaValue } from './schema';

/**
 * Schema value validator
 */
export const schemaValueSchema: z.ZodType<SchemaValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(schemaValueSchema),
    z.record(schemaValueSchema),
  ])
);

/**
 * Prisma model schema
 */
export const prismaModelSchema = z.object({
  name: z.string(),
  fields: z.array(z.object({
    name: z.string(),
    type: z.string(),
    isOptional: z.boolean(),
    isList: z.boolean(),
    attributes: z.array(z.object({
      name: z.string(),
      args: z.array(z.string()).optional(),
    })).optional(),
    relation: z.object({
      model: z.string(),
      fields: z.array(z.string()).optional(),
      references: z.array(z.string()).optional(),
    }).optional(),
  })),
  attributes: z.array(z.object({
    name: z.string(),
    args: z.array(z.string()).optional(),
  })).optional(),
});

/**
 * Database table schema
 */
export const databaseTableSchema = z.object({
  name: z.string(),
  columns: z.array(z.object({
    name: z.string(),
    type: z.string(),
    nullable: z.boolean(),
    defaultValue: z.string().optional(),
    isPrimaryKey: z.boolean().optional(),
    isUnique: z.boolean().optional(),
    foreignKey: z.object({
      table: z.string(),
      column: z.string(),
    }).optional(),
  })),
  constraints: z.array(z.object({
    name: z.string(),
    type: z.enum(['PRIMARY_KEY', 'FOREIGN_KEY', 'UNIQUE', 'CHECK']),
    columns: z.array(z.string()),
    references: z.object({
      table: z.string(),
      column: z.string(),
    }).optional(),
  })).optional(),
  indexes: z.array(z.object({
    name: z.string(),
    columns: z.array(z.string()),
    unique: z.boolean(),
  })).optional(),
});

/**
 * Mismatch schemas (discriminated unions)
 */
export const missingTableMismatchSchema = z.object({
  type: z.literal('missing_table'),
  model: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
});

export const missingFieldMismatchSchema = z.object({
  type: z.literal('missing_field'),
  model: z.string(),
  field: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
});

export const typeMismatchSchema = z.object({
  type: z.literal('type_mismatch'),
  model: z.string(),
  field: z.string(),
  codeValue: schemaValueSchema,
  dbValue: schemaValueSchema,
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
});

export const extraFieldMismatchSchema = z.object({
  type: z.literal('extra_field'),
  model: z.string(),
  field: z.string(),
  dbValue: schemaValueSchema,
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
});

export const constraintMismatchSchema = z.object({
  type: z.literal('constraint_mismatch'),
  model: z.string(),
  field: z.string().optional(),
  codeValue: schemaValueSchema.optional(),
  dbValue: schemaValueSchema.optional(),
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
});

/**
 * Union schema for all mismatch types
 */
export const mismatchSchema = z.discriminatedUnion('type', [
  missingTableMismatchSchema,
  missingFieldMismatchSchema,
  typeMismatchSchema,
  extraFieldMismatchSchema,
  constraintMismatchSchema,
]);

/**
 * Scan report schema
 */
export const scanReportSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  mismatches: z.array(mismatchSchema),
  codeSchema: z.array(prismaModelSchema).optional(),
  dbSchema: z.array(databaseTableSchema).optional(),
  created_at: z.string(),
  completed_at: z.string().nullable().optional(),
});

/**
 * Migration schema
 */
export const migrationSchema = z.object({
  id: z.string(),
  filename: z.string(),
  content: z.string(),
  format: z.string(),
  applied: z.boolean(),
  created_at: z.string(),
});

/**
 * Type guard functions
 */
export function isMissingTableMismatch(mismatch: unknown): mismatch is import('../api').MissingTableMismatch {
  return missingTableMismatchSchema.safeParse(mismatch).success;
}

export function isMissingFieldMismatch(mismatch: unknown): mismatch is import('../api').MissingFieldMismatch {
  return missingFieldMismatchSchema.safeParse(mismatch).success;
}

export function isTypeMismatch(mismatch: unknown): mismatch is import('../api').TypeMismatch {
  return typeMismatchSchema.safeParse(mismatch).success;
}

export function isExtraFieldMismatch(mismatch: unknown): mismatch is import('../api').ExtraFieldMismatch {
  return extraFieldMismatchSchema.safeParse(mismatch).success;
}

export function isConstraintMismatch(mismatch: unknown): mismatch is import('../api').ConstraintMismatch {
  return constraintMismatchSchema.safeParse(mismatch).success;
}

/**
 * Validate and parse with error handling
 */
export function validateScanReport(data: unknown): import('../api').ScanReport {
  return scanReportSchema.parse(data);
}

export function validateMismatch(data: unknown): import('../api').Mismatch {
  return mismatchSchema.parse(data);
}

export function validateMigration(data: unknown): import('../api').Migration {
  return migrationSchema.parse(data);
}

/**
 * Safe parse (returns result instead of throwing)
 */
export function safeParseScanReport(data: unknown): z.SafeParseReturnType<unknown, import('../api').ScanReport> {
  return scanReportSchema.safeParse(data);
}

export function safeParseMismatch(data: unknown): z.SafeParseReturnType<unknown, import('../api').Mismatch> {
  return mismatchSchema.safeParse(data);
}

export function safeParseMigration(data: unknown): z.SafeParseReturnType<unknown, import('../api').Migration> {
  return migrationSchema.safeParse(data);
}

