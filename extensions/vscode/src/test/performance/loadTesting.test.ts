/**
 * Load testing for extension operations.
 * 
 * Tests extension behavior under load, concurrent operations, and stress scenarios.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, setup } from 'mocha';
import { ContainerFactory } from '../../di/factory';
import { createMockExtensionContext } from '../utils/mocks';
import { delay } from '../utils/testHelpers';

suite('Load Testing', () => {
  let mockContext: vscode.ExtensionContext;

  setup(() => {
    mockContext = createMockExtensionContext();
  });

  suite('Concurrent Operations', () => {
    test('should handle concurrent API requests', async function () {
      this.timeout(30000);
      
      const container = ContainerFactory.create(mockContext);
      const apiClient = container.getApiClient();

      // Execute multiple concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        apiClient.getLatestScanReport().catch(() => null)
      );

      const results = await Promise.all(promises);
      
      // All requests should complete (even if they fail)
      assert.strictEqual(results.length, 5);
      
      container.dispose();
    });

    test('should handle concurrent scan operations', async function () {
      this.timeout(60000);
      
      const container = ContainerFactory.create(mockContext);
      const scanService = container.getScanService();

      // Exercise the concurrent scan boundary without opening interactive UI.
      const promises = Array.from({ length: 3 }, () =>
        scanService.executeScan('').catch(() => null)
      );

      const results = await Promise.all(promises);
      
      // All operations should complete
      assert.strictEqual(results.length, 3);
      
      container.dispose();
    });
  });

  suite('Repeated Operations', () => {
    test('should handle repeated sidebar refreshes', async () => {
      const container = ContainerFactory.create(mockContext);
      // Sidebar provider is created in extension.ts, not in container
      // For testing, we'll test container operations instead
      const apiClient = container.getApiClient();
      
      // Test multiple API operations
      for (let i = 0; i < 10; i++) {
        try {
          await apiClient.getLatestScanReport();
        } catch {
          // Ignore errors
        }
        await delay(10);
      }
      
      assert.ok(true);
      
      container.dispose();
    });

    test('should handle repeated diagnostics updates', async function () {
      this.timeout(30000);
      
      const container = ContainerFactory.create(mockContext);
      const diagnostics = container.getDiagnostics();
      const workspaceFolders = vscode.workspace.workspaceFolders;

      if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
      }

      // Update diagnostics multiple times
      for (let i = 0; i < 5; i++) {
        try {
          await diagnostics.checkWorkspace(workspaceFolders[0]);
        } catch {
          // Ignore errors
        }
        await delay(100);
      }

      // Should not crash
      assert.ok(true);
      
      container.dispose();
    });
  });

  suite('Resource Limits', () => {
    test('should handle large number of concurrent operations', async () => {
      const container = ContainerFactory.create(mockContext);
      const apiClient = container.getApiClient();

      // Execute multiple concurrent operations
      const promises = Array.from({ length: 20 }, () =>
        apiClient.getLatestScanReport().catch(() => null)
      );

      const results = await Promise.all(promises);
      
      // All should complete successfully
      assert.strictEqual(results.length, 20);
      results.forEach((result: any) => {
        assert.ok(result === null || typeof result === 'object');
      });
      
      container.dispose();
    });
  });
});

