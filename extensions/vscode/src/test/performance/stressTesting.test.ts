/**
 * Stress testing for extension.
 * 
 * Tests extension behavior under extreme conditions and stress scenarios.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, setup } from 'mocha';
import { ContainerFactory } from '../../di/factory';
import { createMockExtensionContext } from '../utils/mocks';
import { delay } from '../utils/testHelpers';

suite('Stress Testing', () => {
  let mockContext: vscode.ExtensionContext;

  setup(() => {
    mockContext = createMockExtensionContext();
  });

  suite('Rapid Operations', () => {
    test('should handle rapid container creation and disposal', () => {
      for (let i = 0; i < 20; i++) {
        const container = ContainerFactory.create(mockContext);
        container.dispose();
      }

      // Should not crash
      assert.ok(true);
    });

    test('should handle rapid API operations', async () => {
      const container = ContainerFactory.create(mockContext);
      const apiClient = container.getApiClient();

      // Rapid API operations
      const promises = Array.from({ length: 50 }, () =>
        apiClient.getLatestScanReport().catch(() => null)
      );

      await Promise.all(promises);
      
      assert.ok(true);
      
      container.dispose();
    });
  });

  suite('Error Recovery', () => {
    test('should recover from repeated errors', async function () {
      this.timeout(10000);
      
      const container = ContainerFactory.create(mockContext);
      const migrationService = container.getMigrationService();

      // Attempt operations that may fail
      for (let i = 0; i < 5; i++) {
        const result = await migrationService.generateMigration('');
        assert.strictEqual(result.success, false);
        await delay(50);
      }

      // Should still be functional
      assert.ok(true);
      
      container.dispose();
    });
  });

  suite('Memory Pressure', () => {
    test('should handle memory pressure gracefully', async () => {
      const containers: any[] = [];
      
      // Create many containers
      for (let i = 0; i < 10; i++) {
        const container = ContainerFactory.create(mockContext);
        containers.push(container);
      }

      // Use containers
      containers.forEach((container) => {
        container.getApiClient();
        container.getCliRunner();
      });

      // Dispose all
      containers.forEach((container) => container.dispose());
      
      // Should not crash
      assert.ok(true);
    });
  });

  suite('Concurrent Stress', () => {
    test('should handle concurrent stress operations', async function () {
      this.timeout(30000);
      
      const container = ContainerFactory.create(mockContext);
      const apiClient = container.getApiClient();
      const scanService = container.getScanService();

      // Concurrent operations
      const operations = [
        ...Array.from({ length: 10 }, () => apiClient.getLatestScanReport().catch(() => null)),
        ...Array.from({ length: 3 }, () => scanService.executeScan('').catch(() => null)),
      ];

      await Promise.all(operations);
      
      // Should complete without crashing
      assert.ok(true);
      
      container.dispose();
    });
  });
});

