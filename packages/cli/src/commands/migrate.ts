import { scanCodebase } from '../services/code-scanner.js';
import { scanDatabase } from '../services/db-scanner.js';
import { compareSchemas } from '../services/diff-engine.js';
import { generateMigration } from '../services/migration-generator.js';
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
      dryRun: options.dryRun
    };

    const migration = generateMigration(
      diff.mismatches,
      codeSchema,
      migrationOptions
    );

    // 6. Display migration preview
    displayMigrationPreview(migration);

    // 7. Save migration file
    const outputPath = options.output || getDefaultOutputPath(absolutePath);
    saveMigration(migration, outputPath, migrationOptions.format || 'sql');

    // 8. Apply migration if requested
    if (options.apply && !options.dryRun) {
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

