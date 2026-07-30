import chalk from 'chalk';
import { deleteAuthConfig, isTokenExpired, loadAuthConfig } from '../lib/auth-config.js';
import { requireAuthenticatedCli } from '../lib/auth-check.js';

export async function logoutCommand(): Promise<void> {
  await deleteAuthConfig();
  console.log(chalk.green('Signed out of Dev-Sync.'));
}

export async function sessionCommand(): Promise<void> {
  let auth = await loadAuthConfig();
  if (!auth) {
    console.log(chalk.yellow('Not signed in. Run devsync login.'));
    return;
  }

  if (isTokenExpired(auth.expiresAt, 0)) {
    auth = await requireAuthenticatedCli();
  }

  console.log(chalk.green('Signed in to Dev-Sync.'));
  if (auth.userId) console.log(chalk.gray(`User ID: ${auth.userId}`));
  console.log(chalk.gray(`Dashboard: ${auth.apiUrl || 'https://www.dev-sync.dev'}`));
  console.log(chalk.gray('Access token: active'));
}
