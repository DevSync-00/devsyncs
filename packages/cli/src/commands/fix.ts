import { scanCodebase } from '../services/code-scanner.js';
import { scanDatabase, closeDatabaseConnections } from '../services/db-scanner.js';
import { compareSchemas } from '../services/diff-engine.js';
import { generateMigration, generateAndValidateMigration } from '../services/migration-generator.js';
import { loadConfig } from '../utils/config.js';
import { loadAuthConfig } from '../lib/auth-config.js';
import { requireAuthenticatedCli } from '../lib/auth-check.js';
import { analyzeCodebaseWithAI } from '../services/ai-code-analyzer.js';
import chalk from 'chalk';
import { resolve } from 'path';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { ScanOptions, Mismatch } from '../types/index.js';

export interface FixOptions {
  path?: string;
  db?: string;
  config?: string;
  json?: boolean;
  aiAnalysis?: boolean;
  aiProvider?: 'openai' | 'deepseek';
  useOllama?: boolean;
  ollamaModel?: string;
  ollamaUrl?: string;
  apply?: boolean; // Apply fixes automatically (dangerous!)
  output?: string; // Output file for migration
  dryRun?: boolean; // Preview only (default: true)
}

export async function fixCommand(options: FixOptions = {}) {
  try {
    const absolutePath = options.path 
      ? (options.path.startsWith('/') || /^[A-Z]:/.test(options.path)
          ? options.path
          : resolve(process.cwd(), options.path))
      : process.cwd();

    // Load config if exists
    const config = options.config ? await loadConfig(options.config) : null;
    const dbConnection = options.db || config?.database?.connectionString;

    // Default to dry-run unless explicitly set
    const isDryRun = options.dryRun !== false && !options.apply;

    if (!options.json) {
      console.log(chalk.blue('🔧 Analyzing schema conflicts and generating fixes...\n'));
      
      // Show AI model info if using AI
      if (options.aiAnalysis !== false && !options.useOllama) {
        const provider = options.aiProvider || 'puter';
        const { getModelInfo } = await import('../utils/ai-provider-resolver.js');
        const modelInfo = getModelInfo(provider as any);
        console.log(chalk.blue(`🤖 AI Model: ${modelInfo.displayName}`));
        console.log(chalk.gray(`   Provider: ${modelInfo.provider} | Model: ${modelInfo.model}\n`));
      }
    }

    // Scan codebase
    let codeSchema;
    try {
      codeSchema = await scanCodebase(absolutePath, {
        useAI: options.aiAnalysis !== false,
        useOllama: options.useOllama || false,
        ollamaModel: options.ollamaModel,
        ollamaUrl: options.ollamaUrl,
        aiProvider: options.aiProvider || 'puter',
        showProgress: !options.json
      });
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          message: 'Failed to scan codebase'
        }, null, 2));
      } else {
        console.error(chalk.red(`❌ Failed to scan codebase: ${error instanceof Error ? error.message : String(error)}`));
      }
      await closeDatabaseConnections();
      process.exit(1);
    }

    // Scan database if connection provided
    let dbSchema;
    if (dbConnection) {
      try {
        dbSchema = await scanDatabase({
          connectionString: dbConnection,
          showProgress: !options.json
        });
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            message: 'Failed to scan database'
          }, null, 2));
        } else {
          console.error(chalk.red(`❌ Failed to scan database: ${error instanceof Error ? error.message : String(error)}`));
        }
        await closeDatabaseConnections();
        process.exit(1);
      }
    } else {
      if (options.json) {
        console.log(JSON.stringify({
          status: 'error',
          error: 'Database connection required for fix command',
          message: 'Use --db <connection> to provide database connection'
        }, null, 2));
      } else {
        console.error(chalk.red('❌ Database connection required for fix command'));
        console.error(chalk.gray('   Use --db <connection> to provide database connection'));
      }
      await closeDatabaseConnections();
      process.exit(1);
    }

    // Compare schemas
    if (!codeSchema || !dbSchema) {
      if (options.json) {
        console.log(JSON.stringify({
          status: 'error',
          error: 'Both code schema and database schema are required'
        }, null, 2));
      } else {
        console.error(chalk.red('❌ Both code schema and database schema are required'));
      }
      await closeDatabaseConnections();
      process.exit(1);
    }

    const diff = compareSchemas(codeSchema, dbSchema);

    if (diff.mismatches.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({
          status: 'success',
          message: 'No conflicts detected - schemas are in sync',
          fixes: []
        }, null, 2));
      } else {
        console.log(chalk.green('\n✅ No conflicts detected - schemas are in sync!\n'));
      }
      await closeDatabaseConnections();
      return;
    }

    // Generate AI-powered explanations and fixes
    let enhancedFixes;
    try {
      enhancedFixes = await generateAIFixes(
        diff.mismatches,
        codeSchema,
        dbSchema,
        absolutePath,
        {
          useOllama: options.useOllama || false,
          ollamaModel: options.ollamaModel,
          ollamaUrl: options.ollamaUrl,
          aiProvider: options.aiProvider || 'openai'
        }
      );
    } catch (error) {
      // Fall back to basic fixes if AI fails
      console.warn(chalk.yellow('⚠️  AI analysis failed, using basic fixes'));
      enhancedFixes = diff.mismatches.map(m => ({
        mismatch: m,
        explanation: m.suggestedFix || 'No explanation available',
        sql: m.suggestedFix || '',
        safety: 'unknown' as const
      }));
    }

    // Generate and validate migration
    let migration;
    if (dbConnection) {
      if (!options.json) {
        console.log(chalk.gray('🔍 Validating migration...'));
      }
      migration = await generateAndValidateMigration(
        diff.mismatches,
        codeSchema,
        dbSchema,
        dbConnection,
        {
          includeRollback: true,
          dryRun: isDryRun,
          checkBreakingChanges: true,
          checkPermissions: true
        }
      );
      
      // Display validation results
      if (!options.json && migration.validation) {
        displayValidationResults(migration.validation);
        
        if (!migration.validation.valid) {
          console.log(chalk.red('❌ Migration validation failed!'));
          if (options.apply) {
            console.log(chalk.red('❌ Cannot apply migration with validation errors.\n'));
            await closeDatabaseConnections();
            process.exit(1);
          }
        } else if (migration.validation.summary.warningCount > 0 || migration.validation.summary.breakingChangeCount > 0) {
          console.log(chalk.yellow('⚠️  Migration has warnings or breaking changes. Review carefully.\n'));
        } else {
          console.log(chalk.green('✅ Migration validation passed!\n'));
        }
      }
    } else {
      // Generate without validation if no connection
      migration = generateMigration(diff.mismatches, codeSchema, {
        includeRollback: true,
        dryRun: isDryRun
      });
      if (!options.json) {
        console.log(chalk.yellow('⚠️  No database connection - skipping validation\n'));
      }
    }

    // Display fixes
    if (options.json) {
      displayFixesJSON(enhancedFixes, migration);
    } else {
      displayFixesHuman(enhancedFixes, migration, isDryRun);
    }

    // Save migration if output path specified
    if (options.output || !isDryRun) {
      const outputPath = options.output || join(absolutePath, '.devsync', 'migrations', `fix_${Date.now()}.sql`);
      const outputDir = join(outputPath, '..');
      
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      
      writeFileSync(outputPath, migration.sql);
      
      if (migration.rollback) {
        const rollbackPath = outputPath.replace('.sql', '_rollback.sql');
        writeFileSync(rollbackPath, migration.rollback);
      }

      if (!options.json) {
        console.log(chalk.green(`\n✅ Migration saved to: ${outputPath}`));
        if (migration.rollback) {
          console.log(chalk.gray(`   Rollback saved to: ${outputPath.replace('.sql', '_rollback.sql')}`));
        }
      }
    }

    // Apply migration if requested (dangerous!)
    if (options.apply && !isDryRun) {
      // Re-validate before applying if not already validated
      if (!migration.validation && dbConnection) {
        if (!options.json) {
          console.log(chalk.gray('\n🔍 Validating migration before applying...'));
        }
        const { validateMigration } = await import('../services/migration-validator.js');
        const validation = await validateMigration(migration.sql, {
          connectionString: dbConnection,
          currentSchema: dbSchema.tables,
          strictMode: false,
          checkPermissions: true,
          checkBreakingChanges: true
        });
        
        if (!validation.valid) {
          if (options.json) {
            console.log(JSON.stringify({
              status: 'error',
              error: 'Migration validation failed',
              validation
            }, null, 2));
          } else {
            console.log(chalk.red('\n❌ Migration validation failed! Cannot apply.'));
            displayValidationResults(validation);
          }
          await closeDatabaseConnections();
          process.exit(1);
        }
      }
      
      if (!options.json) {
        console.log(chalk.yellow('\n⚠️  Applying migration to database...'));
      }
      // TODO: Implement actual database migration application
      // This should be done carefully with proper transaction handling
      if (!options.json) {
        console.log(chalk.red('❌ Auto-apply not yet implemented. Please review and apply migration manually.'));
      }
    }

    await closeDatabaseConnections();

    // Exit with appropriate code
    if (diff.mismatches.some(m => m.severity === 'error')) {
      process.exit(1);
    }
  } catch (error) {
    await closeDatabaseConnections().catch(() => {});
    
    if (error instanceof Error) {
      if (options.json) {
        console.log(JSON.stringify({
          status: 'error',
          error: error.message
        }, null, 2));
      } else {
        console.error(chalk.red(`❌ Error: ${error.message}`));
      }
    } else {
      if (options.json) {
        console.log(JSON.stringify({
          status: 'error',
          error: 'Unknown error occurred'
        }, null, 2));
      } else {
        console.error(chalk.red('❌ Unknown error occurred'));
      }
    }
    process.exit(1);
  }
}

interface EnhancedFix {
  mismatch: Mismatch;
  explanation: string;
  sql: string;
  safety: 'safe' | 'caution' | 'risky' | 'unknown';
  impact?: string;
}

async function generateAIFixes(
  mismatches: Mismatch[],
  codeSchema: any,
  dbSchema: any,
  basePath: string,
  options: {
    useOllama?: boolean;
    ollamaModel?: string;
    ollamaUrl?: string;
    aiProvider?: 'puter' | 'openai' | 'deepseek';
  }
): Promise<EnhancedFix[]> {
  // Try to get auth config for service API
  let authConfig;
  let serviceApiUrl: string | undefined;
  let serviceApiKey: string | undefined;

  try {
    authConfig = await requireAuthenticatedCli();
    if (authConfig?.apiUrl && authConfig?.accessToken) {
      serviceApiUrl = authConfig.apiUrl;
      serviceApiKey = authConfig.accessToken;
    }
  } catch {
    // Auth not available, will use Ollama or fallback
  }

  // Use Ollama if enabled
  if (options.useOllama) {
    return generateFixesWithOllama(mismatches, codeSchema, dbSchema, options);
  }

  // Use service API if available
  if (serviceApiUrl && serviceApiKey) {
    try {
      return await generateFixesWithServiceAPI(
        mismatches,
        codeSchema,
        dbSchema,
        serviceApiUrl,
        serviceApiKey,
        options.aiProvider || 'puter'
      );
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Service API failed, using basic fixes'));
    }
  }

  // Fallback to basic fixes
  return mismatches.map(m => ({
    mismatch: m,
    explanation: generateBasicExplanation(m),
    sql: m.suggestedFix || '',
    safety: determineSafety(m) as 'safe' | 'caution' | 'risky' | 'unknown'
  }));
}

function generateBasicExplanation(mismatch: Mismatch): string {
  switch (mismatch.type) {
    case 'missing_table':
      return `Table "${mismatch.model}" exists in code but not in database. This will cause runtime errors when the application tries to access this table.`;
    case 'missing_field':
      return `Field "${mismatch.field}" in table "${mismatch.model}" exists in code but not in database. This will cause errors when the application tries to access this field.`;
    case 'type_mismatch':
      return `Type mismatch for field "${mismatch.field}" in table "${mismatch.model}". Code expects ${mismatch.codeValue} but database has ${mismatch.dbValue}. This may cause data conversion issues.`;
    case 'constraint_mismatch':
      return `Constraint mismatch for field "${mismatch.field}" in table "${mismatch.model}". Nullability differs between code and database.`;
    case 'extra_field':
      return `Field "${mismatch.field}" exists in database but not in code. This may be intentional or indicate code drift.`;
    default:
      return 'Schema mismatch detected.';
  }
}

function determineSafety(mismatch: Mismatch): 'safe' | 'caution' | 'risky' | 'unknown' {
  switch (mismatch.type) {
    case 'missing_table':
      return 'safe';
    case 'missing_field':
      return mismatch.severity === 'error' ? 'caution' : 'safe';
    case 'type_mismatch':
      return 'risky';
    case 'constraint_mismatch':
      return 'caution';
    case 'extra_field':
      return 'risky';
    default:
      return 'unknown';
  }
}

async function generateFixesWithOllama(
  mismatches: Mismatch[],
  codeSchema: any,
  dbSchema: any,
  options: {
    ollamaModel?: string;
    ollamaUrl?: string;
  }
): Promise<EnhancedFix[]> {
  // Basic implementation - can be enhanced with actual Ollama API calls
  return mismatches.map(m => ({
    mismatch: m,
    explanation: generateBasicExplanation(m),
    sql: m.suggestedFix || '',
    safety: determineSafety(m) as 'safe' | 'caution' | 'risky' | 'unknown'
  }));
}

async function generateFixesWithServiceAPI(
  mismatches: Mismatch[],
  codeSchema: any,
  dbSchema: any,
  apiUrl: string,
  apiKey: string,
  aiProvider: 'puter' | 'openai' | 'deepseek'
): Promise<EnhancedFix[]> {
  // Basic implementation - can be enhanced with actual service API calls
  return mismatches.map(m => ({
    mismatch: m,
    explanation: generateBasicExplanation(m),
    sql: m.suggestedFix || '',
    safety: determineSafety(m) as 'safe' | 'caution' | 'risky' | 'unknown'
  }));
}

function displayFixesHuman(
  fixes: EnhancedFix[],
  migration: any,
  isDryRun: boolean
) {
  console.log(chalk.blue(`\n🔧 ${fixes.length} Fix(es) Generated ${isDryRun ? '(DRY RUN)' : ''}\n`));

  // Group by safety level
  const safe = fixes.filter(f => f.safety === 'safe');
  const caution = fixes.filter(f => f.safety === 'caution');
  const risky = fixes.filter(f => f.safety === 'risky');

  if (safe.length > 0) {
    console.log(chalk.green(`✅ Safe Fixes (${safe.length}):`));
    for (const fix of safe) {
      console.log(chalk.gray(`   • ${fix.mismatch.model}.${fix.mismatch.field || 'table'}`));
      console.log(chalk.gray(`     ${fix.explanation}`));
    }
    console.log('');
  }

  if (caution.length > 0) {
    console.log(chalk.yellow(`⚠️  Caution Fixes (${caution.length}):`));
    for (const fix of caution) {
      console.log(chalk.gray(`   • ${fix.mismatch.model}.${fix.mismatch.field || 'table'}`));
      console.log(chalk.gray(`     ${fix.explanation}`));
    }
    console.log('');
  }

  if (risky.length > 0) {
    console.log(chalk.red(`⚠️  Risky Fixes (${risky.length}):`));
    for (const fix of risky) {
      console.log(chalk.gray(`   • ${fix.mismatch.model}.${fix.mismatch.field || 'table'}`));
      console.log(chalk.gray(`     ${fix.explanation}`));
      console.log(chalk.red(`     ⚠️  Review carefully - may cause data loss!`));
    }
    console.log('');
  }

  console.log(chalk.blue('📄 Migration SQL:'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(migration.sql);
  console.log(chalk.gray('─'.repeat(60)));

  if (isDryRun) {
    console.log(chalk.yellow('\n💡 This is a dry run. Use --apply to apply fixes (use with caution!)'));
  }
}

function displayFixesJSON(
  fixes: EnhancedFix[],
  migration: any
) {
  console.log(JSON.stringify({
    status: 'success',
    fixes: fixes.map(f => ({
      type: f.mismatch.type,
      model: f.mismatch.model,
      field: f.mismatch.field,
      explanation: f.explanation,
      sql: f.sql,
      safety: f.safety,
      severity: f.mismatch.severity
    })),
    migration: {
      id: migration.id,
      name: migration.name,
      description: migration.description,
      sql: migration.sql,
      rollback: migration.rollback,
      validation: migration.validation
    }
  }, null, 2));
}

function displayValidationResults(validation: ReturnType<typeof generateMigration>['validation']) {
  if (!validation) {
    return;
  }

  const { errors, warnings, breakingChanges, summary } = validation;

  // Display summary
  console.log(chalk.blue('📊 Validation Results:\n'));
  console.log(chalk.gray(`   Total Issues: ${summary.totalIssues}`));
  console.log(
    summary.errorCount > 0 
      ? chalk.red(`   Errors: ${summary.errorCount}`)
      : chalk.green(`   Errors: ${summary.errorCount}`)
  );
  console.log(
    summary.warningCount > 0
      ? chalk.yellow(`   Warnings: ${summary.warningCount}`)
      : chalk.gray(`   Warnings: ${summary.warningCount}`)
  );
  console.log(
    summary.breakingChangeCount > 0
      ? chalk.red(`   Breaking Changes: ${summary.breakingChangeCount}`)
      : chalk.gray(`   Breaking Changes: ${summary.breakingChangeCount}`)
  );

  // Display errors
  if (errors.length > 0) {
    console.log(chalk.red('\n❌ Errors:'));
    for (const error of errors) {
      console.log(chalk.red(`   • ${error.message}`));
      if (error.line) {
        console.log(chalk.gray(`     Line ${error.line}`));
      }
      if (error.suggestion) {
        console.log(chalk.gray(`     💡 ${error.suggestion}`));
      }
    }
  }

  // Display warnings
  if (warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️  Warnings:'));
    for (const warning of warnings) {
      console.log(chalk.yellow(`   • ${warning.message}`));
      if (warning.line) {
        console.log(chalk.gray(`     Line ${warning.line}`));
      }
      if (warning.suggestion) {
        console.log(chalk.gray(`     💡 ${warning.suggestion}`));
      }
    }
  }

  // Display breaking changes
  if (breakingChanges.length > 0) {
    console.log(chalk.red('\n🚨 Breaking Changes:'));
    for (const change of breakingChanges) {
      console.log(chalk.red(`   • ${change.message}`));
      if (change.affectedTable) {
        console.log(chalk.gray(`     Table: ${change.affectedTable}${change.affectedColumn ? `, Column: ${change.affectedColumn}` : ''}`));
      }
      if (change.impact) {
        console.log(chalk.gray(`     Impact: ${change.impact}`));
      }
      if (change.mitigation) {
        console.log(chalk.gray(`     💡 ${change.mitigation}`));
      }
    }
  }

  console.log(''); // Empty line
}
