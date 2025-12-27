import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import type { DbSchema, CodeSchema } from '../types/index.js';

/**
 * Convert CLI's DbSchema to ERD-compatible ChartDB smart-query format.
 * This allows the VS Code extension to automatically load snapshots created by CLI scans.
 */
export function convertDbSchemaToErdFormat(dbSchema: DbSchema): any {
  const columns: any[] = [];
  const customTypes: any[] = [];

  // Convert models to columns format
  dbSchema.models.forEach((model) => {
    model.fields.forEach((field) => {
      // Extract properties from field (may be in constraints or direct properties)
      const isPrimaryKey = field.constraints?.includes('PRIMARY KEY') || false;
      const isUnique = field.constraints?.includes('UNIQUE') || false;
      const isArray = field.type?.includes('[]') || field.type?.includes('_array') || false;
      
      columns.push({
        table_name: model.name,
        table_schema: 'public', // CLI doesn't track schema per model yet
        column_name: field.name,
        data_type: field.type || 'text',
        is_nullable: field.nullable !== false,
        column_default: field.defaultValue || null,
        character_maximum_length: null, // CLI doesn't extract this yet
        numeric_precision: null, // CLI doesn't extract this yet
        numeric_scale: null, // CLI doesn't extract this yet
        is_primary_key: isPrimaryKey,
        is_unique: isUnique,
        is_identity: false, // CLI doesn't track this yet
        is_array: isArray,
        comment: null, // CLI doesn't extract comments yet
      });
    });
  });

  // Convert to ChartDB metadata format
  return {
    columns,
    custom_types: customTypes,
  };
}

/**
 * Convert CLI's CodeSchema to ERD-compatible format.
 * This is used when only code schema is available (no database connection).
 */
export function convertCodeSchemaToErdFormat(codeSchema: CodeSchema): any {
  const columns: any[] = [];

  codeSchema.models.forEach((model) => {
    model.fields.forEach((field) => {
      // Extract properties from field
      const isPrimaryKey = field.constraints?.includes('PRIMARY KEY') || false;
      const isUnique = field.constraints?.includes('UNIQUE') || false;
      const isArray = field.type?.includes('[]') || field.type?.includes('_array') || false;
      
      columns.push({
        table_name: model.name,
        table_schema: 'public', // Default schema for code-only schemas
        column_name: field.name,
        data_type: field.type || 'text',
        is_nullable: field.nullable !== false,
        column_default: field.defaultValue || null,
        character_maximum_length: null,
        numeric_precision: null,
        numeric_scale: null,
        is_primary_key: isPrimaryKey,
        is_unique: isUnique,
        is_identity: false,
        is_array: isArray,
        comment: null,
      });
    });
  });

  return {
    columns,
    custom_types: [],
  };
}

/**
 * Save ERD snapshot in VS Code extension-compatible format.
 * Creates snapshot file and updates manifest for automatic detection.
 */
export async function saveErdSnapshot(
  projectPath: string,
  schema: any, // ChartDB format metadata
  source: string,
  note?: string
): Promise<string> {
  const snapshotDir = join(projectPath, '.devsync', 'schemas', 'snapshots');
  const manifestPath = join(projectPath, '.devsync', 'schemas', 'manifest.json');

  // Ensure directories exist
  if (!existsSync(snapshotDir)) {
    mkdirSync(snapshotDir, { recursive: true });
  }
  if (!existsSync(dirname(manifestPath))) {
    mkdirSync(dirname(manifestPath), { recursive: true });
  }

  // Generate snapshot ID and metadata
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const meta = {
    id,
    createdAt,
    source,
    note: note || `CLI scan from ${new Date().toLocaleString()}`,
  };

  // Create snapshot record (VS Code extension format)
  const snapshot = {
    meta,
    schema, // ChartDB format metadata
    layout: undefined,
  };

  // Save snapshot file
  const snapshotPath = join(snapshotDir, `${id}.json`);
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  // Update manifest
  let manifest: { versions: any[] } = { versions: [] };
  if (existsSync(manifestPath)) {
    try {
      const content = readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(content);
    } catch {
      // If manifest is corrupted, start fresh
      manifest = { versions: [] };
    }
  }

  // Add new snapshot to manifest (newest first)
  manifest.versions.unshift(meta);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return snapshotPath;
}

