import { scanCodebase } from '../services/code-scanner.js';
import { scanDatabase, closeDatabaseConnections } from '../services/db-scanner.js';
import { compareSchemas } from '../services/diff-engine.js';
import { loadConfig } from '../utils/config.js';
import chalk from 'chalk';
import { resolve } from 'path';
import type { ScanOptions } from '../types/index.js';

export interface StatusOptions {
  path?: string;
  db?: string;
  config?: string;
  json?: boolean;
  aiAnalysis?: boolean;
  aiProvider?: 'puter' | 'openai' | 'deepseek';
  useOllama?: boolean;
  ollamaModel?: string;
  ollamaUrl?: string;
}

export async function statusCommand(options: StatusOptions = {}) {
  try {
    const absolutePath = options.path 
      ? (options.path.startsWith('/') || /^[A-Z]:/.test(options.path)
          ? options.path
          : resolve(process.cwd(), options.path))
      : process.cwd();

    // Load config if exists
    const config = options.config ? await loadConfig(options.config) : null;
    const dbConnection = options.db || config?.database?.connectionString;

    // Show AI model info if using AI
    if (!options.json && options.aiAnalysis !== false && !options.useOllama) {
      const provider = options.aiProvider || 'puter';
      const { getModelInfo } = await import('../utils/ai-provider-resolver.js');
      const modelInfo = getModelInfo(provider as any);
      console.log(chalk.blue(`🤖 AI Model: ${modelInfo.displayName}`));
      console.log(chalk.gray(`   Provider: ${modelInfo.provider} | Model: ${modelInfo.model}\n`));
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
    }

    // Compare schemas if both exist
    let diff;
    if (codeSchema && dbSchema) {
      diff = compareSchemas(codeSchema, dbSchema);
    }

    // Display status
    if (options.json) {
      displayStatusJSON(codeSchema, dbSchema, diff);
    } else {
      displayStatusHuman(codeSchema, dbSchema, diff);
    }

    await closeDatabaseConnections();

    // Exit with appropriate code
    if (diff && diff.mismatches.some(m => m.severity === 'error')) {
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

function displayStatusHuman(
  codeSchema: any,
  dbSchema: any,
  diff: any
) {
  console.log(chalk.blue('\n📊 Schema Status Summary\n'));

  // Code schema status
  if (codeSchema) {
    console.log(chalk.green('✅ Code Schema:'));
    console.log(chalk.gray(`   Type: ${codeSchema.type}`));
    console.log(chalk.gray(`   Models: ${codeSchema.models.length}`));
    console.log(chalk.gray(`   Total Fields: ${codeSchema.models.reduce((sum: number, m: any) => sum + m.fields.length, 0)}`));
  } else {
    console.log(chalk.yellow('⚠️  Code Schema: Not detected'));
  }

  // Database schema status
  if (dbSchema) {
    console.log(chalk.green('\n✅ Database Schema:'));
    console.log(chalk.gray(`   Type: ${dbSchema.type}`));
    console.log(chalk.gray(`   Tables: ${dbSchema.models.length}`));
    console.log(chalk.gray(`   Total Columns: ${dbSchema.models.reduce((sum: number, m: any) => sum + m.fields.length, 0)}`));
  } else {
    console.log(chalk.yellow('\n⚠️  Database Schema: Not connected'));
    console.log(chalk.gray('   Use --db <connection> to scan database'));
  }

  // Diff status
  if (diff) {
    const errors = diff.mismatches.filter((m: any) => m.severity === 'error');
    const warnings = diff.mismatches.filter((m: any) => m.severity === 'warning');
    const infos = diff.mismatches.filter((m: any) => m.severity === 'info');

    console.log(chalk.blue('\n📈 Schema Drift:'));
    
    if (diff.mismatches.length === 0) {
      console.log(chalk.green('   ✅ No mismatches detected - schemas are in sync!'));
    } else {
      if (errors.length > 0) {
        console.log(chalk.red(`   ❌ ${errors.length} error(s)`));
      }
      if (warnings.length > 0) {
        console.log(chalk.yellow(`   ⚠️  ${warnings.length} warning(s)`));
      }
      if (infos.length > 0) {
        console.log(chalk.gray(`   ℹ️  ${infos.length} info(s)`));
      }

      // Show breakdown by type
      const byType: Record<string, number> = {};
      for (const mismatch of diff.mismatches) {
        byType[mismatch.type] = (byType[mismatch.type] || 0) + 1;
      }

      console.log(chalk.gray('\n   Breakdown:'));
      for (const [type, count] of Object.entries(byType)) {
        console.log(chalk.gray(`     ${type}: ${count}`));
      }
    }
  } else {
    console.log(chalk.yellow('\n⚠️  Cannot compare: Database connection required'));
  }

  console.log('');
}

function displayStatusJSON(
  codeSchema: any,
  dbSchema: any,
  diff: any
) {
  const status = {
    codeSchema: codeSchema ? {
      type: codeSchema.type,
      modelCount: codeSchema.models.length,
      fieldCount: codeSchema.models.reduce((sum: number, m: any) => sum + m.fields.length, 0)
    } : null,
    dbSchema: dbSchema ? {
      type: dbSchema.type,
      tableCount: dbSchema.models.length,
      columnCount: dbSchema.models.reduce((sum: number, m: any) => sum + m.fields.length, 0)
    } : null,
    drift: diff ? {
      totalMismatches: diff.mismatches.length,
      errors: diff.mismatches.filter((m: any) => m.severity === 'error').length,
      warnings: diff.mismatches.filter((m: any) => m.severity === 'warning').length,
      infos: diff.mismatches.filter((m: any) => m.severity === 'info').length,
      byType: diff.mismatches.reduce((acc: Record<string, number>, m: any) => {
        acc[m.type] = (acc[m.type] || 0) + 1;
        return acc;
      }, {}),
      inSync: diff.mismatches.length === 0
    } : null,
    timestamp: new Date().toISOString()
  };

  console.log(JSON.stringify(status, null, 2));
}
