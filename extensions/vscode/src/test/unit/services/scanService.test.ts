/**
 * Unit tests for ScanService
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test } from 'mocha';
import { ScanService } from '../../../services/scanService';
import { MockApiClient, MockConfigurationManager, createMockExtensionContext } from '../../utils/mocks';

suite('ScanService', () => {
  let mockContext: vscode.ExtensionContext;
  let mockApiClient: MockApiClient;
  let mockConfigManager: MockConfigurationManager;
  let scanService: ScanService;

  setup(() => {
    mockContext = createMockExtensionContext();
    mockApiClient = new MockApiClient();
    mockConfigManager = new MockConfigurationManager();
    mockConfigManager.set('apiUrl', 'http://localhost:3000');
    mockConfigManager.set('apiKey', '');
    mockConfigManager.set('projectId', 'test-project-id');
    scanService = new ScanService(mockApiClient, mockConfigManager);
  });

  suite('validateScan', () => {
    test('should validate scan with valid configuration', () => {
      const result = scanService.validateScan('/valid/path');
      assert.ok(result.valid);
    });

    test('should allow secure device authentication without a settings API key', () => {
      const result = scanService.validateScan('/valid/path');
      assert.ok(result.valid);
      assert.ok(!result.missingFields?.includes('devsync.apiKey'));
    });

    test('should reject scan with invalid path', () => {
      const result = scanService.validateScan('');
      assert.ok(!result.valid);
      assert.ok(result.missingFields?.includes('workspacePath'));
    });
  });

  suite('executeScan', () => {
    test('should execute scan successfully', async () => {
      mockApiClient.setScanResults([
        {
          id: 'mismatch-1',
          type: 'missing_field',
          model: 'User',
          field: 'email',
        },
      ]);

      const result = await scanService.executeScan('/workspace/path', 'postgresql://localhost/db');

      assert.ok(result.success);
      assert.ok(result.report);
      assert.strictEqual(result.report.mismatches.length, 1);
    });

    test('should handle scan errors', async () => {
      // Mock API client to throw error
      const originalScan = mockApiClient.scan.bind(mockApiClient);
      mockApiClient.scan = async () => {
        throw new Error('Scan failed');
      };

      const result = await scanService.executeScan('/workspace/path', 'postgresql://localhost/db');

      assert.ok(!result.success);
      assert.ok(result.error);

      // Restore original
      mockApiClient.scan = originalScan;
    });
  });

  suite('getLatestScanReport', () => {
    test('should return latest scan report', async () => {
      mockApiClient.setScanResults([
        {
          id: 'mismatch-1',
          type: 'missing_field',
          model: 'User',
          field: 'email',
        },
      ]);

      await scanService.executeScan('/workspace/path', 'postgresql://localhost/db');
      const report = await scanService.getLatestScanReport();

      assert.ok(report);
      assert.strictEqual(report.mismatches.length, 1);
    });

    test('should return null when no reports exist', async () => {
      const report = await scanService.getLatestScanReport();
      assert.strictEqual(report, null);
    });
  });

  suite('getDashboardUrl', () => {
    test('should return dashboard URL', () => {
      const url = scanService.getDashboardUrl();
      assert.ok(url.includes('/dashboard'));
    });
  });
});

