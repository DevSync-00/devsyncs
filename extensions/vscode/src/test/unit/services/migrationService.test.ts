/**
 * Unit tests for MigrationService
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, setup } from 'mocha';
import { MigrationService } from '../../../services/migrationService';
import { MockApiClient, MockConfigurationManager, createMockExtensionContext } from '../../utils/mocks';

suite('MigrationService', () => {
  let mockContext: vscode.ExtensionContext;
  let mockApiClient: MockApiClient;
  let mockConfigManager: MockConfigurationManager;
  let migrationService: MigrationService;

  setup(() => {
    mockContext = createMockExtensionContext();
    mockApiClient = new MockApiClient();
    mockConfigManager = new MockConfigurationManager();
    migrationService = new MigrationService(mockApiClient);
  });

  suite('validateMigration', () => {
    test('should validate migration with mismatches', async () => {
      mockApiClient.setScanResults([
        {
          id: 'mismatch-1',
          type: 'missing_field',
          model: 'User',
          field: 'email',
        },
      ]);

      await mockApiClient.scan('/workspace/path', 'postgresql://localhost/db');
      const result = await migrationService.validateMigration('test-scan-id');

      assert.ok(result.valid);
    });

    test('should reject migration without mismatches', async () => {
      mockApiClient.setScanResults([]);
      await mockApiClient.scan('/workspace/path', 'postgresql://localhost/db');
      const result = await migrationService.validateMigration('test-scan-id');

      assert.ok(!result.valid);
      assert.ok(result.error?.includes('No mismatches'));
    });
  });

  suite('generateMigration', () => {
    test('should generate migration successfully', async () => {
      mockApiClient.setScanResults([
        {
          id: 'mismatch-1',
          type: 'missing_field',
          model: 'User',
          field: 'email',
        },
      ]);

      await mockApiClient.scan('/workspace/path', 'postgresql://localhost/db');
      const result = await migrationService.generateMigration('test-scan-id');

      assert.ok(result.success);
      assert.ok(result.migration);
      assert.ok(result.migration.content);
    });

    test('should handle migration generation errors', async () => {
      const originalGenerate = mockApiClient.generateMigration.bind(mockApiClient);
      mockApiClient.generateMigration = async () => {
        throw new Error('Migration generation failed');
      };

      const result = await migrationService.generateMigration('test-scan-id');

      assert.ok(!result.success);
      assert.ok(result.error);

      mockApiClient.generateMigration = originalGenerate;
    });
  });
});

