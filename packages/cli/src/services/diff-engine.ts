import type { CodeSchema, DbSchema, SchemaDiff, Mismatch } from '../types/index.js';

export function compareSchemas(
  codeSchema: CodeSchema,
  dbSchema: DbSchema
): SchemaDiff {
  const mismatches: Mismatch[] = [];

  // Create lookup maps for faster access
  const dbModelsMap = new Map(dbSchema.models.map(m => [m.name.toLowerCase(), m]));
  const codeModelsMap = new Map(codeSchema.models.map(m => [m.name.toLowerCase(), m]));

  // Check each model in code
  for (const codeModel of codeSchema.models) {
    const dbModel = dbModelsMap.get(codeModel.name.toLowerCase());
    
    // Model doesn't exist in database
    if (!dbModel) {
      mismatches.push({
        type: 'missing_table',
        model: codeModel.name,
        severity: 'error',
        suggestedFix: `CREATE TABLE "${codeModel.name}" (...);`
      });
      continue;
    }

    // Check fields in code model
    const dbFieldsMap = new Map(dbModel.fields.map(f => [f.name.toLowerCase(), f]));
    
    for (const codeField of codeModel.fields) {
      const dbField = dbFieldsMap.get(codeField.name.toLowerCase());
      
      // Field doesn't exist in database
      if (!dbField) {
        mismatches.push({
          type: 'missing_field',
          model: codeModel.name,
          field: codeField.name,
          codeValue: codeField.type,
          severity: 'error',
          suggestedFix: `ALTER TABLE "${codeModel.name}" ADD COLUMN "${codeField.name}" ${codeField.type};`
        });
        continue;
      }

      // Type mismatch
      const codeType = normalizeType(codeField.type);
      const dbType = normalizeType(dbField.type);
      
      if (codeType !== dbType) {
        mismatches.push({
          type: 'type_mismatch',
          model: codeModel.name,
          field: codeField.name,
          codeValue: codeField.type,
          dbValue: dbField.type,
          severity: 'warning', // Warning because might be compatible types
          suggestedFix: `ALTER TABLE "${codeModel.name}" ALTER COLUMN "${codeField.name}" TYPE ${codeField.type};`
        });
      }

      // Nullable mismatch
      if (codeField.nullable !== dbField.nullable) {
        mismatches.push({
          type: 'constraint_mismatch',
          model: codeModel.name,
          field: codeField.name,
          codeValue: codeField.nullable ? 'nullable' : 'not null',
          dbValue: dbField.nullable ? 'nullable' : 'not null',
          severity: 'warning',
          suggestedFix: `ALTER TABLE "${codeModel.name}" ALTER COLUMN "${codeField.name}" ${codeField.nullable ? 'DROP NOT NULL' : 'SET NOT NULL'};`
        });
      }
    }

    // Check for extra fields in database (fields in DB but not in code)
    const codeFieldsMap = new Map(codeModel.fields.map(f => [f.name.toLowerCase(), f]));
    
    for (const dbField of dbModel.fields) {
      const codeField = codeFieldsMap.get(dbField.name.toLowerCase());
      
      if (!codeField) {
        mismatches.push({
          type: 'extra_field',
          model: codeModel.name,
          field: dbField.name,
          dbValue: dbField.type,
          severity: 'info', // Info because might be intentional
          suggestedFix: `ALTER TABLE "${codeModel.name}" DROP COLUMN "${dbField.name}";`
        });
      }
    }
  }

  // Check for extra tables in database (tables in DB but not in code)
  for (const dbModel of dbSchema.models) {
    const codeModel = codeModelsMap.get(dbModel.name.toLowerCase());
    
    if (!codeModel) {
      // Note: Using 'extra_field' type for extra tables too (we can add a new type later)
      mismatches.push({
        type: 'extra_field',
        model: dbModel.name,
        severity: 'info',
        suggestedFix: `DROP TABLE "${dbModel.name}";`
      });
    }
  }

  return {
    mismatches,
    warnings: [],
    metadata: {
      codeVersion: codeSchema.type,
      dbVersion: dbSchema.type,
      timestamp: new Date()
    }
  };
}

function normalizeType(type: string): string {
  // Normalize types for comparison
  let normalized = type.toLowerCase().trim();
  
  // Remove array brackets for comparison
  normalized = normalized.replace(/\[\]$/, '');
  
  // Map common PostgreSQL types to standard names
  const typeMap: Record<string, string> = {
    'varchar': 'text',
    'char': 'text',
    'int': 'integer',
    'int4': 'integer',
    'int8': 'bigint',
    'float8': 'double precision',
    'float4': 'real',
    'bool': 'boolean',
    'timestamp without time zone': 'timestamp',
    'timestamp with time zone': 'timestamptz',
    'jsonb': 'json',
    'bytea': 'bytes'
  };

  // Extract base type (remove length/precision)
  const baseType = normalized.split('(')[0];
  
  return typeMap[baseType] || baseType;
}

