#!/usr/bin/env node
import { program } from 'commander';
import { scanCommand } from './commands/scan.js';
import { initCommand } from './commands/init.js';
import { migrateCommand } from './commands/migrate.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const version = packageJson.version;

program
  .name('devsync')
  .description('AI-powered schema sync for modern development')
  .version(version);

program
  .command('scan')
  .description('Scan codebase and database for mismatches')
  .option('-p, --path <path>', 'Codebase path', process.cwd())
  .option('-d, --db <connection>', 'Database connection string')
  .option('--config <path>', 'Config file path', '.devsync/config.json')
  .option('--project-id <id>', 'Project ID from dashboard')
  .option('--api-url <url>', 'Dashboard API URL')
  .option('--api-key <key>', 'API key / JWT token')
  .option('--sync', 'Sync results to cloud dashboard', true)
  .option('--no-sync', 'Don\'t sync to cloud (local only)')
  .option('-o, --output <path>', 'Output JSON results file path')
  .option('--json', 'Output JSON format instead of human-readable')
  .option('--fail-on-warnings', 'Exit with error code on warnings')
  .action(scanCommand);

program
  .command('init')
  .description('Initialize DevSync in current project')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(initCommand);

program
  .command('migrate')
  .description('Generate migration SQL from schema mismatches')
  .option('-p, --path <path>', 'Codebase path', process.cwd())
  .option('-d, --db <connection>', 'Database connection string')
  .option('--config <path>', 'Config file path', '.devsync/config.json')
  .option('-o, --output <path>', 'Output file path (default: .devsync/migrations/migration_<timestamp>.sql)')
  .option('--format <format>', 'Migration format (sql|prisma)', 'sql')
  .option('--dry-run', 'Generate migration without saving')
  .option('--apply', 'Apply migration automatically (use with caution)')
  .option('--no-rollback', 'Skip generating rollback script')
  .action(migrateCommand);

program.parse();

