import path from 'path';
import chalk from 'chalk';
import { authenticatedClient } from './projects.js';
import { loadConfig } from '../utils/config.js';

async function context(options: { path?: string; project?: string }) {
  const root = path.resolve(options.path || process.cwd());
  const config = await loadConfig(path.join(root, '.devsync', 'config.json'));
  const projectId = options.project || config?.project.id;
  if (!projectId) throw new Error('No project selected. Run `devsync select` first or pass --project.');
  return { client: await authenticatedClient(), projectId };
}

function output(value: unknown, json?: boolean) {
  if (json) console.log(JSON.stringify(value, null, 2));
}

export async function plansCommand(options: { path?: string; project?: string; generate?: boolean; objective?: string; json?: boolean }) {
  const { client, projectId } = await context(options);
  const reports = await client.getScanReports(projectId);
  const report = [...reports].sort((a, b) => Date.parse(b.created_at || b.createdAt || '') - Date.parse(a.created_at || a.createdAt || ''))[0];
  const reportId = report?.id || report?.scanId;
  if (!reportId) throw new Error('No scan report exists. Run `devsync scan` first.');
  const result = options.generate
    ? await client.request<any>(`/api/scan-reports/${reportId}/change-plans`, { method: 'POST', body: JSON.stringify({ objective: options.objective }) })
    : await client.request<any>(`/api/scan-reports/${reportId}/change-plans`);
  if (options.json) return output(result, true);
  const plans = result.plan ? [result.plan] : result.plans || [];
  if (!plans.length) return console.log(chalk.yellow('No change plan exists. Run `devsync plan --generate`.'));
  const version = [...(plans[0].versions || [])].sort((a: any, b: any) => b.version - a.version)[0];
  console.log(chalk.blue(`Change plan v${version.version}`));
  console.log(`${chalk.gray('Status:')} ${version.status}`);
  console.log(`${chalk.gray('Risk:')} ${version.risk_score}/100`);
  console.log(`${chalk.gray('Confidence:')} ${Math.round(Number(version.confidence) * 100)}%`);
  for (const step of version.steps || []) console.log(`  ${chalk.cyan(step.phase)}  ${step.title}`);
}

export async function policyCommand(options: { path?: string; project?: string; enforcement?: string; json?: boolean }) {
  const { client, projectId } = await context(options);
  const current = await client.request<any>(`/api/projects/${projectId}/policies`);
  const policy = current.policies?.[0];
  if (options.enforcement) {
    if (!policy) throw new Error('Enable a policy in the dashboard before editing it.');
    const updated = await client.request<any>(`/api/projects/${projectId}/policies`, {
      method: 'PATCH', body: JSON.stringify({ policyId: policy.id, enforcement: options.enforcement }),
    });
    if (options.json) return output(updated, true);
    return console.log(chalk.green(`Policy enforcement changed to ${updated.policy.enforcement}.`));
  }
  if (options.json) return output(current, true);
  console.log(chalk.blue('Change policy'));
  console.log(`${chalk.gray('Enforcement:')} ${policy?.enforcement || 'not enabled'}`);
  for (const rule of policy?.rules || current.recommendedRules || []) {
    console.log(`  ${rule.enabled === false ? chalk.gray('○') : chalk.green('✓')} ${rule.id}`);
  }
}

export async function promoteCommand(options: {
  path?: string; project?: string; target?: string; migration?: string; approve?: string;
  execute?: string; confirm?: string; status?: string; cancel?: string; wait?: boolean; json?: boolean;
}) {
  const { client, projectId } = await context(options);
  let result: any;
  if (options.approve) result = await client.request(`/api/promotions/${options.approve}/approve`, { method: 'POST' });
  else if (options.execute) {
    if (!options.confirm) throw new Error('--confirm is required for execution.');
    result = await client.request(`/api/promotions/${options.execute}/execute`, { method: 'POST', body: JSON.stringify({ confirmationText: options.confirm }) });
  } else if (options.cancel) result = await client.request(`/api/promotions/${options.cancel}/execution`, { method: 'DELETE' });
  else if (options.status) result = await waitForExecution(client, options.status, Boolean(options.wait));
  else if (options.target) result = await client.request(`/api/projects/${projectId}/promotions`, {
    method: 'POST', body: JSON.stringify({ targetEnvironmentId: options.target, migrationId: options.migration }),
  });
  else result = await client.request(`/api/projects/${projectId}/promotions`);
  if (options.json) return output(result, true);
  if (result.targets) {
    for (const target of result.targets) console.log(`${chalk.cyan(target.environment.name)}  ${target.readiness.decision}  ${target.readiness.score}/100`);
    if (result.targets.some((target: any) => target.readiness.decision === 'blocked')) process.exitCode = 2;
  } else {
    const promotion = result.promotion;
    console.log(chalk.green(promotion ? `Promotion ${promotion.id}: ${promotion.status}` : 'Request accepted.'));
    if (result.job) console.log(`${chalk.gray('Job:')} ${result.job.id} (${result.job.status})`);
    if (promotion && ['failed', 'blocked', 'cancelled'].includes(promotion.status)) process.exitCode = promotion.status === 'blocked' ? 2 : 1;
  }
}

async function waitForExecution(client: any, promotionId: string, wait: boolean) {
  do {
    const result = await client.request(`/api/promotions/${promotionId}/execution`);
    if (!wait || !['queued', 'deploying'].includes(result.promotion.status)) return result;
    process.stdout.write(`\r${result.job?.progress?.stage || result.promotion.status} ${result.job?.progress?.percent || 0}%`);
    await new Promise((resolve) => setTimeout(resolve, 2500));
  } while (true);
}
