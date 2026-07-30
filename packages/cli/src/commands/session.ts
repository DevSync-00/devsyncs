import chalk from 'chalk';
import { deleteAuthConfig, isTokenExpired, loadAuthConfig } from '../lib/auth-config.js';

export async function logoutCommand(): Promise<void> {
  await deleteAuthConfig();
  console.log(chalk.green('Signed out of Dev-Sync.'));
}

export async function sessionCommand(): Promise<void> {
  const auth = await loadAuthConfig();
  if (!auth) {
    console.log(chalk.yellow('Not signed in. Run devsync login.'));
    return;
  }

  console.log(chalk.green('Signed in to Dev-Sync.'));
  if (auth.userId) console.log(chalk.gray(`User ID: ${auth.userId}`));
  console.log(chalk.gray(`Dashboard: ${auth.apiUrl || 'https://www.dev-sync.dev'}`));
  console.log(chalk.gray(`Access token: ${isTokenExpired(auth.expiresAt, 0) ? 'expired (refresh available)' : 'active'}`));
}
