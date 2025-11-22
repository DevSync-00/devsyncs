import chalk from 'chalk';
import { getConfigPath, isTokenExpired, loadAuthConfig } from '../lib/config.js';

export async function statusCommand() {
  const auth = await loadAuthConfig();
  if (!auth) {
    console.log(chalk.red('✖ Not authenticated.'));
    console.log(chalk.gray('Run `devsync login` to connect this CLI to your account.'));
    process.exitCode = 1;
    return;
  }

  const expired = isTokenExpired(auth, 0);
  console.log(chalk.green('✔ Authentication configuration found.'));
  console.log(chalk.gray(`Stored at ${getConfigPath()}`));
  console.log(`Client: ${chalk.bold(auth.clientId)}`);
  console.log(
    `Access token expires at: ${new Date(auth.expiresAt * 1000).toLocaleString()} ${expired ? chalk.red('(expired)') : ''}`
  );
  console.log(expired ? chalk.yellow('\nToken is stale. The next command will refresh automatically.') : '');
}

