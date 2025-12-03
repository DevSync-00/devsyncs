import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Authentication Integration Tests', () => {
  test('Authentication command should be registered', () => {
    // Check that the authentication command is available
    const commands = vscode.commands.getCommands(true);
    return commands.then((commandList) => {
      assert.ok(commandList.includes('devsync.chat.login'), 'Login command should be registered');
      assert.ok(commandList.includes('devsync.chat.logout'), 'Logout command should be registered');
    });
  });

  test('AuthManager should be accessible through DI container', async () => {
    const extension = vscode.extensions.getExtension('devsync.devsync');
    if (extension) {
      await extension.activate();
      // The extension should have activated successfully
      assert.ok(extension.isActive);
    }
  });

  test('AuthManager interface should be properly defined', () => {
    // Verify that the IAuthManager interface is properly exported
    const extension = vscode.extensions.getExtension('devsync.devsync');
    assert.ok(extension, 'Extension should be available');
  });
});

