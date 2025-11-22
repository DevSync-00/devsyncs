import * as assert from 'assert';
import * as vscode from 'vscode';
import { DevSyncApiClient } from '../api-client';

suite('DevSync Extension', () => {
  test('extension manifest is discoverable', () => {
    const extension = vscode.extensions.getExtension('devsync.devsync');
    assert.ok(extension, 'DevSync VS Code extension should be registered');
  });

  test('extension activates successfully', async () => {
    const extension = vscode.extensions.getExtension('devsync.devsync');
    assert.ok(extension, 'Extension must exist before activation test');
    await extension?.activate();
    assert.ok(extension?.isActive, 'Extension should be active after activation');
  });
});

suite('DevSyncApiClient', () => {
  test('computes dashboard URL for a project', () => {
    const stubAuthManager = {
      getAccessToken: async () => 'token',
    } as any;
    const client = new DevSyncApiClient('https://api.example.com', 'project-123', stubAuthManager);
    assert.strictEqual(
      client.getDashboardUrl(),
      'https://api.example.com/dashboard/projects/project-123'
    );
  });
});
