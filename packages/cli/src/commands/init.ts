import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import type { InitOptions } from '../types/index.js';
import { requireAuthenticatedCli } from '../lib/auth-check.js';

export async function initCommand(options: InitOptions) {
  try {
    await requireAuthenticatedCli();

    const configPath = join(options.path, '.devsync');
    const configFile = join(configPath, 'config.json');

    // Check if already initialized
    if (existsSync(configFile)) {
      console.log(chalk.yellow('⚠️  DevSync is already initialized in this project'));
      console.log(chalk.gray(`   Config file: ${configFile}\n`));
      return;
    }

    // Create .devsync directory
    if (!existsSync(configPath)) {
      mkdirSync(configPath, { recursive: true });
    }

    // Create default config
    const defaultConfig = {
      version: '1.0',
      project: {
        name: '',
        schemaType: 'prisma', // prisma, typeorm, raw-sql
        id: '' // Project ID from dashboard (optional)
      },
      database: {
        connectionString: '', // Will be prompted or set via --db flag
        provider: 'postgresql' // postgresql, mysql, sqlite
      },
      scan: {
        watch: false,
        autoFix: false
      },
      api: {
        url: '', // Dashboard API URL (e.g., http://localhost:3000)
        key: '', // API key / JWT token (optional)
        enabled: false // Whether to sync to cloud by default
      }
    };

    writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));

    console.log(chalk.green('✅ DevSync initialized successfully!\n'));
    console.log(chalk.gray(`📁 Config file created: ${configFile}\n`));
    console.log(chalk.blue('📝 Next steps:'));
    console.log(chalk.gray('  1. Edit .devsync/config.json with your database connection'));
    console.log(chalk.gray('  2. (Optional) Set api.url and api.key to sync to dashboard'));
    console.log(chalk.gray('  3. Run: devsync scan\n'));

  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
    } else {
      console.error(chalk.red('❌ Unknown error occurred'));
    }
    process.exit(1);
  }
}

