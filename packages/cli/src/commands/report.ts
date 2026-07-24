import path from 'path';
import chalk from 'chalk';
import { loadConfig } from '../utils/config.js';
import { authenticatedClient } from './projects.js';
import { loadAuthConfig } from '../lib/auth-config.js';
import { resolveDashboardUrl } from '../utils/dashboard-url.js';

export interface ReportOptions {
  path?: string;
  project?: string;
  format?: 'table' | 'json';
}

export async function reportCommand(options: ReportOptions = {}): Promise<void> {
  const root = path.resolve(options.path || process.cwd());
  const config = await loadConfig(path.join(root, '.devsync', 'config.json'));
  const projectId = options.project || config?.project.id;
  if (!projectId) {
    throw new Error('No project is selected. Run `devsync select` or `devsync create` first.');
  }

  const reports = await (await authenticatedClient()).getScanReports(projectId);
  const latest = [...reports].sort((a, b) =>
    Date.parse(b.createdAt || b.created_at || '') - Date.parse(a.createdAt || a.created_at || '')
  )[0];

  if (!latest) {
    console.log(chalk.yellow('No scan reports are available for this project.'));
    console.log(chalk.gray('Run `devsync scan` to create one.'));
    return;
  }
  if (options.format === 'json') {
    console.log(JSON.stringify(latest, null, 2));
    return;
  }

  const mismatches = latest.mismatches || latest.report?.mismatches || [];
  const reportId = latest.id || latest.scanId || latest.scan_id;
  const createdAt = latest.createdAt || latest.created_at;
  const auth = await loadAuthConfig();
  const dashboardUrl = auth?.apiUrl || resolveDashboardUrl();

  console.log(chalk.blue('Latest schema report\n'));
  console.log(`${chalk.gray('Project:')} ${config?.project.name || projectId}`);
  console.log(`${chalk.gray('Report:')} ${reportId || 'Unknown'}`);
  console.log(`${chalk.gray('Status:')} ${latest.status || 'complete'}`);
  console.log(`${chalk.gray('Created:')} ${createdAt ? new Date(createdAt).toLocaleString() : 'Unknown'}`);
  console.log(`${chalk.gray('Mismatches:')} ${mismatches.length}`);

  for (const mismatch of mismatches.slice(0, 20)) {
    const model = mismatch.model || mismatch.table || 'schema';
    const field = mismatch.field || mismatch.column;
    console.log(`  ${chalk.yellow('-')} ${mismatch.type || 'mismatch'}: ${model}${field ? `.${field}` : ''}`);
  }
  if (mismatches.length > 20) {
    console.log(chalk.gray(`  ...and ${mismatches.length - 20} more`));
  }
  console.log(chalk.gray(`\nDashboard: ${dashboardUrl}/dashboard/projects/${projectId}`));
}
