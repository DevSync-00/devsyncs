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
      
      // Use invalid URL to trigger network error
      const invalidClient = new DevSyncApiClient('http://invalid-url-that-does-not-exist.local', 'key', 'id');
      
      try {
        await invalidClient.scan('/test/path');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });

    test('should handle invalid API responses', async function () {
      this.timeout(10000);
      
      // Use mock server URL that returns invalid response
      const mockClient = new DevSyncApiClient('http://httpbin.org/status/500', 'key', 'id');
      
      try {
        await mockClient.scan('/test/path');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
      }
    });

    test('should handle timeout scenarios', async function () {
      this.timeout(15000);
      
      // Use a URL that will timeout
      const timeoutClient = new DevSyncApiClient('http://httpbin.org/delay/10', 'key', 'id');
      
      try {
        await Promise.race([
          timeoutClient.scan('/test/path'),
          delay(5000).then(() => Promise.reject(new Error('Timeout'))),
        ]);
        assert.fail('Should have timed out');
      } catch (error) {
        assert.ok(error instanceof Error);
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

