import chalk from 'chalk';
import {
  AnalyzerApiClient,
  DevicePollError,
  deriveExpiryFromToken,
} from '../lib/api-client.js';
import { isTokenExpired, loadAuthConfig, saveAuthConfig } from '../lib/config.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function loginCommand() {
  const client = new AnalyzerApiClient();

  const existing = await loadAuthConfig();
  if (existing && !isTokenExpired(existing)) {
    console.log(chalk.green('✔ You are already logged in.'));
    console.log(chalk.gray(`Access token expires at ${new Date(existing.expiresAt * 1000).toISOString()}`));
    return;
  }

  console.log(chalk.blueBright('\n🔐 Starting secure device authorization flow...\n'));

  const start = await client.startDeviceFlow('cli');

  console.log(chalk.cyan('1. Open your browser to:'));
  console.log(`   ${chalk.underline(start.verification_uri)}\n`);
  console.log(chalk.cyan('2. Enter the code below:'));
  console.log(`   ${chalk.bold(start.user_code)}\n`);
  console.log(chalk.gray('Leave this terminal open. We will poll for approval automatically.\n'));

  const deadline = Date.now() + start.expires_in * 1000;
  let delayMs = start.interval * 1000;

  while (Date.now() < deadline) {
    await sleep(delayMs);
    try {
      const tokens = await client.pollDeviceToken(start.device_code);
      await saveAuthConfig({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: deriveExpiryFromToken(tokens.access_token),
        clientId: tokens.client_id,
      });

      console.log(chalk.green('\n✅ Device approved! DevSync CLI is now authenticated.\n'));
      return;
    } catch (error) {
      if (error instanceof DevicePollError) {
        if (error.code === 'authorization_pending') {
          continue;
        }
        if (error.code === 'slow_down') {
          delayMs += 2000;
          continue;
        }
        if (error.code === 'expired_token') {
          console.error(chalk.red('\n⏰ Device code expired. Please run `devsync login` again.\n'));
          process.exit(1);
        }
      }

      throw error;
    }
  }

  console.error(chalk.red('\n⏰ Device code expired before approval. Please run `devsync login` again.\n'));
  process.exit(1);
}

