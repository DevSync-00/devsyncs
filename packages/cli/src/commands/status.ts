import chalk from 'chalk';
import { resolve } from 'path';
import { loadConfig } from '../utils/config.js';
import { extractAndNormalizeSchema } from '../services/schema-extractor.js';
import { detectConflicts } from '../services/conflict-detector.js';
import { scanDatabase } from '../services/db-scanner.js';
import { normalizeDbSchema, type CanonicalSchema } from '../services/schema-normalizer.js';
import type { StatusOptions, OutputFormat } from '../types/index.js';

export async function statusCommand(options: StatusOptions = {}) {
  const format: OutputFormat = options.format || 'table';
  const root = options.path ? (options.path.startsWith('/') || /^[A-Z]:/.test(options.path)
          ? options.path
          : resolve(process.cwd(), options.path))
      : process.cwd();

  const configPath = options.config || '.devsync/config.json';
  const config = await loadConfig(configPath).catch(() => null);

  if (format === 'json') {
    // JSON output: Try extraction and report readiness
    try {
      const extraction = await extractAndNormalizeSchema({
        root,
        connectionString: options.db || config?.database?.connectionString,
        configPath,
        readOnly: true,
      });

      const result = {
        status: 'ok',
        root,
        normalizedSchemaReady: extraction.canonicalSchema !== null,
        source: extraction.source,
        sourceType: extraction.sourceType,
        warnings: extraction.warnings,
        nextActions: extraction.canonicalSchema
          ? ['Normalized schema available. Ready for conflict detection (Phase 5).']
          : ['Run schema extraction to produce normalized schema (Phase 3).'],
      };
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.log(JSON.stringify({
          status: 'error',
        root,
          error: error instanceof Error ? error.message : String(error),
        normalizedSchemaReady: false,
        }, null, 2));
      process.exit(1);
    }
    return;
  }

  // Table output
  console.log(chalk.blue('📊 Status (read-only)\n'));
  console.log(chalk.gray(`Root: ${root}\n`));

  try {
    const codeExtraction = await extractAndNormalizeSchema({
      root,
      connectionString: undefined, // Extract from code/schema files only
      configPath,
      readOnly: true,
    });

    const dbConnection = options.db || config?.database?.connectionString;
    let dbSchema: CanonicalSchema | null = null;

    // Try to extract database schema if connection available
    if (dbConnection) {
      try {
        const rawDbSchema = await scanDatabase({
          connectionString: dbConnection,
          showProgress: false,
        });
        dbSchema = normalizeDbSchema(rawDbSchema);
      } catch (error) {
        // Database scan failed, continue without it
      }
    }

    if (codeExtraction.canonicalSchema) {
      console.log(chalk.green('✅ Code Schema: Available'));
      console.log(chalk.gray(`   Source: ${codeExtraction.source} (${codeExtraction.sourceType})`));
      console.log(chalk.gray(`   Tables: ${codeExtraction.canonicalSchema.tables.length}`));
      const totalColumns = codeExtraction.canonicalSchema.tables.reduce(
        (sum, t) => sum + t.columns.length,
        0
      );
      console.log(chalk.gray(`   Columns: ${totalColumns}`));
    } else {
      console.log(chalk.yellow('⚠️  Code Schema: Not available'));
      console.log(chalk.gray('   Run `devsync scan` to detect schema sources'));
    }

  if (dbSchema) {
      console.log(chalk.green('\n✅ Database Schema: Available'));
      console.log(chalk.gray(`   Source: ${dbSchema.metadata.source} (${dbSchema.metadata.sourceType})`));
      console.log(chalk.gray(`   Tables: ${dbSchema.tables.length}`));
      const totalColumns = dbSchema.tables.reduce((sum, t) => sum + t.columns.length, 0);
      console.log(chalk.gray(`   Columns: ${totalColumns}`));
  } else {
    console.log(chalk.yellow('\n⚠️  Database Schema: Not connected'));
    console.log(chalk.gray('   Use --db <connection> to scan database'));
  }

    // Conflict detection if both schemas available
    if (codeExtraction.canonicalSchema && dbSchema) {
      console.log(chalk.blue('\n📊 Conflict Detection:'));
      const conflictReport = detectConflicts(codeExtraction.canonicalSchema, dbSchema);

      if (conflictReport.conflicts.length === 0) {
        console.log(chalk.green('   ✅ No conflicts detected - schemas are in sync!'));
      } else {
        console.log(chalk.gray(`   Total conflicts: ${conflictReport.summary.total}`));
        console.log(chalk.red(`   High risk: ${conflictReport.summary.byRisk.high}`));
        console.log(chalk.yellow(`   Medium risk: ${conflictReport.summary.byRisk.medium}`));
        console.log(chalk.gray(`   Low risk: ${conflictReport.summary.byRisk.low}`));
        console.log(chalk.gray(`\n   By category:`));
        console.log(chalk.gray(`     Structural: ${conflictReport.summary.byCategory.structural}`));
        console.log(chalk.gray(`     Type: ${conflictReport.summary.byCategory.type}`));
        console.log(chalk.gray(`     Relationship: ${conflictReport.summary.byCategory.relationship}`));
        console.log(chalk.gray(`     Constraint: ${conflictReport.summary.byCategory.constraint}`));

        // Show first 5 high-risk conflicts
        const highRisk = conflictReport.conflicts.filter((c) => c.risk === 'high').slice(0, 5);
        if (highRisk.length > 0) {
          console.log(chalk.red(`\n   High-risk conflicts (showing first ${highRisk.length}):`));
          for (const conflict of highRisk) {
            console.log(chalk.red(`     - ${conflict.table}${conflict.column ? `.${conflict.column}` : ''}: ${conflict.message}`));
          }
        }
      }
    } else {
      console.log(chalk.yellow('\n⚠️  Conflict Detection: Requires both code and database schemas'));
    }

    console.log(chalk.blue('\n➡️  Next actions:'));
    if (codeExtraction.canonicalSchema && dbSchema) {
      console.log(chalk.gray('   - Conflicts detected (see above)'));
      console.log(chalk.gray('   - Use `devsync fix` when Phase 6-7 are complete to generate fixes\n'));
    } else {
      console.log(chalk.gray('   - Run schema extraction (Phase 3)'));
      console.log(chalk.gray('   - Provide database connection to enable conflict detection\n'));
    }

    if (codeExtraction.warnings.length > 0) {
      console.log(chalk.yellow('⚠️  Warnings:'));
      for (const warning of codeExtraction.warnings) {
        console.log(chalk.gray(`   - ${warning}`));
      }
      console.log();
    }
  } catch (error) {
    console.log(chalk.red('❌ Error checking status:'));
    console.log(chalk.red(`   ${error instanceof Error ? error.message : String(error)}\n`));
    process.exit(1);
  }
}

