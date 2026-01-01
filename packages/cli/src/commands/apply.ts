import type { OutputFormat } from '../types/index.js';
import chalk from 'chalk';

interface ApplyOptions {
  format?: OutputFormat;
}

export async function applyCommand(options: ApplyOptions = {}) {
  const format = (options.format || 'table') as OutputFormat;
  const payload = {
    status: 'blocked' as const,
    reason: 'no_approved_plan',
    message: 'Apply is disabled in Phase 1. Database writes are blocked by default.',
    warnings: ['DB writes require explicit opt-in and previews (not available in Phase 1).']
  };

  if (format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(chalk.red('❌ Apply blocked'));
    console.log(chalk.gray('Reason: no approved plan or canonical schema available.'));
    console.log(chalk.yellow('DB writes are disabled by default. Enable only with explicit approval in later phases.'));
  }
}

