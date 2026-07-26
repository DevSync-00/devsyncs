/**
 * Performance tests for extension startup.
 * 
 * Tests startup time, initialization performance, and activation metrics.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, setup } from 'mocha';
import { ContainerFactory } from '../../di/factory';
import { createMockExtensionContext } from '../utils/mocks';
import { delay } from '../utils/testHelpers';

/**
 * Performance benchmark utilities
 */
class PerformanceBenchmark {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  end(): number {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  getDuration(): number {
    return this.endTime - this.startTime;
  }
}

suite('Startup Performance Tests', () => {
  let mockContext: vscode.ExtensionContext;

  setup(() => {
    mockContext = createMockExtensionContext();
  });

  suite('Extension Activation', () => {
    test('should activate within acceptable time', async function () {
      this.timeout(10000);
      
      const benchmark = new PerformanceBenchmark();
      benchmark.start();

      const extension = vscode.extensions.getExtension('Dev-sync.devsync');
      if (extension) {
        await extension.activate();
        const duration = benchmark.end();

        // Should activate within 5 seconds
        assert.ok(duration < 5000, `Activation took ${duration}ms, expected < 5000ms`);
        assert.ok(extension.isActive);
      }
    });

    test('should initialize DI container quickly', () => {
      const benchmark = new PerformanceBenchmark();
      benchmark.start();

      const container = ContainerFactory.create(mockContext);
      const duration = benchmark.end();

      // Container creation should be fast (< 100ms)
      assert.ok(duration < 100, `Container creation took ${duration}ms, expected < 100ms`);
      
      container.dispose();
    });
  });

  suite('Component Initialization', () => {
    test('should initialize services quickly', () => {
      const benchmark = new PerformanceBenchmark();
      benchmark.start();

      const container = ContainerFactory.create(mockContext);
      container.getApiClient();
      container.getCliRunner();
      container.getAuthManager();
      const duration = benchmark.end();

      // Service initialization should be fast (< 200ms)
      assert.ok(duration < 200, `Service initialization took ${duration}ms, expected < 200ms`);
      
      container.dispose();
    });

    test('should initialize UI components quickly', () => {
      const benchmark = new PerformanceBenchmark();
      benchmark.start();

      const container = ContainerFactory.create(mockContext);
      container.getDiagnostics();
      const duration = benchmark.end();

      // UI component initialization should be fast (< 150ms)
      assert.ok(duration < 150, `UI initialization took ${duration}ms, expected < 150ms`);
      
      container.dispose();
    });
  });

  suite('Lazy Loading', () => {
    test('should defer heavy initialization', () => {
      const benchmark = new PerformanceBenchmark();
      benchmark.start();

      const container = ContainerFactory.create(mockContext);
      // Accessing services should not trigger heavy operations
      const apiClient = container.getApiClient();
      const duration = benchmark.end();

      // Initial access should be fast
      assert.ok(duration < 100, `Lazy loading took ${duration}ms, expected < 100ms`);
      assert.ok(apiClient);
      
      container.dispose();
    });
  });
});

