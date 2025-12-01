import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import type { InitOptions } from '../types/index.js';
import { detectProjectInfo } from '../utils/project-detector.js';

export async function initCommand(options: InitOptions) {
  try {
    const configPath = join(options.path, '.devsync');
    const configFile = join(configPath, 'config.json');

    // Check if already initialized
    if (existsSync(configFile)) {
      console.log(chalk.yellow('⚠️  DevSync is already initialized in this project'));
      console.log(chalk.gray(`   Config file: ${configFile}\n`));
      return;
    }

    // Auto-detect project information
    console.log(chalk.blue('🔍 Detecting project information...\n'));
    const projectInfo = detectProjectInfo(options.path);
    
    console.log(chalk.gray('   Project name: ') + chalk.cyan(projectInfo.name));
    if (projectInfo.schemaType) {
      console.log(chalk.gray('   Schema type: ') + chalk.cyan(projectInfo.schemaType));
    } else {
      console.log(chalk.yellow('   Schema type: ') + chalk.gray('Not detected (will need to be set manually)'));
    }
    if (projectInfo.gitRemote) {
      console.log(chalk.gray('   Git remote: ') + chalk.cyan(projectInfo.gitRemote));
    }
    if (projectInfo.packageManager) {
      console.log(chalk.gray('   Package manager: ') + chalk.cyan(projectInfo.packageManager));
    }
    console.log();

    // Create .devsync directory
    if (!existsSync(configPath)) {
      mkdirSync(configPath, { recursive: true });
    }

    // Create config with auto-detected values
    const defaultConfig = {
      version: '1.0',
      project: {
        name: projectInfo.name,
        schemaType: projectInfo.schemaType || 'prisma', // Default to prisma if not detected
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
      },
      // Store detected metadata for future reference
      metadata: {
        gitRemote: projectInfo.gitRemote,
        gitBranch: projectInfo.gitBranch,
        packageManager: projectInfo.packageManager,
        description: projectInfo.description,
        detectedAt: new Date().toISOString()
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

