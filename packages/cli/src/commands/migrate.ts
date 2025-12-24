import { scanCodebase } from '../services/code-scanner.js';
import { scanDatabase } from '../services/db-scanner.js';
import { compareSchemas } from '../services/diff-engine.js';
import { generateMigration, generateAndValidateMigration } from '../services/migration-generator.js';
import { loadConfig } from '../utils/config.js';
import chalk from 'chalk';
import { resolve } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { ScanOptions } from '../types/index.js';
import type { MigrationOptions } from '../services/migration-generator.js';

export interface MigrateOptions extends ScanOptions {
  output?: string;
  format?: 'sql' | 'prisma';
  dryRun?: boolean;
  apply?: boolean;
  includeRollback?: boolean;
}

export async function migrateCommand(options: MigrateOptions) {
  try {
    console.log(chalk.blue('🔧 Generating migration...\n'));

    // Resolve path to absolute path
    const absolutePath = options.path.startsWith('/') || /^[A-Z]:/.test(options.path)
      ? options.path
      : resolve(process.cwd(), options.path);

    // Load config if exists
    const config = options.config ? await loadConfig(options.config) : null;
    const dbConnection = options.db || config?.database?.connectionString;

    if (!dbConnection) {
      console.log(chalk.red('❌ Database connection required for migrations'));
      console.log(chalk.gray('💡 Tip: Use --db flag or set in .devsync/config.json'));
      console.log(chalk.gray('💡 Example: devsync migrate --db postgresql://user:pass@localhost/db\n'));
      process.exit(1);
    }

    // 1. Scan codebase
    console.log(chalk.gray('📁 Scanning codebase...'));
    const codeSchema = await scanCodebase(absolutePath);
    console.log(chalk.green(`✅ Code schema extracted (${codeSchema.models.length} models)\n`));

    // 2. Scan database
    console.log(chalk.gray('🗄️  Scanning database...'));
    const dbSchema = await scanDatabase(dbConnection);
    console.log(chalk.green(`✅ Database schema extracted (${dbSchema.models.length} tables)\n`));

    // 3. Compare schemas
    console.log(chalk.gray('🔬 Comparing schemas...'));
    const diff = compareSchemas(codeSchema, dbSchema);
    console.log(chalk.green('✅ Comparison complete\n'));

    // 4. Check if there are mismatches
    if (diff.mismatches.length === 0) {
      console.log(chalk.green('✨ No mismatches found! Everything is in sync.\n'));
      console.log(chalk.gray('💡 No migration needed.\n'));
      return;
    }

    // 5. Generate migration
    console.log(chalk.gray(`📝 Generating migration for ${diff.mismatches.length} mismatch(es)...\n`));
    
    const migrationOptions: MigrationOptions = {
      outputPath: options.output,
      format: options.format || 'sql',
      includeRollback: options.includeRollback !== false,
      dryRun: options.dryRun,
      checkBreakingChanges: true,
      checkPermissions: true
    };

    // Generate and validate migration
    let migration;
    if (dbConnection) {
      console.log(chalk.gray('🔍 Validating migration...'));
      migration = await generateAndValidateMigration(
        diff.mismatches,
        codeSchema,
        dbSchema,
        dbConnection,
        migrationOptions
      );
      
      // Display validation results
      displayValidationResults(migration.validation);
      
      // Warn if validation failed
      if (!migration.validation.valid) {
        console.log(chalk.red('\n❌ Migration validation failed!'));
        console.log(chalk.yellow('⚠️  Review errors above before applying.\n'));
        
        if (options.apply) {
          console.log(chalk.red('❌ Cannot apply migration with validation errors.'));
          console.log(chalk.gray('   Fix the errors and try again.\n'));
          process.exit(1);
        }
      } else if (migration.validation.summary.warningCount > 0 || migration.validation.summary.breakingChangeCount > 0) {
        console.log(chalk.yellow('\n⚠️  Migration has warnings or breaking changes. Review carefully.\n'));
      } else {
        console.log(chalk.green('✅ Migration validation passed!\n'));
      }
    } else {
      // Generate without validation if no connection
      migration = generateMigration(
        diff.mismatches,
        codeSchema,
        migrationOptions
      );
      console.log(chalk.yellow('⚠️  No database connection - skipping validation\n'));
    }

    // 6. Display migration preview
    displayMigrationPreview(migration);

    // 7. Save migration file
    const outputPath = options.output || getDefaultOutputPath(absolutePath);
    saveMigration(migration, outputPath, migrationOptions.format || 'sql');

    // 8. Apply migration if requested
    if (options.apply && !options.dryRun) {
      // Re-validate before applying if not already validated
      if (!migration.validation && dbConnection) {
        console.log(chalk.gray('\n🔍 Validating migration before applying...'));
        const { validateMigration } = await import('../services/migration-validator.js');
        const validation = await validateMigration(migration.sql, {
          connectionString: dbConnection,
          currentSchema: dbSchema.tables,
          strictMode: false,
          checkPermissions: true,
          checkBreakingChanges: true
        });
        
        if (!validation.valid) {
          console.log(chalk.red('\n❌ Migration validation failed! Cannot apply.'));
          displayValidationResults(validation);
          process.exit(1);
        }
      }
      
      console.log(chalk.gray('\n🔄 Applying migration...'));
      await applyMigration(dbConnection, migration);
      console.log(chalk.green('✅ Migration applied successfully!\n'));
    } else if (!options.dryRun) {
      console.log(chalk.gray('\n💡 Tip: Run with --apply to apply the migration automatically'));
      console.log(chalk.gray('   Or apply manually: psql <connection> < migration.sql\n'));
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      if (error.stack && process.env.DEBUG) {
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red('❌ Unknown error occurred'));
    }
    process.exit(1);
  }
}

function displayMigrationPreview(migration: ReturnType<typeof generateMigration>) {
  console.log(chalk.blue('📋 Migration Preview:\n'));
  console.log(chalk.gray(`   Name: ${migration.name}`));
  console.log(chalk.gray(`   ID: ${migration.id}`));
  console.log(chalk.gray(`   Description: ${migration.description}`));
  console.log(chalk.gray(`   Mismatches: ${migration.mismatches.length}\n`));
  
  // Show summary by type
  const counts: Record<string, number> = {};
  for (const mismatch of migration.mismatches) {
    counts[mismatch.type] = (counts[mismatch.type] || 0) + 1;
  }
  
  console.log(chalk.gray('   Summary:'));
  for (const [type, count] of Object.entries(counts)) {
    console.log(chalk.gray(`     - ${type}: ${count}`));
  }
  
  console.log(chalk.gray(`\n   SQL Preview:\n${chalk.dim(migration.sql.split('\n').slice(0, 15).join('\n'))}...\n`));
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

function getDefaultOutputPath(projectPath: string): string {
  const migrationsDir = join(projectPath, '.devsync', 'migrations');
  return join(migrationsDir, `migration_${Date.now()}.sql`);
}

function saveMigration(
  migration: ReturnType<typeof generateMigration>,
  outputPath: string,
  format: 'sql' | 'prisma'
) {
  try {
    // Create directory if it doesn't exist
    const dir = resolve(outputPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Write migration file
    let content = migration.sql;
    
    if (format === 'sql' && migration.rollback) {
      content += '\n\n' + migration.rollback;
    }

    writeFileSync(outputPath, content, 'utf-8');
    
    console.log(chalk.green(`✅ Migration saved to: ${outputPath}\n`));
    
    if (migration.rollback) {
      const rollbackPath = outputPath.replace('.sql', '_rollback.sql');
      writeFileSync(rollbackPath, migration.rollback, 'utf-8');
      console.log(chalk.green(`✅ Rollback script saved to: ${rollbackPath}\n`));
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to save migration: ${error.message}`);
    }
    throw error;
  }
}

async function applyMigration(
  dbConnection: string,
  migration: ReturnType<typeof generateMigration>
) {
  try {
    // Validate before applying if not already validated
    if (!migration.validation) {
      console.log(chalk.gray('🔍 Validating migration before applying...'));
      const { validateMigration } = await import('../services/migration-validator.js');
      const { scanDatabase } = await import('../services/db-scanner.js');
      
      // Get current schema for validation
      const dbSchema = await scanDatabase({ connectionString: dbConnection });
      
      const validation = await validateMigration(migration.sql, {
        connectionString: dbConnection,
        currentSchema: dbSchema.tables,
        strictMode: false,
        checkPermissions: true,
        checkBreakingChanges: true
      });
      
      if (!validation.valid) {
        console.log(chalk.red('\n❌ Migration validation failed! Cannot apply.'));
        displayValidationResults(validation);
        throw new Error('Migration validation failed');
      }
      
      if (validation.summary.warningCount > 0 || validation.summary.breakingChangeCount > 0) {
        console.log(chalk.yellow('⚠️  Migration has warnings or breaking changes.'));
        const proceed = await new Promise<boolean>((resolve) => {
          // In CLI, we'll just warn and continue
          // In interactive mode, could prompt user
          console.log(chalk.yellow('⚠️  Proceeding with application...'));
          resolve(true);
        });
        
        if (!proceed) {
          throw new Error('Migration application cancelled by user');
        }
      } else {
        console.log(chalk.green('✅ Validation passed!\n'));
      }
    }
    
    // Import pg dynamically
    const { Client } = await import('pg');
    
    const client = new Client({ connectionString: dbConnection });
    await client.connect();
    
    try {
      // Split SQL by semicolons (simple approach)
      const statements = migration.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.toUpperCase().startsWith('BEGIN') || 
            statement.toUpperCase().startsWith('COMMIT')) {
          continue;
        }
        
        await client.query(statement);
      }
    } finally {
      await client.end();
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to apply migration: ${error.message}`);
    }
    throw error;
  }
}

