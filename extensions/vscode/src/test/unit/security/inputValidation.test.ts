/**
 * Unit tests for InputValidator
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { InputValidator } from '../../../security/inputValidation';
import { assertRejects } from '../../utils/testHelpers';

suite('InputValidator', () => {
  suite('validateString', () => {
    test('should validate valid string', () => {
      const result = InputValidator.validateString('test');
      assert.ok(result.valid);
      assert.strictEqual(result.sanitized, 'test');
    });

    test('should reject non-string input', () => {
      const result = InputValidator.validateString(123);
      assert.ok(!result.valid);
      assert.ok(result.error?.includes('Expected string'));
    });

    test('should enforce max length', () => {
      const result = InputValidator.validateString('a'.repeat(101), { maxLength: 100 });
      assert.ok(!result.valid);
      assert.ok(result.error?.includes('at most 100'));
    });

    test('should enforce min length', () => {
      const result = InputValidator.validateString('ab', { minLength: 5 });
      assert.ok(!result.valid);
      assert.ok(result.error?.includes('at least 5'));
    });

    test('should trim whitespace by default', () => {
      const result = InputValidator.validateString('  test  ');
      assert.ok(result.valid);
      assert.strictEqual(result.sanitized, 'test');
    });

    test('should reject empty string by default', () => {
      const result = InputValidator.validateString('');
      assert.ok(!result.valid);
      assert.ok(result.error?.includes('cannot be empty'));
    });

    test('should allow empty string when configured', () => {
      const result = InputValidator.validateString('', { allowEmpty: true });
      assert.ok(result.valid);
    });

    test('should detect SQL injection patterns', () => {
      const result = InputValidator.validateString("'; DROP TABLE users; --", {
        blockedPatterns: InputValidator.getSqlInjectionPatterns(),
      });
      assert.ok(!result.valid);
    });

    test('should detect XSS patterns', () => {
      const result = InputValidator.validateString('<script>alert("xss")</script>', {
        blockedPatterns: InputValidator.getXssPatterns(),
      });
      assert.ok(!result.valid);
    });

    test('should validate pattern', () => {
      const result = InputValidator.validateString('test123', {
        pattern: /^[a-z0-9]+$/,
      });
      assert.ok(result.valid);
    });

    test('should reject invalid pattern', () => {
      const result = InputValidator.validateString('test-123', {
        pattern: /^[a-z0-9]+$/,
      });
      assert.ok(!result.valid);
    });
  });

  suite('validateNumber', () => {
    test('should validate valid number', () => {
      const result = InputValidator.validateNumber(42);
      assert.ok(result.valid);
    });

    test('should reject non-number', () => {
      const result = InputValidator.validateNumber('42');
      assert.ok(!result.valid);
    });

    test('should enforce min value', () => {
      const result = InputValidator.validateNumber(5, { min: 10 });
      assert.ok(!result.valid);
    });

    test('should enforce max value', () => {
      const result = InputValidator.validateNumber(15, { max: 10 });
      assert.ok(!result.valid);
    });

    test('should enforce integer constraint', () => {
      const result = InputValidator.validateNumber(3.14, { integer: true });
      assert.ok(!result.valid);
    });

    test('should enforce positive constraint', () => {
      const result = InputValidator.validateNumber(-5, { positive: true });
      assert.ok(!result.valid);
    });
  });

  suite('validateEmail', () => {
    test('should validate valid email', () => {
      const result = InputValidator.validateEmail('test@example.com');
      assert.ok(result.valid);
    });

    test('should reject invalid email format', () => {
      const result = InputValidator.validateEmail('not-an-email');
      assert.ok(!result.valid);
    });

    test('should normalize email to lowercase', () => {
      const result = InputValidator.validateEmail('Test@Example.COM');
      assert.ok(result.valid);
      assert.strictEqual(result.sanitized, 'test@example.com');
    });

    test('should enforce max length', () => {
      const result = InputValidator.validateEmail('a'.repeat(250) + '@example.com');
      assert.ok(!result.valid);
    });
  });

  suite('validateUrl', () => {
    test('should validate valid URL', () => {
      const result = InputValidator.validateUrl('https://example.com');
      assert.ok(result.valid);
    });

    test('should reject invalid URL', () => {
      const result = InputValidator.validateUrl('not-a-url');
      assert.ok(!result.valid);
    });

    test('should enforce HTTPS requirement', () => {
      const result = InputValidator.validateUrl('http://example.com', { requireHttps: true });
      assert.ok(!result.valid);
    });

    test('should validate protocol whitelist', () => {
      const result = InputValidator.validateUrl('ftp://example.com', {
        allowedProtocols: ['https', 'http'],
      });
      assert.ok(!result.valid);
    });
  });

  suite('validateIdentifier', () => {
    test('should validate valid identifier', () => {
      const result = InputValidator.validateIdentifier('test_123');
      assert.ok(result.valid);
    });

    test('should reject invalid characters', () => {
      const result = InputValidator.validateIdentifier('test@123');
      assert.ok(!result.valid);
    });

    test('should reject SQL injection patterns', () => {
      const result = InputValidator.validateIdentifier("test'; DROP TABLE");
      assert.ok(!result.valid);
    });
  });

  suite('validatePath', () => {
    test('should validate valid path', () => {
      const result = InputValidator.validatePath('/valid/path/to/file');
      assert.ok(result.valid);
    });

    test('should reject path traversal', () => {
      const result = InputValidator.validatePath('../../../etc/passwd');
      assert.ok(!result.valid);
    });

    test('should reject null bytes', () => {
      const result = InputValidator.validatePath('/path\0with/null');
      assert.ok(!result.valid);
    });
  });
});

