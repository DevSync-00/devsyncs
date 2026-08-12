/**
 * Runtime type validation using Zod
 */

import { z } from 'zod';
import { PrismaModel, DatabaseTable, ScannedSchema, SchemaValue } from './schema';

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

export const scannedSchemaSchema: z.ZodType<ScannedSchema> = z.object({
  tables: z.array(z.object({
    name: z.string(),
    columns: z.array(z.object({
      name: z.string(),
      type: z.string(),
      nullable: z.boolean(),
      defaultValue: z.string().nullable().optional(),
      constraints: z.array(z.string()).optional(),
    })),
    columnsComplete: z.boolean().optional(),
    relationships: z.array(z.object({
      column: z.string(),
      referencedTable: z.string(),
      referencedColumn: z.string().optional(),
      constraintName: z.string().optional(),
      source: z.string().optional(),
    })).optional(),
    source: z.string().optional(),
  })),
  metadata: z.object({
    source: z.enum(['code', 'database']),
    sourceType: z.string(),
    tableCount: z.number(),
    columnCount: z.number(),
    inferredTableCount: z.number().optional(),
    relationshipCount: z.number().optional(),
    scannedAt: z.string(),
    warnings: z.array(z.string()).optional(),
  }),
});

/**
 * Mismatch schemas (discriminated unions)
 */
const scannerMismatchFields = {
  model: z.string(),
  table: z.string().optional(),
  field: z.string().optional(),
  column: z.string().optional(),
  message: z.string().optional(),
  codeValue: schemaValueSchema.optional(),
  dbValue: schemaValueSchema.optional(),
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
};

export const missingTableMismatchSchema = z.object({
  ...scannerMismatchFields,
  type: z.literal('missing_table'),
  model: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
});

export const extraTableMismatchSchema = z.object({
  ...scannerMismatchFields,
  type: z.literal('extra_table'),
  model: z.string(),
  dbValue: schemaValueSchema.optional(),
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
});

export const missingFieldMismatchSchema = z.object({
  ...scannerMismatchFields,
  type: z.literal('missing_field'),
  model: z.string(),
  field: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
});

export const typeMismatchSchema = z.object({
  ...scannerMismatchFields,
  type: z.literal('type_mismatch'),
  model: z.string(),
  field: z.string(),
  codeValue: schemaValueSchema,
  dbValue: schemaValueSchema,
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
});

export const nullableMismatchSchema = z.object({
  ...scannerMismatchFields,
  type: z.literal('nullable_mismatch'),
  model: z.string(),
  field: z.string(),
  codeValue: schemaValueSchema,
  dbValue: schemaValueSchema,
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
});

export const extraFieldMismatchSchema = z.object({
  ...scannerMismatchFields,
  type: z.literal('extra_field'),
  model: z.string(),
  field: z.string(),
  dbValue: schemaValueSchema,
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
});

export const missingRelationshipMismatchSchema = z.object({
  ...scannerMismatchFields,
  type: z.literal('missing_relationship'),
  model: z.string(),
  field: z.string(),
  codeValue: schemaValueSchema.optional(),
  dbValue: schemaValueSchema.optional(),
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
});

export const extraRelationshipMismatchSchema = z.object({
  ...scannerMismatchFields,
  type: z.literal('extra_relationship'),
  model: z.string(),
  field: z.string(),
  codeValue: schemaValueSchema.optional(),
  dbValue: schemaValueSchema.optional(),
  severity: z.enum(['error', 'warning', 'info']),
  suggestedFix: z.string().optional(),
});

export const constraintMismatchSchema = z.object({
  ...scannerMismatchFields,
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
  extraTableMismatchSchema,
  missingFieldMismatchSchema,
  typeMismatchSchema,
  nullableMismatchSchema,
  extraFieldMismatchSchema,
  missingRelationshipMismatchSchema,
  extraRelationshipMismatchSchema,
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
  codeSchema: scannedSchemaSchema.optional(),
  dbSchema: scannedSchemaSchema.optional(),
  created_at: z.string(),
  completed_at: z.string().nullable().optional(),
});

/**
 * Migration schema
 */
const migrationIssueFields = {
  type: z.string(),
  message: z.string(),
  line: z.number().optional(),
  suggestion: z.string().optional(),
};

const migrationErrorSchema = z.object({
  ...migrationIssueFields,
  severity: z.literal('error'),
});

const migrationWarningSchema = z.object({
  ...migrationIssueFields,
  severity: z.enum(['warning', 'info']),
});

const migrationValidationSchema = z.object({
  valid: z.boolean(),
  errors: z.array(migrationErrorSchema),
  warnings: z.array(migrationWarningSchema),
  breakingChanges: z.array(z.object({
    type: z.string(),
    severity: z.enum(['error', 'warning']),
    message: z.string(),
    affectedTable: z.string().optional(),
    affectedColumn: z.string().optional(),
    line: z.number().optional(),
    impact: z.string().optional(),
    mitigation: z.string().optional(),
  })),
  summary: z.object({
    totalIssues: z.number(),
    errorCount: z.number(),
    warningCount: z.number(),
    breakingChangeCount: z.number(),
  }),
});

export const migrationSchema = z.preprocess((input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }

  const migration = input as Record<string, unknown>;
  return {
    ...migration,
    id: migration.id ?? migration.migrationId,
    content: migration.content ?? migration.sql,
    applied: migration.applied ?? false,
    created_at: migration.created_at ?? migration.createdAt,
  };
}, z.object({
  id: z.string(),
  filename: z.string(),
  content: z.string(),
  format: z.string(),
  applied: z.boolean(),
  created_at: z.string(),
  validation: migrationValidationSchema.nullable().optional(),
}));

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

