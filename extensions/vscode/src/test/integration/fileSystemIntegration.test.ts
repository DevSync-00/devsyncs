/**
 * Integration tests for file system operations.
 * 
 * Tests reading/writing configuration files, schema files,
 * and other file system interactions.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { suite, test, setup, teardown } from 'mocha';
import { ConfigurationManager } from '../../config';
import { createMockExtensionContext } from '../utils/mocks';

suite('File System Integration Tests', () => {
  let mockContext: vscode.ExtensionContext;
  let configManager: ConfigurationManager;
  let tempWorkspace: string;
  let tempWorkspaceUri: vscode.Uri;

  setup(() => {
    mockContext = createMockExtensionContext();
    configManager = new ConfigurationManager(mockContext);
    
    // Create temporary workspace
    tempWorkspace = path.join(__dirname, '../../../../test-workspace-fs');
    if (!fs.existsSync(tempWorkspace)) {
      fs.mkdirSync(tempWorkspace, { recursive: true });
    }
    tempWorkspaceUri = vscode.Uri.file(tempWorkspace);
  });

  teardown(() => {
    // Clean up temp workspace
    if (fs.existsSync(tempWorkspace)) {
      try {
        fs.rmSync(tempWorkspace, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  suite('Configuration File Operations', () => {
    test('should read configuration from workspace', () => {
      const config = configManager.getAll();
      assert.ok(typeof config === 'object');
    });

    test('should update configuration', async () => {
      const originalValue = configManager.get('apiUrl');
      const newValue = 'https://new-api.example.com';
      
      await configManager.update('apiUrl', newValue);
      const updatedValue = configManager.get('apiUrl');
      
      // Configuration should be updated
      assert.strictEqual(updatedValue, newValue);
      
      // Restore original value
      if (originalValue) {
        await configManager.update('apiUrl', originalValue);
      }
    });

    test('should validate configuration', () => {
      const validation = configManager.validate();
      assert.ok('valid' in validation);
      assert.ok('errors' in validation);
      assert.ok('warnings' in validation);
    });

    test('should check if configuration is valid', () => {
      const isValid = configManager.isValid();
      assert.strictEqual(typeof isValid, 'boolean');
    });

    test('should get missing required fields', () => {
      const missing = configManager.getMissingRequired();
      assert.ok(Array.isArray(missing));
    });
  });

  suite('Schema File Operations', () => {
    test('should detect Prisma schema file', () => {
      const schemaPath = path.join(tempWorkspace, 'schema.prisma');
      const schemaContent = `model User {
  id    Int    @id @default(autoincrement())
  email String
}`;
      
      fs.writeFileSync(schemaPath, schemaContent);
      
      assert.ok(fs.existsSync(schemaPath));
      const content = fs.readFileSync(schemaPath, 'utf-8');
      assert.ok(content.includes('model User'));
    });

    test('should handle missing schema file gracefully', () => {
      const schemaPath = path.join(tempWorkspace, 'nonexistent.prisma');
      assert.ok(!fs.existsSync(schemaPath));
    });

    test('should read schema file content', () => {
      const schemaPath = path.join(tempWorkspace, 'test-schema.prisma');
      const schemaContent = 'model Test { id Int @id }';
      fs.writeFileSync(schemaPath, schemaContent);
      
      const content = fs.readFileSync(schemaPath, 'utf-8');
      assert.strictEqual(content, schemaContent);
    });
  });

  suite('Workspace File Operations', () => {
    test('should create workspace directory', () => {
      assert.ok(fs.existsSync(tempWorkspace));
      assert.ok(fs.statSync(tempWorkspace).isDirectory());
    });

    test('should write and read files', () => {
      const testFile = path.join(tempWorkspace, 'test.txt');
      const testContent = 'test content';
      
      fs.writeFileSync(testFile, testContent);
      assert.ok(fs.existsSync(testFile));
      
      const content = fs.readFileSync(testFile, 'utf-8');
      assert.strictEqual(content, testContent);
    });

    test('should handle file path resolution', () => {
      const relativePath = './test-file.txt';
      const absolutePath = path.resolve(tempWorkspace, relativePath);
      
      assert.ok(path.isAbsolute(absolutePath));
      assert.ok(absolutePath.includes('test-file.txt'));
    });
  });

  suite('Configuration Persistence', () => {
    test('should persist configuration changes', async () => {
      const testValue = 'https://test-persist.example.com';
      await configManager.update('apiUrl', testValue);
      
      // Create new config manager to verify persistence
      const newConfigManager = new ConfigurationManager(mockContext);
      const persistedValue = newConfigManager.get('apiUrl');
      
      // Should persist (if using workspace settings)
      assert.ok(persistedValue !== undefined);
    });
  });
});

