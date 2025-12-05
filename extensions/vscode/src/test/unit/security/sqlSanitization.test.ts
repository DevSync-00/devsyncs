/**
 * Unit tests for SqlSanitization
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { SqlSanitization } from '../../../security/sqlSanitization';
import { assertRejects } from '../../utils/testHelpers';

suite('SqlSanitization', () => {
  suite('parameterize', () => {
    test('should create parameterized query', () => {
      const result = SqlSanitization.parameterize('SELECT * FROM users WHERE id = ?', [1]);
      assert.strictEqual(result.query, 'SELECT * FROM users WHERE id = ?');
      assert.deepStrictEqual(result.parameters, [1]);
    });

    test('should validate parameter count', () => {
      assert.throws(() => {
        SqlSanitization.parameterize('SELECT * FROM users WHERE id = ? AND name = ?', [1]);
      }, /Parameter count mismatch/);
    });

    test('should sanitize string parameters', () => {
      const result = SqlSanitization.parameterize('SELECT * FROM users WHERE name = ?', ['test']);
      assert.deepStrictEqual(result.parameters, ['test']);
    });

    test('should reject SQL injection in template', () => {
      assert.throws(() => {
        SqlSanitization.parameterize("SELECT * FROM users WHERE id = '1'; DROP TABLE users; --", [1]);
      });
    });

    test('should handle null parameters', () => {
      const result = SqlSanitization.parameterize('SELECT * FROM users WHERE deleted_at = ?', [null]);
      assert.deepStrictEqual(result.parameters, [null]);
    });

    test('should handle multiple parameters', () => {
      const result = SqlSanitization.parameterize(
        'INSERT INTO users (id, name, email) VALUES (?, ?, ?)',
        [1, 'John', 'john@example.com']
      );
      assert.strictEqual(result.parameters.length, 3);
    });
  });

  suite('sanitizeParameter', () => {
    test('should sanitize string parameter', () => {
      const result = SqlSanitization.sanitizeParameter('test');
      assert.strictEqual(result, 'test');
    });

    test('should reject SQL injection in parameter', () => {
      assert.throws(() => {
        SqlSanitization.sanitizeParameter("'; DROP TABLE users; --");
      });
    });

    test('should handle number parameter', () => {
      const result = SqlSanitization.sanitizeParameter(42);
      assert.strictEqual(result, 42);
    });

    test('should handle boolean parameter', () => {
      const result = SqlSanitization.sanitizeParameter(true);
      assert.strictEqual(result, true);
    });

    test('should handle null parameter', () => {
      const result = SqlSanitization.sanitizeParameter(null);
      assert.strictEqual(result, null);
    });

    test('should reject invalid number', () => {
      assert.throws(() => {
        SqlSanitization.sanitizeParameter(Infinity);
      });
    });
  });

  suite('escapeIdentifier', () => {
    test('should escape valid identifier', () => {
      const result = SqlSanitization.escapeIdentifier('users');
      assert.strictEqual(result, '`users`');
    });

    test('should escape backticks in identifier', () => {
      const result = SqlSanitization.escapeIdentifier('user`s');
      assert.strictEqual(result, '`user``s`');
    });

    test('should reject invalid identifier', () => {
      assert.throws(() => {
        SqlSanitization.escapeIdentifier("users'; DROP TABLE");
      });
    });
  });

  suite('validateQuery', () => {
    test('should validate safe query', () => {
      const result = SqlSanitization.validateQuery('SELECT * FROM users WHERE id = 1');
      assert.ok(result.valid);
    });

    test('should reject dangerous operations', () => {
      const result = SqlSanitization.validateQuery('DROP TABLE users');
      assert.ok(!result.valid);
    });

    test('should reject SQL injection patterns', () => {
      const result = SqlSanitization.validateQuery("SELECT * FROM users WHERE id = '1'; DROP TABLE users;");
      assert.ok(!result.valid);
    });
  });

  suite('buildSelect', () => {
    test('should build SELECT query', () => {
      const result = SqlSanitization.buildSelect('users', ['id', 'name']);
      assert.ok(result.query.includes('SELECT'));
      assert.ok(result.query.includes('FROM `users`'));
    });

    test('should build SELECT with WHERE clause', () => {
      const result = SqlSanitization.buildSelect('users', ['id'], { id: 1 });
      assert.ok(result.query.includes('WHERE'));
      assert.deepStrictEqual(result.parameters, [1]);
    });

    test('should use * for all columns', () => {
      const result = SqlSanitization.buildSelect('users');
      assert.ok(result.query.includes('*'));
    });
  });

  suite('buildInsert', () => {
    test('should build INSERT query', () => {
      const result = SqlSanitization.buildInsert('users', { name: 'John', email: 'john@example.com' });
      assert.ok(result.query.includes('INSERT INTO'));
      assert.strictEqual(result.parameters.length, 2);
    });

    test('should reject empty data', () => {
      assert.throws(() => {
        SqlSanitization.buildInsert('users', {});
      }, /No data provided/);
    });
  });

  suite('buildUpdate', () => {
    test('should build UPDATE query', () => {
      const result = SqlSanitization.buildUpdate('users', { name: 'Jane' }, { id: 1 });
      assert.ok(result.query.includes('UPDATE'));
      assert.ok(result.query.includes('SET'));
      assert.ok(result.query.includes('WHERE'));
    });

    test('should require WHERE clause', () => {
      assert.throws(() => {
        SqlSanitization.buildUpdate('users', { name: 'Jane' }, {});
      }, /WHERE clause required/);
    });
  });

  suite('buildDelete', () => {
    test('should build DELETE query', () => {
      const result = SqlSanitization.buildDelete('users', { id: 1 });
      assert.ok(result.query.includes('DELETE FROM'));
      assert.ok(result.query.includes('WHERE'));
    });

    test('should require WHERE clause', () => {
      assert.throws(() => {
        SqlSanitization.buildDelete('users', {});
      }, /WHERE clause required/);
    });
  });
});

