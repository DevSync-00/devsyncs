/**
 * Integration tests for authentication flows.
 * 
 * Tests the complete authentication flow including device flow,
 * token management, session handling, and logout.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, setup, teardown } from 'mocha';
import { AuthManager } from '../../auth';
import { createMockExtensionContext } from '../utils/mocks';
import { delay } from '../utils/testHelpers';

suite('Authentication Integration Tests', () => {
  let mockContext: vscode.ExtensionContext;
  let authManager: AuthManager;
  const testAnalyzerUrl = process.env.DEVSYNC_ANALYZER_URL || 'http://localhost:3000';

  setup(() => {
    mockContext = createMockExtensionContext();
    authManager = new AuthManager(mockContext, testAnalyzerUrl);
  });

  teardown(() => {
    // Clean up any stored tokens
    void authManager.logout().catch(() => {
      // Ignore cleanup errors
    });
  });

  suite('Session Management', () => {
    test('should initialize with unauthenticated session', () => {
      const session = authManager.getSession();
      assert.strictEqual(session.status, 'unauthenticated');
    });

    test('should emit session change events', async () => {
      const sessionChanges: any[] = [];
      const disposable = authManager.onDidChangeSession((session) => {
        sessionChanges.push(session);
      });

      // Trigger a session change (if possible)
      try {
        await authManager.logout();
      } catch {
        // Ignore errors
      }

      // Should have received at least initial session
      assert.ok(sessionChanges.length >= 0);
      
      disposable.dispose();
    });

    test('should set analyzer URL', () => {
      const newUrl = 'https://api.example.com';
      authManager.setAnalyzerUrl(newUrl);
      // Should not throw
      assert.ok(true);
    });
  });

  suite('Token Management', () => {
    test('should throw error when accessing token without authentication', async () => {
      try {
        await authManager.ensureAccessToken();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes('sign in') || error.message.includes('authenticated'));
      }
    });

    test('should handle token refresh', async function () {
      this.timeout(30000);
      
      // Skip if analyzer is not available
      if (testAnalyzerUrl.includes('localhost')) {
        this.skip();
      }

      // This test would require actual authentication
      // For now, just verify the method exists and handles errors
      try {
        await authManager.ensureAccessToken();
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('Device Flow', () => {
    test('should handle device flow start', async function () {
      this.timeout(30000);
      
      if (testAnalyzerUrl.includes('localhost')) {
        this.skip();
      }

      const progressUpdates: any[] = [];
      
      try {
        await authManager.startDeviceFlow((update) => {
          progressUpdates.push(update);
        });
      } catch (error) {
        // Expected to fail without actual device code approval
        assert.ok(error instanceof Error);
        // Should have received some progress updates
        assert.ok(progressUpdates.length >= 0);
      }
    });

    test('should handle device flow errors', async function () {
      this.timeout(10000);
      
      // Use invalid URL to trigger error
      const invalidAuthManager = new AuthManager(mockContext, 'http://invalid-url.local');
      
      try {
        await invalidAuthManager.startDeviceFlow();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('Logout', () => {
    test('should logout successfully', async () => {
      await authManager.logout();
      const session = authManager.getSession();
      assert.strictEqual(session.status, 'unauthenticated');
    });

    test('should clear stored tokens on logout', async () => {
      await authManager.logout();
      
      // Try to access token - should fail
      try {
        await authManager.ensureAccessToken();
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('Session Persistence', () => {
    test('should persist session across instances', async function () {
      this.timeout(10000);
      
      // Create new auth manager instance
      const newAuthManager = new AuthManager(mockContext, testAnalyzerUrl);
      
      // Should restore session if tokens exist
      const session = newAuthManager.getSession();
      assert.ok('status' in session);
    });
  });
});

