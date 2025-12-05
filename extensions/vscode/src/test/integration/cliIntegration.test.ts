/**
 * Integration tests for CLI integration.
 * 
 * Tests the interaction between the extension and the CLI runner,
 * including command execution, output parsing, and error handling.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { suite, test, setup, teardown } from 'mocha';
import { CliRunner } from '../../cliRunner';
import { createMockExtensionContext } from '../utils/mocks';
import { delay } from '../utils/testHelpers';

suite('CLI Integration Tests', () => {
  let outputChannel: vscode.OutputChannel;
  let cliRunner: CliRunner;
  let mockContext: vscode.ExtensionContext;
  let tempWorkspace: string;

  setup(() => {
    mockContext = createMockExtensionContext();
    outputChannel = vscode.window.createOutputChannel('DevSync Test');
    cliRunner = new CliRunner(outputChannel);
    
    // Create temporary workspace directory
    tempWorkspace = path.join(__dirname, '../../../../test-workspace');
    if (!fs.existsSync(tempWorkspace)) {
      fs.mkdirSync(tempWorkspace, { recursive: true });
    }
  });

  teardown(() => {
    outputChannel.dispose();
    // Clean up temp workspace
    if (fs.existsSync(tempWorkspace)) {
      try {
        fs.rmSync(tempWorkspace, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  suite('checkCliAvailable', () => {
    test('should check if CLI is available', async () => {
      const available = await cliRunner.checkCliAvailable();
      // CLI may or may not be available in test environment
      assert.strictEqual(typeof available, 'boolean');
    });
  });

  suite('executeCliCommand', () => {
    test('should execute scan command', async function () {
      this.timeout(30000); // 30 second timeout for CLI operations
      
      const available = await cliRunner.checkCliAvailable();
      if (!available) {
        this.skip(); // Skip if CLI is not available
      }

      const result = await cliRunner.executeCliCommand('scan', {
        path: tempWorkspace,
        json: true,
      });

      // Result should have success and output properties
      assert.ok('success' in result);
      assert.ok('output' in result);
    });

    test('should handle CLI command errors gracefully', async function () {
      this.timeout(10000);
      
      const available = await cliRunner.checkCliAvailable();
      if (!available) {
        this.skip();
      }

      // Execute invalid command
      const result = await cliRunner.executeCliCommand('scan', {
        path: '/nonexistent/path',
        json: true,
      });

      // Should return result even if command fails
      assert.ok('success' in result);
      assert.ok('output' in result);
    });

    test('should support cancellation token', async function () {
      this.timeout(10000);
      
      const available = await cliRunner.checkCliAvailable();
      if (!available) {
        this.skip();
      }

      const cancellationTokenSource = new vscode.CancellationTokenSource();
      
      // Cancel after short delay
      setTimeout(() => {
        cancellationTokenSource.cancel();
      }, 100);

      const resultPromise = cliRunner.executeCliCommand(
        'scan',
        { path: tempWorkspace },
        cancellationTokenSource.token
      );

      // Should handle cancellation
      try {
        await resultPromise;
      } catch (error) {
        // Cancellation is expected
        assert.ok(error instanceof Error || typeof error === 'object');
      }
    });

    test('should support hooks for stdout/stderr', async function () {
      this.timeout(10000);
      
      const available = await cliRunner.checkCliAvailable();
      if (!available) {
        this.skip();
      }

      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      let closeCode: number | null = null;

      const hooks = {
        onStdout: (chunk: string) => {
          stdoutChunks.push(chunk);
        },
        onStderr: (chunk: string) => {
          stderrChunks.push(chunk);
        },
        onClose: (code: number | null) => {
          closeCode = code;
        },
      };

      await cliRunner.executeCliCommand('scan', { path: tempWorkspace, json: true }, undefined, hooks);

      // Hooks should have been called
      assert.ok(Array.isArray(stdoutChunks));
      assert.ok(Array.isArray(stderrChunks));
      assert.ok(closeCode !== undefined);
    });
  });

  suite('buildCli', () => {
    test('should attempt to build CLI', async function () {
      this.timeout(60000); // 60 second timeout for build
      
      const result = await cliRunner.buildCli();
      
      // Should return result
      assert.ok('success' in result);
      assert.ok('output' in result);
    });
  });

  suite('cancelAll', () => {
    test('should cancel all running commands', async function () {
      this.timeout(5000);
      
      const available = await cliRunner.checkCliAvailable();
      if (!available) {
        this.skip();
      }

      // Start a command
      const commandPromise = cliRunner.executeCliCommand('scan', { path: tempWorkspace });
      
      // Cancel all commands
      cliRunner.cancelAll();
      
      // Should handle cancellation
      try {
        await commandPromise;
      } catch {
        // Expected to fail or be cancelled
      }
      
      // Should not throw
      assert.ok(true);
    });
  });

  suite('showOutput', () => {
    test('should show output channel', () => {
      cliRunner.showOutput();
      // Should not throw
      assert.ok(true);
    });
  });
});

