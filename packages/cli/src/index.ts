#!/usr/bin/env node
import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { scanCommand } from './commands/scan.js';
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';
import { fixCommand } from './commands/fix.js';
import { applyCommand } from './commands/apply.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const version = packageJson.version;

program
  .name('devsync')
  .description('Database-first schema synchronization assistant (safe by default)')
  .version(version);

program
  .command('init')
  .description('Initialize DevSync configuration with safe defaults')
  .option('-p, --path <path>', 'Project path to initialize (default: current directory)', process.cwd())
  .action(initCommand);

program
  .command('scan')
  .description('Read-only project scan (DB URL → schema files → deep scan hints)')
  .option('-p, --path <path>', 'Codebase path to scan (default: current directory)', process.cwd())
  .option('--format <format>', 'Output format: json|table', 'table')
  .option('--plan-only', 'Force read-only mode (default)', true)
  .option('--allow-writes', 'Allow file writes (ignored in scan)', false)
  .option('--allow-db-writes', 'Allow DB writes (blocked in Phase 1)', false)
  .option('-y, --yes', 'Auto-approve prompts within safe envelope', false)
  .action(scanCommand);

program
  .command('status')
  .description('Summarize last scan (read-only)')
  .option('-p, --path <path>', 'Project path (default: current directory)', process.cwd())
  .option('--format <format>', 'Output format: json|table', 'table')
  .option('-d, --db <connection>', 'Database connection string (optional, for conflict detection)')
  .option('--config <path>', 'Path to DevSync config file', '.devsync/config.json')
  .action(statusCommand);

program
  .command('fix')
  .description('Generate AI-powered fix plan with migrations (preview-only by default)')
  .option('-p, --path <path>', 'Codebase path (default: current directory)', process.cwd())
  .option('-d, --db <connection>', 'Database connection string (required)')
  .option('--config <path>', 'Path to DevSync config file', '.devsync/config.json')
  .option('--format <format>', 'Output format: json|table', 'table')
  .option('--output <path>', 'Save migration SQL to file path')
  .option('--include-low-risk', 'Include low-risk conflicts in fix plan', false)
  .option('--include-info', 'Include info-level conflicts in fix plan', false)
  .option('--api-key <key>', 'AI API key (user-provided, required for AI reasoning)')
  .option('--provider <provider>', 'AI provider: openai|anthropic|ollama', 'openai')
  .option('--model <model>', 'AI model identifier (e.g., gpt-4, claude-3-opus)')
  .option('--ollama-url <url>', 'Ollama API URL (for local AI)', 'http://localhost:11434')
  .option('--yes', 'Auto-approve prompts (still preview-only, no writes)', false)
  .addHelpText('after', `
Examples:
  $ devsync fix --db postgresql://...              Generate fix plan (preview only)
  $ devsync fix --db postgresql://... --output migration.sql  Save migration to file
  $ devsync fix --db postgresql://... --api-key <key>  Include AI reasoning
  $ devsync fix --db postgresql://... --include-low-risk  Include low-risk conflicts

Safety:
  - All fixes are preview-only by default (no writes)
  - Database writes are disabled by default
  - Use --output to save migration for manual review
  - Always review migrations before applying to production
  `)
  .action(fixCommand);

program
  .command('apply')
  .description('Apply fixes (blocked, DB writes disabled by default)')
  .option('--format <format>', 'Output format: json|table', 'table')
  .action(applyCommand);

program.parse();

