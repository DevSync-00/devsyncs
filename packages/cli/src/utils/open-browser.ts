/**
 * Open browser utility
 * Cross-platform browser opening
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Open URL in default browser
 */
export async function open(url: string): Promise<void> {
  const platform = process.platform;

  let command: string;

  switch (platform) {
    case 'win32':
      command = `start "" "${url}"`;
      break;
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'linux':
      // Try xdg-open first, then fallback to other methods
      command = `xdg-open "${url}"`;
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  try {
    await execAsync(command);
  } catch (error) {
    // If command fails, throw with helpful message
    throw new Error(
      `Failed to open browser: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      `Please open ${url} manually.`
    );
  }
}

