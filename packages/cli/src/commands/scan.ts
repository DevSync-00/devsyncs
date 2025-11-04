import { scanCodebase } from '../services/code-scanner.js';
import { scanDatabase } from '../services/db-scanner.js';
import { compareSchemas } from '../services/diff-engine.js';
import { loadConfig } from '../utils/config.js';
import { ApiClient } from '../services/api-client.js';
import { saveScanResults, getScanExitCode } from '../utils/output.js';
import chalk from 'chalk';
import { resolve } from 'path';
import type { ScanOptions } from '../types/index.js';

export async function scanCommand(options: ScanOptions) {
  try {
    console.log(chalk.blue('🔍 Scanning codebase and database...\n'));

    // Resolve path to absolute path
    // If path is already absolute, use it; otherwise resolve from cwd
    const absolutePath = options.path.startsWith('/') || /^[A-Z]:/.test(options.path)
      ? options.path
      : resolve(process.cwd(), options.path);

    // Load config if exists
    const config = options.config ? await loadConfig(options.config) : null;
    const dbConnection = options.db || config?.database?.connectionString;

    // API settings
    const projectId = options.projectId || config?.project?.id;
    const apiUrl = options.apiUrl || config?.api?.url;
    const apiKey = options.apiKey || config?.api?.key;
    const shouldSync = options.sync !== false && projectId && apiUrl && apiKey;

    // 1. Scan codebase (extract schema - Prisma, TypeORM, Sequelize, Drizzle, or Raw SQL, or AI)
    console.log(chalk.gray('📁 Scanning codebase...'));
    // Check if AI analysis is requested
    const useAI = options.aiAnalysis || !!process.env.OPENAI_API_KEY || !!process.env.OLLAMA_URL;
    const useOllama = options.useOllama || !!process.env.OLLAMA_URL;
    const openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
    const ollamaUrl = options.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    const ollamaModel = options.ollamaModel || process.env.OLLAMA_MODEL || 'llama3.2:3b';
    
    // Prefer Ollama (free, local) if enabled
    if (useAI && useOllama) {
      console.log(chalk.blue('🤖 Using Ollama (local, free) for AI analysis...'));
      console.log(chalk.gray(`   Model: ${ollamaModel}`));
      console.log(chalk.gray(`   URL: ${ollamaUrl}\n`));
    } else if (useAI && openaiApiKey) {
      console.log(chalk.blue('🤖 Using AI-powered code analysis (OpenAI)...'));
    } else if (useAI && !openaiApiKey && !useOllama) {
      console.error(chalk.red('❌ Error: --ai-analysis requires either:'));
      console.error(chalk.gray('   --use-ollama (local, free)'));
      console.error(chalk.gray('   OR --openai-api-key flag / OPENAI_API_KEY environment variable'));
      process.exit(1);
    }
    
    const codeSchema = await scanCodebase(absolutePath, {
      useAI: !!useAI,
      openaiApiKey: useOllama ? undefined : (openaiApiKey || undefined),
      useOllama: !!useOllama,
      ollamaModel: ollamaModel,
      ollamaUrl: ollamaUrl
    });
    console.log(chalk.green(`✅ Code schema extracted (${codeSchema.models.length} models)\n`));

    // 2. Scan database (if connection provided)
    if (!dbConnection) {
      console.log(chalk.yellow('⚠️  No database connection provided'));
      console.log(chalk.gray('💡 Tip: Use --db flag or set in .devsync/config.json'));
      console.log(chalk.gray('💡 Example: devsync scan --db postgresql://user:pass@localhost/db\n'));
      
      // Show what we found in code
      console.log(chalk.blue('📋 Models found in codebase:\n'));
      codeSchema.models.forEach((model) => {
        console.log(chalk.cyan(`  • ${model.name}`));
        model.fields.forEach((field) => {
          console.log(chalk.gray(`    - ${field.name}: ${field.type}`));
        });
      });

      // Try to sync to cloud even without DB
      if (shouldSync) {
        await syncToCloud(apiUrl, apiKey, projectId, codeSchema, null, []);
      }
      return;
    }

    console.log(chalk.gray('🗄️  Scanning database...'));
    const dbSchema = await scanDatabase(dbConnection);
    console.log(chalk.green(`✅ Database schema extracted (${dbSchema.models.length} tables)\n`));

    // 3. Compare schemas
    console.log(chalk.gray('🔬 Comparing schemas...'));
    const diff = compareSchemas(codeSchema, dbSchema);
    console.log(chalk.green('✅ Comparison complete\n'));

    // 4. Display results
    if (options.json) {
      // JSON output mode (for CI/CD)
      console.log(JSON.stringify({
        mismatches: diff.mismatches,
        warnings: diff.warnings,
        metadata: {
          ...diff.metadata,
          timestamp: diff.metadata.timestamp.toISOString(),
        },
        summary: {
          totalMismatches: diff.mismatches.length,
          errors: diff.mismatches.filter(m => m.severity === 'error').length,
          warnings: diff.mismatches.filter(m => m.severity === 'warning').length,
          info: diff.mismatches.filter(m => m.severity === 'info').length,
        },
      }, null, 2));
    } else {
      displayResults(diff);
    }

    // 5. Save results to file if output path specified
    if (options.output) {
      const resultsPath = saveScanResults(absolutePath, diff, options.output);
      console.log(chalk.gray(`\n📄 Results saved to: ${resultsPath}\n`));
    }

    // 6. Sync to cloud if configured
    if (shouldSync) {
      await syncToCloud(apiUrl, apiKey, projectId, codeSchema, dbSchema, diff.mismatches);
    }

    // 7. Exit with appropriate code for CI/CD
    const exitCode = getScanExitCode(diff, options.failOnWarnings || false);
    if (exitCode !== 0) {
      if (options.json) {
        // In JSON mode, we still exit with error code
        process.exit(exitCode);
      } else {
        process.exit(exitCode);
      }
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

function displayResults(diff: ReturnType<typeof compareSchemas>) {
  if (diff.mismatches.length === 0) {
    console.log(chalk.green('✨ No mismatches found! Everything is in sync.\n'));
    return;
  }

  console.log(chalk.yellow(`⚠️  Found ${diff.mismatches.length} mismatch(es):\n`));
  
  // Group by severity
  const errors = diff.mismatches.filter(m => m.severity === 'error');
  const warnings = diff.mismatches.filter(m => m.severity === 'warning');
  const infos = diff.mismatches.filter(m => m.severity === 'info');

  if (errors.length > 0) {
    console.log(chalk.red(`🔴 Errors (${errors.length}):\n`));
    errors.forEach((mismatch, i) => {
      console.log(chalk.red(`  ${i + 1}. ${mismatch.type.toUpperCase()}: ${mismatch.model}${mismatch.field ? '.' + mismatch.field : ''}`));
      if (mismatch.codeValue) console.log(chalk.gray(`     Code: ${mismatch.codeValue}`));
      if (mismatch.dbValue) console.log(chalk.gray(`     DB:   ${mismatch.dbValue}`));
      console.log();
    });
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow(`🟡 Warnings (${warnings.length}):\n`));
    warnings.forEach((mismatch, i) => {
      console.log(chalk.yellow(`  ${i + 1}. ${mismatch.type.toUpperCase()}: ${mismatch.model}${mismatch.field ? '.' + mismatch.field : ''}`));
      if (mismatch.codeValue) console.log(chalk.gray(`     Code: ${mismatch.codeValue}`));
      if (mismatch.dbValue) console.log(chalk.gray(`     DB:   ${mismatch.dbValue}`));
      console.log();
    });
  }

  if (infos.length > 0) {
    console.log(chalk.blue(`ℹ️  Info (${infos.length}):\n`));
    infos.forEach((mismatch, i) => {
      console.log(chalk.blue(`  ${i + 1}. ${mismatch.type.toUpperCase()}: ${mismatch.model}${mismatch.field ? '.' + mismatch.field : ''}`));
      console.log();
    });
  }

  console.log(chalk.gray('\n💡 Run `devsync scan --help` for more options'));
}

async function syncToCloud(
  apiUrl: string,
  apiKey: string,
  projectId: string,
  codeSchema: any,
  dbSchema: any | null,
  mismatches: any[]
) {
  try {
    console.log(chalk.gray('\n☁️  Syncing results to dashboard...'));
    
    const apiClient = new ApiClient({ apiUrl, apiKey });
    
    const result = await apiClient.sendScanReport({
      projectId,
      codeSchema,
      dbSchema: dbSchema || undefined,
      mismatches,
      metadata: {
        codeVersion: codeSchema.type,
        dbVersion: dbSchema?.type || 'none',
        timestamp: new Date(),
      },
    });

    console.log(chalk.green(`✅ Scan report synced to dashboard!`));
    console.log(chalk.gray(`   Scan ID: ${result.scanId}`));
    console.log(chalk.gray(`   View in dashboard: ${apiUrl}/dashboard/projects/${projectId}\n`));
  } catch (error) {
    if (error instanceof Error) {
      console.log(chalk.yellow(`⚠️  Failed to sync to cloud: ${error.message}`));
      console.log(chalk.gray('   Results are still available locally\n'));
    } else {
      console.log(chalk.yellow('⚠️  Failed to sync to cloud\n'));
    }
  }
}

