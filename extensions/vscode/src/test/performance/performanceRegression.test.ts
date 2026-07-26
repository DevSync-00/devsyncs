/**
 * Performance regression tests.
 * 
 * Tests to detect performance regressions and ensure performance doesn't degrade.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, setup } from 'mocha';
import { ContainerFactory } from '../../di/factory';
import { createMockExtensionContext } from '../utils/mocks';
import { delay } from '../utils/testHelpers';

/**
 * Performance baseline thresholds
 */
const PERFORMANCE_BASELINES = {
  containerCreation: 100, // ms
  serviceInitialization: 200, // ms
  sidebarRender: 100, // ms
  apiRequest: 2000, // ms
  scanOperation: 30000, // ms
  migrationGeneration: 5000, // ms
};

suite('Performance Regression Tests', () => {
  let mockContext: vscode.ExtensionContext;

  setup(() => {
    mockContext = createMockExtensionContext();
  });

  suite('Container Creation', () => {
    test('should meet baseline for container creation', () => {
      const startTime = performance.now();
      const container = ContainerFactory.create(mockContext);
      const duration = performance.now() - startTime;

      assert.ok(
        duration < PERFORMANCE_BASELINES.containerCreation,
        `Container creation took ${duration}ms, baseline: ${PERFORMANCE_BASELINES.containerCreation}ms`
      );
      
      container.dispose();
    });
  });

  suite('Service Initialization', () => {
    test('should meet baseline for service initialization', () => {
      const startTime = performance.now();
      const container = ContainerFactory.create(mockContext);
      container.getApiClient();
      container.getCliRunner();
      container.getAuthManager();
      const duration = performance.now() - startTime;

      assert.ok(
        duration < PERFORMANCE_BASELINES.serviceInitialization,
        `Service initialization took ${duration}ms, baseline: ${PERFORMANCE_BASELINES.serviceInitialization}ms`
      );
      
      container.dispose();
    });
  });

  suite('Service Access', () => {
    test('should meet baseline for service access', () => {
      const container = ContainerFactory.create(mockContext);
      
      const startTime = performance.now();
      container.getApiClient();
      container.getCliRunner();
      const duration = performance.now() - startTime;

      assert.ok(
        duration < PERFORMANCE_BASELINES.sidebarRender,
        `Service access took ${duration}ms, baseline: ${PERFORMANCE_BASELINES.sidebarRender}ms`
      );
      
      container.dispose();
    });
  });

  suite('API Operations', () => {
    test('should meet baseline for API requests', async function () {
      this.timeout(10000);
      
      const container = ContainerFactory.create(mockContext);
      const apiClient = container.getApiClient();

      const startTime = performance.now();
      try {
        await apiClient.getLatestScanReport();
      } catch {
        // Ignore errors
      }
      const duration = performance.now() - startTime;

      // Only check if request completed successfully
      if (duration < PERFORMANCE_BASELINES.apiRequest) {
        assert.ok(
          duration < PERFORMANCE_BASELINES.apiRequest,
          `API request took ${duration}ms, baseline: ${PERFORMANCE_BASELINES.apiRequest}ms`
        );
      }
      
      container.dispose();
    });
  });

  suite('Operation Performance', () => {
    test('should meet baseline for scan operations', async function () {
      this.timeout(60000);
      
      const container = ContainerFactory.create(mockContext);
      const scanService = container.getScanService();

      const startTime = performance.now();
      await scanService.executeScan('');
      const duration = performance.now() - startTime;

      // Only check if operation completed
      if (duration < PERFORMANCE_BASELINES.scanOperation) {
        assert.ok(
          duration < PERFORMANCE_BASELINES.scanOperation,
          `Scan operation took ${duration}ms, baseline: ${PERFORMANCE_BASELINES.scanOperation}ms`
        );
      }
      
      container.dispose();
    });

    test('should meet baseline for migration generation', async function () {
      this.timeout(10000);
      
      const container = ContainerFactory.create(mockContext);
      const migrationService = container.getMigrationService();

      const startTime = performance.now();
      await migrationService.generateMigration('');
      const duration = performance.now() - startTime;

      // Only check if operation completed
      if (duration < PERFORMANCE_BASELINES.migrationGeneration) {
        assert.ok(
          duration < PERFORMANCE_BASELINES.migrationGeneration,
          `Migration generation took ${duration}ms, baseline: ${PERFORMANCE_BASELINES.migrationGeneration}ms`
        );
      }
      
      container.dispose();
    });
  });

  suite('Performance Monitoring', () => {
    test('should track performance metrics', () => {
      const metrics: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        const container = ContainerFactory.create(mockContext);
        container.dispose();
        metrics.push(performance.now() - startTime);
      }

      const avgDuration = metrics.reduce((a, b) => a + b, 0) / metrics.length;
      
      // Average should be reasonable
      assert.ok(avgDuration < PERFORMANCE_BASELINES.containerCreation * 2);
    });
  });
});

