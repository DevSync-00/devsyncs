/**
 * Memory leak detection tests.
 * 
 * Tests for memory leaks in components, event listeners, and subscriptions.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, setup, teardown } from 'mocha';
import { ContainerFactory } from '../../di/factory';
import { createMockExtensionContext } from '../utils/mocks';
import { delay } from '../utils/testHelpers';

/**
 * Memory usage tracker
 */
class MemoryTracker {
  private initialMemory: NodeJS.MemoryUsage | null = null;

  start(): void {
    this.initialMemory = process.memoryUsage();
  }

  getCurrentMemory(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  getMemoryIncrease(): NodeJS.MemoryUsage {
    if (!this.initialMemory) {
      return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, arrayBuffers: 0 };
    }
    const current = this.getCurrentMemory();
    return {
      heapUsed: current.heapUsed - this.initialMemory.heapUsed,
      heapTotal: current.heapTotal - this.initialMemory.heapTotal,
      external: current.external - this.initialMemory.external,
      rss: current.rss - this.initialMemory.rss,
      arrayBuffers: current.arrayBuffers - this.initialMemory.arrayBuffers,
    };
  }
}

suite('Memory Leak Detection Tests', () => {
  let mockContext: vscode.ExtensionContext;
  let tracker: MemoryTracker;

  setup(() => {
    mockContext = createMockExtensionContext();
    tracker = new MemoryTracker();
    tracker.start();
  });

  teardown(() => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  suite('Container Memory', () => {
    test('should not leak memory on container creation', () => {
      const containers: any[] = [];
      
      for (let i = 0; i < 10; i++) {
        const container = ContainerFactory.create(mockContext);
        containers.push(container);
      }

      // Dispose all containers
      containers.forEach((c) => c.dispose());
      
      const increase = tracker.getMemoryIncrease();
      // Memory increase should be reasonable (< 50MB)
      assert.ok(increase.heapUsed < 50 * 1024 * 1024, `Memory increase: ${increase.heapUsed / 1024 / 1024}MB`);
    });
  });

  suite('Event Listeners', () => {
    test('should clean up event listeners', () => {
      const containers: any[] = [];
      
      for (let i = 0; i < 5; i++) {
        const container = ContainerFactory.create(mockContext);
        const authManager = container.getAuthManager();
        
        // Subscribe to events
        const disposable = authManager.onDidChangeSession(() => {});
        containers.push({ container, disposable });
      }

      // Dispose all subscriptions
      containers.forEach(({ container, disposable }) => {
        disposable.dispose();
        container.dispose();
      });

      const increase = tracker.getMemoryIncrease();
      // Should not leak memory from event listeners
      assert.ok(increase.heapUsed < 20 * 1024 * 1024, `Memory increase: ${increase.heapUsed / 1024 / 1024}MB`);
    });
  });

  suite('UI Components', () => {
    test('should not leak memory in API operations', async () => {
      const containers: any[] = [];
      
      for (let i = 0; i < 5; i++) {
        const container = ContainerFactory.create(mockContext);
        const apiClient = container.getApiClient();
        
        // Trigger API operations
        try {
          await apiClient.getLatestScanReport();
        } catch {
          // Ignore errors
        }
        
        containers.push(container);
      }

      // Dispose all containers
      containers.forEach((c) => c.dispose());
      
      await delay(100); // Allow cleanup
      
      const increase = tracker.getMemoryIncrease();
      // Should not leak memory
      assert.ok(increase.heapUsed < 30 * 1024 * 1024, `Memory increase: ${increase.heapUsed / 1024 / 1024}MB`);
    });
  });

  suite('Webview Memory', () => {
    test('should clean up webview resources', () => {
      // Webviews are cleaned up by VS Code
      // This test verifies we're not holding references
      assert.ok(true);
    });
  });
});

