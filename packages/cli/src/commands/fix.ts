import chalk from 'chalk';
import { resolve } from 'path';
import { loadConfig } from '../utils/config.js';
import { extractAndNormalizeSchema } from '../services/schema-extractor.js';
import { scanDatabase } from '../services/db-scanner.js';
import type { DbSchema } from '../types/index.js';
import { normalizeDbSchema } from '../services/schema-normalizer.js';
import { detectConflicts } from '../services/conflict-detector.js';
import { reasonAboutConflicts, type ReasoningOptions } from '../services/ai-reasoner.js';
import { generateFixPlan, validateFixPlan, formatFixPlan, type FixOptions } from '../services/fix-engine.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { StatusOptions, OutputFormat } from '../types/index.js';

interface FixCommandOptions extends StatusOptions {
  format?: OutputFormat;
  includeLowRisk?: boolean;
  includeInfo?: boolean;
  output?: string;
  apiKey?: string;
  provider?: 'openai' | 'anthropic' | 'ollama';
  model?: string;
  ollamaUrl?: string;
  yes?: boolean; // Auto-approve (still requires explicit flags for writes)
}

export async function fixCommand(options: FixCommandOptions = {}) {
  const format = (options.format || 'table') as OutputFormat;
  const root = options.path
    ? (options.path.startsWith('/') || /^[A-Z]:/.test(options.path)
        ? options.path
        : resolve(process.cwd(), options.path))
    : process.cwd();

  const configPath = options.config || '.devsync/config.json';
  const config = await loadConfig(configPath).catch(() => null);

  // Safety: Always require explicit opt-in for writes
  if (options.yes) {
    // Even with --yes, we still require explicit flags for actual writes
    // This is preview-only by default
  }

  try {
    // Extract code schema
    const codeExtraction = await extractAndNormalizeSchema({
      root,
      connectionString: undefined, // Extract from code/schema files only
      configPath,
      readOnly: true,
    });

    if (!codeExtraction.canonicalSchema) {
      const payload = {
        status: 'blocked' as const,
        reason: 'code_schema_missing',
        message: 'Code schema not found. Run `devsync scan` to detect schema sources.',
        required: ['Run scan (Phase 2) and schema extraction (Phase 3).'],
        warnings: [],
      };

      if (format === 'json') {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.log(chalk.red('❌ Fix blocked'));
        console.log(chalk.gray('Reason: Code schema not available.'));
        console.log(chalk.gray('Required: Run `devsync scan` to detect schema sources.'));
      }
      return;
    }

    // Extract database schema
    const dbConnection = options.db || config?.database?.connectionString;
    if (!dbConnection) {
      const payload = {
        status: 'blocked' as const,
        reason: 'database_connection_missing',
        message: 'Database connection required for conflict detection.',
        required: ['Provide --db <connection> or set database.connectionString in config.'],
        warnings: [],
      };

      if (format === 'json') {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.log(chalk.red('❌ Fix blocked'));
        console.log(chalk.gray('Reason: Database connection required.'));
        console.log(chalk.gray('Required: Provide --db <connection> or set in config.'));
      }
      return;
    }

    let dbSchema;
    try {
      const rawDbSchema: DbSchema = await scanDatabase({
        connectionString: dbConnection,
        showProgress: false,
      });
      dbSchema = normalizeDbSchema(rawDbSchema);
    } catch (error) {
      const payload = {
        status: 'error' as const,
        error: error instanceof Error ? error.message : String(error),
        message: 'Failed to scan database.',
      };

      if (format === 'json') {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.log(chalk.red('❌ Failed to scan database'));
        console.log(chalk.red(`   ${error instanceof Error ? error.message : String(error)}`));
      }
      return;
    }

    // Detect conflicts
    const conflictReport = detectConflicts(codeExtraction.canonicalSchema, dbSchema);

    if (conflictReport.conflicts.length === 0) {
      const payload = {
        status: 'success' as const,
        message: 'No conflicts detected - schemas are in sync!',
        conflicts: [],
      };

      if (format === 'json') {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.log(chalk.green('✅ No conflicts detected - schemas are in sync!'));
      }
      return;
    }

    // AI reasoning (optional - requires API key)
    let reasoningResult;
    const aiApiKey = options.apiKey || config?.ai?.apiKey;
    const aiProvider = (options.provider || config?.ai?.provider) as ReasoningOptions['provider'];

    if (aiApiKey || aiProvider === 'ollama') {
      try {
        reasoningResult = await reasonAboutConflicts(
          conflictReport,
          codeExtraction.canonicalSchema,
          dbSchema,
          {
            provider: aiProvider,
            apiKey: aiApiKey,
            model: options.model || config?.ai?.model?.reasoning,
            ollamaUrl: options.ollamaUrl || config?.ai?.ollamaUrl,
          }
        );
      } catch (error) {
        // AI reasoning failed, continue without it
        if (format !== 'json') {
          console.log(chalk.yellow('⚠️  AI reasoning unavailable, generating fixes without explanations'));
        }
      }
    }

    // Generate fix plan
    const fixOptions: FixOptions = {
      includeLowRisk: options.includeLowRisk || false,
      includeInfo: options.includeInfo || false,
      generateRollback: true,
      dryRun: true, // Always dry-run by default
      outputPath: options.output,
      format: 'sql',
    };

    const fixPlan = generateFixPlan(
      conflictReport,
      reasoningResult || {
        explanations: [],
        summary: {
          totalConflicts: conflictReport.conflicts.length,
          explained: 0,
          highRiskCount: conflictReport.summary.byRisk.high,
          recommendedPriority: [],
        },
        metadata: {
          model: 'none',
          provider: 'none',
          timestamp: new Date(),
        },
      },
      codeExtraction.canonicalSchema,
      fixOptions
    );

    // Validate fix plan
    const validation = validateFixPlan(fixPlan);

    // Output results
    if (format === 'json') {
      console.log(
        JSON.stringify(
          {
            status: 'success',
            fixPlan: {
              id: fixPlan.id,
              conflicts: fixPlan.conflicts.length,
              safetyAssessment: fixPlan.safetyAssessment,
              validation,
            },
            migration: {
              sql: fixPlan.migration.sql,
              rollback: fixPlan.migration.rollback,
            },
            recommendedActions: fixPlan.recommendedActions,
          },
          null,
          2
        )
      );
    } else {
      // Table format
      console.log(chalk.blue('🔧 Fix Plan Generated\n'));
      console.log(formatFixPlan(fixPlan, 'table'));

      if (!validation.valid) {
        console.log(chalk.red('\n❌ Validation Errors:'));
        for (const error of validation.errors) {
          console.log(chalk.red(`   - ${error}`));
        }
      }

      if (validation.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️  Validation Warnings:'));
        for (const warning of validation.warnings) {
          console.log(chalk.yellow(`   - ${warning}`));
        }
      }

      // Save migration file if output path provided
      if (options.output) {
        const outputPath = resolvePath(options.output, root);
        const dir = dirname(outputPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(outputPath, fixPlan.migration.sql);
        if (fixPlan.migration.rollback) {
          const rollbackPath = outputPath.replace(/\.sql$/, '_rollback.sql');
          writeFileSync(rollbackPath, fixPlan.migration.rollback);
        }
        console.log(chalk.green(`\n✅ Migration saved to: ${outputPath}`));
        if (fixPlan.migration.rollback) {
          console.log(chalk.gray(`   Rollback saved to: ${outputPath.replace(/\.sql$/, '_rollback.sql')}`));
        }
      } else {
        console.log(chalk.gray('\n💡 Tip: Use --output <path> to save migration to file'));
      }

      console.log(chalk.yellow('\n⚠️  This is a PREVIEW. No changes have been applied.'));
      console.log(chalk.gray('   Review the migration carefully before applying.'));
    }
  } catch (error) {
    const payload = {
      status: 'error' as const,
      error: error instanceof Error ? error.message : String(error),
    };

    if (format === 'json') {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(chalk.red('❌ Error generating fix plan'));
      console.log(chalk.red(`   ${error instanceof Error ? error.message : String(error)}`));
    }
    process.exit(1);
  }
}

function resolvePath(inputPath: string, root: string): string {
  if (inputPath.startsWith('/') || /^[A-Z]:/.test(inputPath)) {
    return inputPath;
  }
  return join(root, inputPath);
}

