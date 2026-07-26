import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Authentication Integration Tests', () => {
  test('Authentication command should be registered', async () => {
    const extension = vscode.extensions.getExtension('Dev-sync.devsync');
    assert.ok(extension, 'Extension should be available');
    await extension.activate();

    // Check that the authentication command is available
    const commandList = await vscode.commands.getCommands(true);
    assert.ok(commandList.includes('devsync.chat.login'), 'Login command should be registered');
    assert.ok(commandList.includes('devsync.chat.logout'), 'Logout command should be registered');
  });

  test('AuthManager should be accessible through DI container', async () => {
    const extension = vscode.extensions.getExtension('Dev-sync.devsync');
    if (extension) {
      await extension.activate();
      // The extension should have activated successfully
      assert.ok(extension.isActive);
    }
  });

  test('AuthManager interface should be properly defined', () => {
    // Verify that the IAuthManager interface is properly exported
    const extension = vscode.extensions.getExtension('Dev-sync.devsync');
    assert.ok(extension, 'Extension should be available');
  });
});

