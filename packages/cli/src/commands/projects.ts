import path from 'path';
import chalk from 'chalk';
import { requireAuthenticatedCli } from '../lib/auth-check.js';
import { loadAuthConfig } from '../lib/auth-config.js';
import { ApiClient } from '../services/api-client.js';
import { loadConfig, saveConfig } from '../utils/config.js';
import { resolveDashboardUrl } from '../utils/dashboard-url.js';
import { detectProjectInfo } from '../utils/project-detector.js';
import { promptSelect } from '../utils/prompt.js';

export async function authenticatedClient() {
  const auth = await requireAuthenticatedCli();
  return new ApiClient({
    apiUrl: auth.apiUrl || resolveDashboardUrl(),
    apiKey: auth.accessToken,
  });
}

export async function selectProjectCommand(options: { path?: string }): Promise<void> {
  const projects = await (await authenticatedClient()).listProjects();
  if (projects.length === 0) {
    console.log(chalk.yellow('No Dev-Sync projects are available for this account.'));
    console.log(chalk.gray('Create one with `devsync create`.'));
    return;
  }

  const selectedId = await promptSelect(
    'Select a Dev-Sync project:',
    projects.map((project) => ({
      label: project.name,
      value: project.id,
      description: [project.schemaType, project.teamId ? 'team' : undefined].filter(Boolean).join(', '),
    }))
  );
  if (!selectedId) return;

  const root = path.resolve(options.path || process.cwd());
  const configPath = path.join(root, '.devsync', 'config.json');
  if (!await loadConfig(configPath)) {
    await createProjectCommand({ path: root, local: true });
  }
  await linkProjectCommand(selectedId, { path: root });
}

export async function projectsCommand(): Promise<void> {
  const projects = await (await authenticatedClient()).listProjects();
  if (projects.length === 0) {
    console.log(chalk.yellow('No Dev-Sync projects are available for this account.'));
    return;
  }

  console.log(chalk.blue('Dev-Sync projects\n'));
  for (const project of projects) {
    console.log(`${chalk.cyan(project.id)}  ${project.name}${project.teamId ? ' (team)' : ''}`);
  }
  console.log(chalk.gray('\nLink one with: devsync link <project-id>'));
}

export async function linkProjectCommand(projectId: string, options: { path?: string }): Promise<void> {
  const client = await authenticatedClient();
  const project = await client.getProject(projectId);
  const root = path.resolve(options.path || process.cwd());
  const configPath = path.join(root, '.devsync', 'config.json');
  const config = await loadConfig(configPath);
  if (!config) {
    throw new Error(`Dev-Sync is not initialized at ${root}. Run devsync init first.`);
  }

  config.project.id = project.id;
  config.project.name = project.name;
  config.project.schemaType = project.schemaType || config.project.schemaType;
  await saveConfig(configPath, config);
  console.log(chalk.green(`Linked this workspace to ${project.name}.`));
  console.log(chalk.gray(`Project ID: ${project.id}`));
  console.log(chalk.gray('Run devsync scan to create a dashboard scan report.'));
}

export interface CreateProjectOptions {
  path?: string;
  name?: string;
  schemaType?: string;
  team?: string;
  local?: boolean;
}

export async function createProjectCommand(options: CreateProjectOptions): Promise<void> {
  const root = path.resolve(options.path || process.cwd());
  const configPath = path.join(root, '.devsync', 'config.json');
  const detected = detectProjectInfo(root);
  const name = options.name?.trim() || detected.name;
  const schemaType = options.schemaType || detected.schemaType || 'raw-sql';
  const existing = await loadConfig(configPath);

  const config = existing || {
    version: '1.0',
    project: { name, schemaType, id: '' },
    database: { mode: 'auto' as const, connectionString: '', writeAccess: false },
    ai: { provider: undefined },
    safety: { allowWrites: false, allowDbWrites: false, requirePlanApproval: true },
    paths: { ignores: [] },
  };

  config.project.name = name;
  config.project.schemaType = schemaType;
  await saveConfig(configPath, config);
  console.log(chalk.green(`Created local Dev-Sync project: ${name}`));
  console.log(chalk.gray(`Config: ${configPath}`));

  if (options.local) {
    console.log(chalk.gray('Local-only project created. Run `devsync create` after signing in to connect it.'));
    return;
  }

  if (config.project.id) {
    console.log(chalk.gray(`Already connected to project ${config.project.id}.`));
    return;
  }

  const savedAuth = await loadAuthConfig();
  if (!savedAuth) {
    console.log(chalk.yellow('Project is ready locally but is not connected to an account.'));
    console.log(chalk.gray('Run `devsync login`, then run `devsync create` again to synchronize it.'));
    return;
  }

  try {
    const client = await authenticatedClient();
    const project = await client.createProject({
      name,
      schemaType,
      teamId: options.team || null,
      dbConnectionString: config.database.connectionString || null,
      codebase: { type: 'cli', url: detected.gitRemote },
    });
    config.project.id = project.id;
    config.project.name = project.name;
    config.project.schemaType = project.schemaType || schemaType;
    await saveConfig(configPath, config);
    console.log(chalk.green(`Connected to Dev-Sync project: ${project.name}`));
    console.log(chalk.gray(`Project ID: ${project.id}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(chalk.yellow('The local project was created, but synchronization is unavailable.'));
    console.log(chalk.gray(message));
  }
}
