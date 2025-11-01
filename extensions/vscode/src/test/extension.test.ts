import * as assert from 'assert';
import * as vscode from 'vscode';
import { DevSyncApiClient } from '../api';

suite('DevSync Extension Tests', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('devsync.devsync'));
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('devsync.devsync');
    if (extension) {
      await extension.activate();
      assert.ok(extension.isActive);
    }
  });
});

suite('API Client Tests', () => {
  test('API Client should initialize', () => {
    const apiClient = new DevSyncApiClient(
      'http://localhost:3000',
      'test-api-key',
      'test-project-id'
    );

    assert.ok(apiClient);
    assert.strictEqual(apiClient.getDashboardUrl(), 'http://localhost:3000/dashboard/projects/test-project-id');
  });
});

suite('Mismatch Type Tests', () => {
  test('Should format mismatch types correctly', () => {
    const formatMismatchType = (type: string): string => {
      return type
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    };

    assert.strictEqual(formatMismatchType('missing_field'), 'Missing Field');
    assert.strictEqual(formatMismatchType('type_mismatch'), 'Type Mismatch');
    assert.strictEqual(formatMismatchType('constraint_mismatch'), 'Constraint Mismatch');
  });
});

suite('Suggested Fix Extraction Tests', () => {
  test('Should extract suggested fix from message', () => {
    const extractSuggestedFix = (message: string): string | null => {
      const match = message.match(/Suggested Fix:\s*(.+)/);
      return match ? match[1].trim() : null;
    };

    const message1 = 'DevSync: Missing Field - Field "age" in model "User"\n\nSuggested Fix: ALTER TABLE "User" ADD COLUMN "age" INTEGER;';
    assert.strictEqual(
      extractSuggestedFix(message1),
      'ALTER TABLE "User" ADD COLUMN "age" INTEGER;'
    );

    const message2 = 'DevSync: Type Mismatch - Field "email" in model "User"';
    assert.strictEqual(extractSuggestedFix(message2), null);
  });
});

