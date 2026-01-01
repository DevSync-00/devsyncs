/**
 * Schema Extraction Service (Phase 3)
 * 
 * Follows strict discovery priority per charter:
 * 1. Database connection string → Inspect live database (read-only)
 * 2. Else schema files (.sql, .prisma, migrations, ORM schemas)
 * 3. Else deeply scan codebase → Infer schema intent
 * 
 * All extracted schemas are normalized to canonical format before return.
 */

import type { CanonicalSchema } from './schema-normalizer.js';
import { normalizeCodeSchema, normalizeDbSchema } from './schema-normalizer.js';
import { scanCodebase } from './code-scanner.js';
import { scanDatabase } from './db-scanner.js';
import type { CodeSchema, DbSchema } from '../types/index.js';
import { loadConfig } from '../utils/config.js';

export interface ExtractionOptions {
  root: string;
  connectionString?: string;
  configPath?: string;
  readOnly?: boolean; // Default: true (safety)
}

export interface ExtractionResult {
  canonicalSchema: CanonicalSchema | null;
  source: 'database' | 'schema-files' | 'codebase' | null;
  sourceType: string | null;
  warnings: string[];
}

/**
 * Extract and normalize schema following strict discovery priority
 */
export async function extractAndNormalizeSchema(
  options: ExtractionOptions
): Promise<ExtractionResult> {
  const { root, connectionString, configPath, readOnly = true } = options;

  // Safety: Always enforce read-only for database operations
  if (!readOnly) {
    return {
      canonicalSchema: null,
      source: null,
      sourceType: null,
      warnings: ['Schema extraction is read-only by default. Use explicit opt-in for writes.'],
    };
  }

  // Load config if provided
  const config = configPath ? await loadConfig(configPath) : null;
  const dbConnection = connectionString || config?.database?.connectionString;

  const warnings: string[] = [];

  // Priority 1: Database connection string → Inspect live database (read-only)
  if (dbConnection) {
    try {
      const dbSchema: DbSchema = await scanDatabase({
        connectionString: dbConnection,
        showProgress: false,
      });

      const canonicalSchema = normalizeDbSchema(dbSchema);
      return {
        canonicalSchema,
        source: 'database',
        sourceType: dbSchema.type,
        warnings,
      };
    } catch (error) {
      warnings.push(
        `Failed to scan database: ${error instanceof Error ? error.message : String(error)}. Falling back to schema files.`
      );
      // Continue to next priority
    }
  }

  // Priority 2: Schema files (.sql, .prisma, migrations, ORM schemas)
  try {
    const codeSchema: CodeSchema = await scanCodebase(root, {
      useAI: false, // Disable AI for Phase 3 (pattern matching only)
      showProgress: false,
    });

    // Only return if we actually found schema files (not inferred from code)
    // The code-scanner returns a schema even if it's just inferred, so we need to check
    if (codeSchema && codeSchema.models.length > 0) {
      const canonicalSchema = normalizeCodeSchema(codeSchema);
      return {
        canonicalSchema,
        source: 'schema-files',
        sourceType: codeSchema.type,
        warnings,
      };
    }
  } catch (error) {
    warnings.push(
      `Failed to scan schema files: ${error instanceof Error ? error.message : String(error)}. Falling back to codebase scan.`
    );
    // Continue to next priority
  }

  // Priority 3: Deep codebase scan → Infer schema intent
  try {
    const codeSchema: CodeSchema = await scanCodebase(root, {
      useAI: true, // Enable AI inference for deep scan
      showProgress: false,
    });

    if (codeSchema && codeSchema.models.length > 0) {
      const canonicalSchema = normalizeCodeSchema(codeSchema);
      return {
        canonicalSchema,
        source: 'codebase',
        sourceType: `inferred-${codeSchema.type}`,
        warnings: [...warnings, 'Schema inferred from codebase patterns. Accuracy may vary.'],
      };
    }
  } catch (error) {
    warnings.push(
      `Failed to infer schema from codebase: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // No schema found
  return {
    canonicalSchema: null,
    source: null,
    sourceType: null,
    warnings,
  };
}

