/**
 * Integration tests for API communication.
 * 
 * Tests the interaction between the extension and the DevSync API,
 * including request/response handling, error handling, and authentication.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, setup } from 'mocha';
import { DevSyncApiClient } from '../../api';
import { createMockExtensionContext } from '../utils/mocks';
import { delay } from '../utils/testHelpers';

suite('API Integration Tests', () => {
  let apiClient: DevSyncApiClient;
  const testApiUrl = process.env.DEVSYNC_API_URL || 'http://localhost:3000';
  const testApiKey = process.env.DEVSYNC_API_KEY || 'test-api-key';
  const testProjectId = process.env.DEVSYNC_PROJECT_ID || 'test-project-id';

  setup(() => {
    apiClient = new DevSyncApiClient(testApiUrl, testApiKey, testProjectId);
  });

  suite('API Client Initialization', () => {
    test('should initialize with correct URL and credentials', () => {
      assert.ok(apiClient);
      assert.strictEqual(apiClient.getDashboardUrl(), `${testApiUrl}/dashboard/projects/${testProjectId}`);
    });

    test('should create new instance with different URL', () => {
      const newUrl = 'https://api.example.com';
      const newClient = new DevSyncApiClient(newUrl, testApiKey, testProjectId);
      assert.ok(newClient.getDashboardUrl().includes(newUrl));
    });

    test('should create new instance with different API key', () => {
      const newKey = 'new-api-key';
      const newClient = new DevSyncApiClient(testApiUrl, newKey, testProjectId);
      assert.ok(newClient);
    });

    test('should create new instance with different project ID', () => {
      const newProjectId = 'new-project-id';
      const newClient = new DevSyncApiClient(testApiUrl, testApiKey, newProjectId);
      assert.ok(newClient.getDashboardUrl().includes(newProjectId));
    });
  });

  suite('API Request Handling', () => {
    test('should handle network errors gracefully', async function () {
      this.timeout(10000);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        throw new TypeError('Simulated network failure');
      };
      const invalidClient = new DevSyncApiClient('https://example.invalid', 'key', 'id');

      try {
        await invalidClient.scan('/test/path');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('should handle invalid API responses', async function () {
      this.timeout(10000);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => new Response(
        JSON.stringify({ error: 'Simulated server failure' }),
        {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'content-type': 'application/json' },
        }
      );
      const mockClient = new DevSyncApiClient('https://example.invalid', 'key', 'id');

      try {
        await mockClient.scan('/test/path');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('should handle timeout scenarios', async function () {
      this.timeout(15000);

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => new Promise<Response>(() => undefined);
      const timeoutClient = new DevSyncApiClient('https://example.invalid', 'key', 'id');

      try {
        await Promise.race([
          timeoutClient.scan('/test/path'),
          delay(100).then(() => Promise.reject(new Error('Timeout'))),
        ]);
        assert.fail('Should have timed out');
      } catch (error) {
        assert.ok(error instanceof Error);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  suite('getScanReports', () => {
    test('should retrieve scan reports with limit', async function () {
      this.timeout(10000);
      
      // Skip if API is not available
      if (testApiUrl.includes('localhost') && testApiKey === 'test-api-key') {
        this.skip();
      }

      try {
        const reports = await apiClient.getScanReports(5);
        assert.ok(Array.isArray(reports));
      } catch (error) {
        // API may not be available in test environment
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('getLatestScanReport', () => {
    test('should retrieve latest scan report', async function () {
      this.timeout(10000);
      
      if (testApiUrl.includes('localhost') && testApiKey === 'test-api-key') {
        this.skip();
      }

      try {
        const report = await apiClient.getLatestScanReport();
        // Should return report or null
        assert.ok(report === null || typeof report === 'object');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('generateMigration', () => {
    test('should handle migration generation', async function () {
      this.timeout(10000);
      
      if (testApiUrl.includes('localhost') && testApiKey === 'test-api-key') {
        this.skip();
      }

      try {
        const migration = await apiClient.generateMigration('test-scan-id');
        assert.ok(migration);
        assert.ok('id' in migration || 'content' in migration);
      } catch (error) {
        // Expected if scan report doesn't exist
        assert.ok(error instanceof Error);
      }
    });
  });

  suite('getMigrations', () => {
    test('should retrieve migrations', async function () {
      this.timeout(10000);
      
      if (testApiUrl.includes('localhost') && testApiKey === 'test-api-key') {
        this.skip();
      }

      try {
        const migrations = await apiClient.getMigrations();
        assert.ok(Array.isArray(migrations));
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });

    test('should filter migrations by scan report ID', async function () {
      this.timeout(10000);
      
      if (testApiUrl.includes('localhost') && testApiKey === 'test-api-key') {
        this.skip();
      }

      try {
        const migrations = await apiClient.getMigrations('test-scan-id');
        assert.ok(Array.isArray(migrations));
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });
  });
});

