/**
 * Login Command
 * Implements OAuth Device Flow for CLI authentication
 */

import chalk from 'chalk';
import { AnalyzerApiClient } from '../lib/analyzer-api-client.js';
import { saveAuthConfig, deriveExpiryFromToken, deleteAuthConfig } from '../lib/auth-config.js';
import { open } from '../utils/open-browser.js';
import { buildDeviceVerificationUrl, resolveDashboardUrl } from '../utils/dashboard-url.js';

/**
 * Create a simple spinner for loading states
 */
function createSpinner(message: string): () => void {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frameIndex = 0;
  const silent = process.env.DEVSYNC_SILENT === '1';

  if (silent) {
    return () => {}; // No-op in silent mode
  }

  const interval = setInterval(() => {
    process.stdout.write(`\r${chalk.blue(frames[frameIndex])} ${message}`);
    frameIndex = (frameIndex + 1) % frames.length;
  }, 100);

  return () => {
    clearInterval(interval);
    process.stdout.write('\r' + ' '.repeat(message.length + 10) + '\r');
  };
}

/**
 * Wait for user authorization with progress indication
 */
async function waitForAuthorization(
  client: AnalyzerApiClient,
  deviceCode: string,
  interval: number,
  expiresIn: number,
  verificationUri: string,
  userCode: string
): Promise<void> {
  const silent = process.env.DEVSYNC_SILENT === '1';
  const stopSpinner = silent ? () => {} : createSpinner('Waiting for authorization...');

  try {
    await client.pollDeviceFlowToken(
      deviceCode,
      interval,
      expiresIn,
      (message) => {
        if (!silent) {
          stopSpinner();
          console.log(chalk.gray(`   ${message}`));
          stopSpinner();
        }
      }
    );
  } finally {
    stopSpinner();
  }
}

/**
 * Login command implementation
 */
export async function loginCommand(): Promise<void> {
  const silent = process.env.DEVSYNC_SILENT === '1';
  const log = silent ? () => {} : console.log;
  const logError = (...args: unknown[]) => console.error(...args);

  try {
    log(chalk.blue('🔐 Starting DevSync CLI authentication...\n'));

    const dashboardUrl = resolveDashboardUrl();

    // Create analyzer client (uses dashboard URL for authentication)
    const client = new AnalyzerApiClient(dashboardUrl, {
      timeoutMs: 30000,
      retryAttempts: 3,
    });

    // Start device flow
    log(chalk.gray('📡 Connecting to authentication service...'));
    let deviceFlowData;
    
    try {
      const stopSpinner = createSpinner('Starting device flow...');
      deviceFlowData = await client.startDeviceFlow('cli');
      stopSpinner();
    } catch (error) {
      if (error instanceof Error && /^exit:\d+$/.test(error.message)) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
        logError(chalk.red('\n❌ Failed to connect to authentication service.'));
        logError(chalk.yellow('\n💡 Troubleshooting:'));
        logError(chalk.gray('   1. Ensure the DevSync dashboard is running'));
        logError(chalk.gray(`   2. Check that ${dashboardUrl} is accessible`));
        logError(chalk.gray('   3. Start the dashboard: cd apps/dashboard && npm run dev'));
        logError(chalk.gray('   4. Verify DASHBOARD_URL environment variable if using custom URL'));
        logError(chalk.gray('   5. Check your network connection\n'));
        process.exit(1);
      }
      
      throw error;
    }

    log(chalk.green('✅ Device flow started\n'));

    // Display authorization instructions
    const deviceUrl = buildDeviceVerificationUrl(
      deviceFlowData.verification_uri,
      dashboardUrl,
      deviceFlowData.user_code
    );
    
    log(chalk.bold('📋 Please complete authorization in your browser:\n'));
    log(chalk.white(`   Verification URL: ${chalk.cyan(deviceUrl)}`));
    log(chalk.white(`   User Code: ${chalk.bold(chalk.yellow(deviceFlowData.user_code))}\n`));

    // Try to open browser automatically
    try {
      log(chalk.gray('🌐 Opening browser...'));
      await open(deviceUrl);
      log(chalk.green('✅ Browser opened\n'));
    } catch (error) {
      // Browser opening failed, but that's okay - user can manually open
      log(chalk.yellow('⚠️  Could not open browser automatically'));
      log(chalk.gray('   Please open the URL above manually\n'));
    }

    log(chalk.gray('⏳ Waiting for authorization...'));
    log(chalk.gray(`   (This will timeout after ${Math.floor(deviceFlowData.expires_in / 60)} minutes)\n`));

    // Poll for token
    let tokenData;
    try {
      tokenData = await client.pollDeviceFlowToken(
        deviceFlowData.device_code,
        deviceFlowData.interval,
        deviceFlowData.expires_in,
        (message) => {
          if (!silent) {
            log(chalk.gray(`   ${message}`));
          }
        }
      );
    } catch (error) {
      if (error instanceof Error && /^exit:\d+$/.test(error.message)) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('expired') || errorMessage.includes('timed out')) {
        logError(chalk.red('\n❌ Authorization timed out.'));
        logError(chalk.gray('   The authorization code has expired. Please run `devsync login` again.\n'));
        process.exit(1);
      }
      
      if (errorMessage.includes('authorization_pending')) {
        logError(chalk.red('\n❌ Authorization was not completed in time.'));
        logError(chalk.gray('   Please run `devsync login` again to start a new authorization flow.\n'));
        process.exit(1);
      }
      
      throw error;
    }

    // Derive expiry from token
    let expiresAt: number;
    try {
      expiresAt = deriveExpiryFromToken(tokenData.access_token);
      // Validate that the expiry is in the future
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt <= now) {
        // Token expiry is in the past - this shouldn't happen for a fresh token
        // Fall back to calculating from expires_in
        log(chalk.yellow('⚠️  Token expiry appears invalid, calculating from expires_in'));
        expiresAt = now + tokenData.expires_in;
      }
    } catch (error) {
      log(chalk.yellow('⚠️  Could not parse token expiry, calculating from expires_in'));
      expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;
    }
    
    // Ensure expiresAt is in seconds (not milliseconds)
    // Some tokens might have expiry in milliseconds
    if (expiresAt > 10000000000) {
      // If expiry is > year 2286, it's likely in milliseconds, convert to seconds
      expiresAt = Math.floor(expiresAt / 1000);
    }

    // Calculate refresh token expiry
    const refreshExpiresAt = tokenData.refresh_expires_in
      ? Math.floor(Date.now() / 1000) + tokenData.refresh_expires_in
      : undefined;

    // Save auth config
    try {
      await saveAuthConfig({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt,
        refreshExpiresAt,
        userId: tokenData.user_id,
        clientId: tokenData.client_id,
        apiUrl: dashboardUrl,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(chalk.red(`\n❌ Failed to save authentication: ${errorMessage}`));
      log(chalk.gray('   Your authentication was successful, but we could not save it locally.'));
      log(chalk.gray('   Please check file permissions and try again.\n'));
      process.exit(1);
    }

    log(chalk.green('\n✅ Authentication successful!'));
    log(chalk.gray(`   Your credentials have been saved securely.\n`));

  } catch (error) {
    if (error instanceof Error && /^exit:\d+$/.test(error.message)) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide actionable error messages
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      logError(chalk.red('\n❌ Failed to connect to authentication service.'));
      logError(chalk.yellow('\n💡 Troubleshooting:'));
      logError(chalk.gray('   1. Ensure the DevSync dashboard is running'));
      logError(chalk.gray(`   2. Check that ${resolveDashboardUrl()} is accessible`));
      logError(chalk.gray('   3. Start the dashboard: cd apps/dashboard && npm run dev'));
      logError(chalk.gray('   4. Verify DASHBOARD_URL environment variable if using custom URL'));
      logError(chalk.gray('   5. Check your network connection\n'));
    } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out') || errorMessage.includes('expired')) {
      logError(chalk.red('\n❌ Request timed out.'));
      logError(chalk.yellow('\n💡 Troubleshooting:'));
      logError(chalk.gray('   1. Check your network connection'));
      logError(chalk.gray('   2. The authentication service may be slow or unavailable'));
      logError(chalk.gray('   3. Try again in a few moments\n'));
    } else {
      logError(chalk.red(`\n❌ Authentication failed: ${errorMessage}\n`));
    }
    
    process.exit(1);
  }
}

