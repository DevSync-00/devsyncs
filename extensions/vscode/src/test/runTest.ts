import * as path from 'path';
import * as fs from 'fs';
import { runTests } from '@vscode/test-electron';

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const maxAttempts = 3;
  const retryDelayMs = 3000;

  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to test runner
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    const vscodeCachePath = path.resolve(extensionDevelopmentPath, '.vscode-test');

    // Clear stale VS Code test host cache to avoid "currently being updated" lock state.
    if (fs.existsSync(vscodeCachePath)) {
      fs.rmSync(vscodeCachePath, { recursive: true, force: true });
    }

    // Download VS Code, unzip it and run the integration test
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await runTests({
          extensionDevelopmentPath,
          extensionTestsPath,
        });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isUpdatingError = message.includes('currently being updated');
        const isLastAttempt = attempt === maxAttempts;

        if (!isUpdatingError || isLastAttempt) {
          throw error;
        }

        console.warn(
          `VS Code test host is still updating (attempt ${attempt}/${maxAttempts}). Retrying in ${retryDelayMs}ms...`
        );
        await sleep(retryDelayMs);
      }
    }
  } catch (err) {
    console.error('Failed to run tests');
    process.exit(1);
  }
}

main();

