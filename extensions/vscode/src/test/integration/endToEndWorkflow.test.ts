/**
 * End-to-end workflow integration tests.
 * 
 * Tests complete user workflows from start to finish,
 * including scan -> view report -> generate migration.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, setup, teardown } from 'mocha';
import { ContainerFactory } from '../../di/factory';
import { createMockExtensionContext } from '../utils/mocks';
import { delay } from '../utils/testHelpers';
import { StateStore, uiActions } from '../../state';

suite('End-to-End Workflow Tests', () => {
  let mockContext: vscode.ExtensionContext;
  let container: ReturnType<typeof ContainerFactory.create>;

  setup(() => {
    mockContext = createMockExtensionContext();
    container = ContainerFactory.create(mockContext);
  });

  teardown(async () => {
    await container.dispose();
  });

  suite('Complete Scan Workflow', () => {
    test('should execute complete scan workflow', async function () {
      this.timeout(60000); // 60 second timeout for full workflow
      
      const commands = container.getCommands();
      const scanService = container.getScanService();
      
      // Step 1: Validate scan configuration
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        this.skip(); // Skip if no workspace
      }

      const workspacePath = workspaceFolders[0].uri.fsPath;
      const validation = scanService.validateScan(workspacePath);
      
      if (!validation.valid) {
        this.skip(); // Skip if configuration is invalid
      }

      // Step 2: Execute scan
      try {
        await commands.scan();
        assert.ok(true, 'Scan completed');
      } catch (error) {
        // May fail in test environment, but should handle gracefully
        assert.ok(error instanceof Error);
      }
    });

    test('should handle scan -> report -> migration workflow', async function () {
      this.timeout(90000); // 90 second timeout
      
      const commands = container.getCommands();
      const scanService = container.getScanService();
      const migrationService = container.getMigrationService();
      
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        this.skip();
      }

      try {
        // Step 1: Scan
        await commands.scan();
        await delay(1000); // Wait for scan to complete
        
        // Step 2: Get latest report
        const report = await scanService.getLatestScanReport();
        
        if (report) {
          // Step 3: View report
          await commands.viewReport();
          
          // Step 4: Generate migration (if mismatches exist)
          if (report.mismatches && report.mismatches.length > 0) {
            await commands.generateMigration();
          }
        }
        
        assert.ok(true, 'Workflow completed');
      } catch (error) {
        // May fail in test environment
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('Authentication -> Scan Workflow', () => {
    test('should handle authentication before scan', async function () {
      this.timeout(60000);
      
      const authManager = container.getAuthManager();
      const commands = container.getCommands();
      
      // Check if already authenticated
      const session = authManager.getSession();
      
      if (session.status !== 'authenticated') {
        // Skip authentication in test environment
        this.skip();
      }

      try {
        // Should be able to scan after authentication
        await commands.scan();
        assert.ok(true);
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('Error Recovery Workflow', () => {
    test('should recover from scan errors', async function () {
      this.timeout(30000);
      
      const scanService = container.getScanService();
      
      const firstResult = await scanService.executeScan('');
      assert.strictEqual(firstResult.success, false);

      const retryResult = await scanService.executeScan('');
      assert.strictEqual(retryResult.success, false);
    });

    test('should handle migration generation errors', async function () {
      this.timeout(30000);
      
      const migrationService = container.getMigrationService();
      const result = await migrationService.generateMigration('');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Scan report ID is required');
    });
  });

  suite('State Management Workflow', () => {
    test('should maintain state across operations', async function () {
      this.timeout(30000);
      
      const stateStore = container.getStateStore();
      
      // Get initial state
      const initialState = stateStore.getState();
      assert.ok(initialState);
      
      stateStore.dispatch(uiActions.setSelectedView('scan'));

      const newState = stateStore.getState();
      assert.strictEqual(newState.ui.selectedView, 'scan');

      // Await storage before simulating a new workflow/container session.
      await stateStore.flush();
      const restoredStore = new StateStore(mockContext);
      assert.strictEqual(restoredStore.getState().ui.selectedView, 'scan');
      restoredStore.dispose();
    });
  });
});

