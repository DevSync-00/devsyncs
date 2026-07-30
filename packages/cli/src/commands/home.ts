import path from 'path';
import chalk from 'chalk';
import { loadAuthConfig } from '../lib/auth-config.js';
import { loadConfig } from '../utils/config.js';
import { detectProjectInfo } from '../utils/project-detector.js';
import { isInteractive, promptInput, promptSelect } from '../utils/prompt.js';
import { createProjectCommand, selectProjectCommand } from './projects.js';
import { loginCommand } from './login.js';
import { logoutCommand, sessionCommand } from './session.js';
import { scanCommand } from './scan.js';
import { reportCommand } from './report.js';
import { migrateCommand } from './migrate.js';

type HomeAction =
  | 'account'
  | 'create'
  | 'select'
  | 'scan'
  | 'report'
  | 'migrate'
  | 'local-scan'
  | 'logout'
  | 'exit';

export interface HomeState {
  authenticated: boolean;
  userId?: string;
  projectId?: string;
  projectName?: string;
  schemaType?: string;
}

export async function getHomeState(root = process.cwd()): Promise<HomeState> {
  const [auth, config] = await Promise.all([
    loadAuthConfig(),
    loadConfig(path.join(path.resolve(root), '.devsync', 'config.json')).catch(() => null),
  ]);
  return {
    authenticated: Boolean(auth),
    userId: auth?.userId,
    projectId: config?.project.id || undefined,
    projectName: config?.project.name,
    schemaType: config?.project.schemaType,
  };
}

export async function homeCommand(root = process.cwd()): Promise<void> {
  if (!isInteractive()) {
    console.log('Run `devsync --help` for commands or use an interactive terminal for the guided workflow.');
    return;
  }

  while (true) {
    const state = await getHomeState(root);
    printHome(state);
    const action = await promptSelect<HomeAction>('Choose what to do:', [
      {
        label: state.authenticated ? 'View account' : 'Sign in to Dev-Sync',
        value: 'account',
        description: state.authenticated ? state.userId || 'Connected' : 'Connect this CLI to your account',
      },
      { label: 'Create project', value: 'create', description: 'Create locally and sync to your account' },
      { label: 'Select project', value: 'select', description: 'Link an existing dashboard project' },
      { label: 'Scan schema', value: 'scan', description: 'Run the connected dashboard scan' },
      { label: 'View latest report', value: 'report', description: 'Review schema mismatches' },
      { label: 'Generate migration', value: 'migrate', description: 'Create a reviewed migration plan' },
      { label: 'Scan locally', value: 'local-scan', description: 'Offline, read-only scan' },
      ...(state.authenticated
        ? [{ label: 'Sign out', value: 'logout' as const, description: 'Remove this CLI session' }]
        : []),
      { label: 'Exit', value: 'exit', description: 'Close Dev-Sync' },
    ]);

    if (!action || action === 'exit') return;
    try {
      if (action === 'account') {
        if (state.authenticated) await sessionCommand();
        else await loginCommand();
      } else if (action === 'create') {
        await guidedCreate(root);
      } else if (action === 'select') {
        await selectProjectCommand({ path: root });
      } else if (action === 'scan') {
        await scanCommand({ path: root, format: 'table' });
      } else if (action === 'report') {
        await reportCommand({ path: root, format: 'table' });
      } else if (action === 'migrate') {
        await guidedMigration(root);
      } else if (action === 'local-scan') {
        await scanCommand({ path: root, format: 'table', local: true });
      } else if (action === 'logout') {
        await logoutCommand();
      }
    } catch (error) {
      console.log(chalk.red(error instanceof Error ? error.message : String(error)));
    }
    console.log('');
  }
}

function printHome(state: HomeState): void {
  console.log(chalk.blue.bold('\nDev-Sync Schema Guard'));
  console.log(chalk.gray('Account  ->  Project  ->  Scan  ->  Report  ->  Migration\n'));
  console.log(`${chalk.gray('Account:')} ${state.authenticated ? chalk.green(state.userId || 'Connected') : chalk.yellow('Not signed in')}`);
  console.log(`${chalk.gray('Project:')} ${state.projectId ? chalk.green(state.projectName || state.projectId) : chalk.yellow('Not selected')}`);
  if (state.schemaType) console.log(`${chalk.gray('Schema:')} ${state.schemaType}`);
  console.log('');
}

async function guidedCreate(root: string): Promise<void> {
  const detected = detectProjectInfo(root);
  const name = await promptInput(`Project name [${detected.name}]`);
  const schemaType = await promptSelect('Select the schema type:', [
    'prisma',
    'supabase',
    'typeorm',
    'kysely',
    'sequelize',
    'drizzle',
    'django',
    'sqlalchemy',
    'raw-sql',
  ].map((value) => ({
    label: value,
    value,
    description: value === detected.schemaType ? 'Detected' : undefined,
  })));
  await createProjectCommand({
    path: root,
    name: name || detected.name,
    schemaType: schemaType || detected.schemaType || 'raw-sql',
  });
}

async function guidedMigration(root: string): Promise<void> {
  const configPath = path.join(path.resolve(root), '.devsync', 'config.json');
  const config = await loadConfig(configPath);
  const savedConnection = config?.database.connectionString;
  const connection = savedConnection || await promptInput('Database connection string');
  if (!connection) {
    console.log(chalk.yellow('A database connection is required to generate a migration.'));
    return;
  }
  await migrateCommand({
    path: root,
    config: configPath,
    db: connection,
    dryRun: true,
    apply: false,
    includeRollback: true,
    format: 'sql',
  });
}
