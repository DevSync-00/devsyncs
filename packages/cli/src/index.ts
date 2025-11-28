#!/usr/bin/env node
import { program } from 'commander';
import { scanCommand } from './commands/scan.js';
import { initCommand } from './commands/init.js';
import { migrateCommand } from './commands/migrate.js';
import { loginCommand } from './commands/login.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const version = packageJson.version;

program
  .name('devsync')
  .description('AI-powered schema synchronization tool for modern development')
  .version(version)
  .addHelpText('after', `
Examples:
  $ devsync init                    Initialize DevSync in current project
  $ devsync login                   Authenticate with DevSync dashboard
  $ devsync scan                    Scan codebase and database for mismatches
  $ devsync scan --ai-analysis      Use AI to analyze codebase patterns
  $ devsync migrate                 Generate migration SQL from mismatches
  $ devsync migrate --dry-run       Preview migration without applying

For more information, visit: https://devsync.ai/docs
  `);

program
  .command('scan')
  .description('Scan codebase and database for schema mismatches')
  .option('-p, --path <path>', 'Codebase path to scan (default: current directory)', process.cwd())
  .option('-d, --db <connection>', 'Database connection string (e.g., postgresql://user:pass@host:5432/db)')
  .option('--config <path>', 'Path to DevSync config file', '.devsync/config.json')
  .option('--project-id <id>', 'Project ID from DevSync dashboard (for cloud sync)')
  .option('--api-url <url>', 'Dashboard API URL (default: from config or env)')
  .option('--api-key <key>', 'API key / JWT token for authentication')
  .option('--sync', 'Sync scan results to cloud dashboard (default: true)', true)
  .option('--no-sync', 'Run scan locally without syncing to dashboard')
  .option('-o, --output <path>', 'Save JSON results to file path')
  .option('--json', 'Output results in JSON format (useful for scripting)')
  .option('--fail-on-warnings', 'Exit with non-zero code if warnings are found')
  .option('--ai-analysis', 'Use AI to analyze codebase and infer schema from code patterns')
  .option('--openai-api-key <key>', 'OpenAI API key (or set OPENAI_API_KEY env var)')
  .option('--use-ollama', 'Use Ollama (local, free) instead of OpenAI for AI analysis')
  .option('--ollama-model <model>', 'Ollama model name (default: llama3.2:3b)', 'llama3.2:3b')
  .option('--ollama-url <url>', 'Ollama API URL (default: http://localhost:11434)', 'http://localhost:11434')
  .addHelpText('after', `
Examples:
  $ devsync scan                                    Scan current directory
  $ devsync scan --db postgresql://...              Scan with database connection
  $ devsync scan --ai-analysis --use-ollama         Use local AI for analysis
  $ devsync scan --no-sync                          Local scan only (no cloud sync)
  $ devsync scan --json -o results.json             Save results to JSON file

The scan command compares your codebase schema (Prisma, TypeORM, etc.) with your
database schema and identifies mismatches. Results can be synced to the DevSync
dashboard for visualization and migration generation.
  `)
  .action(scanCommand);

program
  .command('init')
  .description('Initialize DevSync configuration in current project')
  .option('-p, --path <path>', 'Project path to initialize (default: current directory)', process.cwd())
  .addHelpText('after', `
Examples:
  $ devsync init                    Initialize in current directory
  $ devsync init -p ./my-project    Initialize in specific directory

This command creates a .devsync/config.json file with default settings.
You can edit this file to configure database connections, project settings, etc.
  `)
  .action(initCommand);

program
  .command('migrate')
  .description('Generate migration SQL from detected schema mismatches')
  .option('-p, --path <path>', 'Codebase path (default: current directory)', process.cwd())
  .option('-d, --db <connection>', 'Database connection string')
  .option('--config <path>', 'Path to DevSync config file', '.devsync/config.json')
  .option('-o, --output <path>', 'Output file path (default: .devsync/migrations/migration_<timestamp>.sql)')
  .option('--format <format>', 'Migration format: sql or prisma (default: sql)', 'sql')
  .option('--dry-run', 'Generate migration without saving to disk (preview only)')
  .option('--apply', 'Apply migration automatically to database (use with caution!)')
  .option('--no-rollback', 'Skip generating rollback script')
  .addHelpText('after', `
Examples:
  $ devsync migrate                      Generate migration SQL
  $ devsync migrate --dry-run            Preview migration without saving
  $ devsync migrate --format prisma      Generate Prisma migration format
  $ devsync migrate --apply              Generate and apply migration (dangerous!)

This command generates SQL migration scripts based on schema mismatches detected
by the scan command. Always review migrations before applying them to production.
  `)
  .action(migrateCommand);

program
  .command('login')
  .description('Authenticate CLI with DevSync dashboard using OAuth device flow')
  .addHelpText('after', `
Examples:
  $ devsync login                       Start authentication flow

This command opens your browser to authenticate with the DevSync dashboard.
After successful authentication, your credentials are saved locally for
future CLI operations. You can use --no-sync to skip authentication.
  `)
  .action(loginCommand);

program.parse();

