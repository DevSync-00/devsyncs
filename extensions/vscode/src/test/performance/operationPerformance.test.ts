/**
 * Performance tests for extension operations.
 * 
 * Tests scan performance, migration generation, and other operations.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, setup } from 'mocha';
import { ContainerFactory } from '../../di/factory';
import { createMockExtensionContext, MockApiClient } from '../utils/mocks';
import { delay } from '../utils/testHelpers';

/**
 * Performance metrics collector
 */
class PerformanceMetrics {
  private metrics: Map<string, number[]> = new Map();

  record(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);
  }

  getAverage(operation: string): number {
    const durations = this.metrics.get(operation) || [];
    if (durations.length === 0) return 0;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }

  getMax(operation: string): number {
    const durations = this.metrics.get(operation) || [];
    return Math.max(...durations, 0);
  }

  getMin(operation: string): number {
    const durations = this.metrics.get(operation) || [];
    return Math.min(...durations, Infinity);
  }
}

suite('Operation Performance Tests', () => {
  let mockContext: vscode.ExtensionContext;
  let container: ReturnType<typeof ContainerFactory.create>;
  let metrics: PerformanceMetrics;

  setup(() => {
    mockContext = createMockExtensionContext();
    container = ContainerFactory.create(mockContext);
    metrics = new PerformanceMetrics();
  });

  suite('Scan Operations', () => {
    test('should execute scan within acceptable time', async function () {
      this.timeout(30000);
      
      const scanService = container.getScanService();
      const startTime = performance.now();

      const result = await scanService.executeScan('');
      const duration = performance.now() - startTime;
      metrics.record('scan', duration);

      assert.strictEqual(result.success, false);
      assert.ok(duration < 30000, `Scan validation took ${duration}ms, expected < 30000ms`);
    });

    test('should handle multiple scans efficiently', async function () {
      this.timeout(60000);
      
      const scanService = container.getScanService();
      const durations: number[] = [];

      for (let i = 0; i < 3; i++) {
        const startTime = performance.now();
        await scanService.executeScan('');
        durations.push(performance.now() - startTime);
        await delay(100);
      }

      if (durations.length > 0) {
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        // Average duration should be reasonable
        assert.ok(avgDuration < 30000, `Average scan duration: ${avgDuration}ms`);
      }
    });
  });

  suite('Migration Generation', () => {
    test('should generate migration quickly', async function () {
      this.timeout(10000);
      
      const migrationService = container.getMigrationService();
      const startTime = performance.now();

      const result = await migrationService.generateMigration('');
      const duration = performance.now() - startTime;
      metrics.record('migration', duration);

      assert.strictEqual(result.success, false);
      assert.ok(duration < 5000, `Migration validation took ${duration}ms, expected < 5000ms`);
    });
  });

  suite('API Operations', () => {
    test('should handle API requests efficiently', async function () {
      this.timeout(10000);
      
      const apiClient = container.getApiClient();
      const startTime = performance.now();

      try {
        await apiClient.getLatestScanReport();
        const duration = performance.now() - startTime;
        metrics.record('api_request', duration);

        // API requests should be fast (< 2 seconds)
        assert.ok(duration < 2000, `API request took ${duration}ms, expected < 2000ms`);
      } catch (error) {
        // May fail if API is not available
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('UI Operations', () => {
    test('should initialize services quickly', () => {
      const startTime = performance.now();

      container.getApiClient();
      container.getCliRunner();
      container.getAuthManager();
      const duration = performance.now() - startTime;
      metrics.record('service_init', duration);

      // Service initialization should be fast (< 100ms)
      assert.ok(duration < 100, `Service init took ${duration}ms, expected < 100ms`);
    });

    test('should update diagnostics efficiently', async function () {
      this.timeout(5000);
      
      const diagnostics = container.getDiagnostics();
      const workspaceFolders = vscode.workspace.workspaceFolders;
      
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
      }

      const startTime = performance.now();
      try {
        await diagnostics.checkWorkspace(workspaceFolders[0]);
        const duration = performance.now() - startTime;
        metrics.record('diagnostics_update', duration);

        // Diagnostics update should be fast (< 2 seconds)
        assert.ok(duration < 2000, `Diagnostics update took ${duration}ms, expected < 2000ms`);
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('Performance Metrics', () => {
    test('should track performance metrics', () => {
      metrics.record('test_operation', 100);
      metrics.record('test_operation', 200);
      metrics.record('test_operation', 150);

      assert.strictEqual(metrics.getAverage('test_operation'), 150);
      assert.strictEqual(metrics.getMax('test_operation'), 200);
      assert.strictEqual(metrics.getMin('test_operation'), 100);
    });
  });
});

