/**
 * Unit tests for TypeValidator
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { TypeValidator } from '../../../security/typeValidation';

suite('TypeValidator', () => {
  suite('validateString', () => {
    test('should validate string', () => {
      const result = TypeValidator.validateString('test');
      assert.ok(result.valid);
      assert.strictEqual(result.value, 'test');
    });

    test('should reject non-string', () => {
      const result = TypeValidator.validateString(123);
      assert.ok(!result.valid);
    });
  });

  suite('validateNumber', () => {
    test('should validate number', () => {
      const result = TypeValidator.validateNumber(42);
      assert.ok(result.valid);
    });

    test('should reject non-number', () => {
      const result = TypeValidator.validateNumber('42');
      assert.ok(!result.valid);
    });

    test('should enforce min value', () => {
      const result = TypeValidator.validateNumber(5, { min: 10 });
      assert.ok(!result.valid);
    });
  });

  suite('validateBoolean', () => {
    test('should validate boolean', () => {
      const result = TypeValidator.validateBoolean(true);
      assert.ok(result.valid);
    });

    test('should reject non-boolean', () => {
      const result = TypeValidator.validateBoolean('true');
      assert.ok(!result.valid);
    });
  });

  suite('validateArray', () => {
    test('should validate array', () => {
      const result = TypeValidator.validateArray([1, 2, 3]);
      assert.ok(result.valid);
    });

    test('should reject non-array', () => {
      const result = TypeValidator.validateArray('not-array');
      assert.ok(!result.valid);
    });

    test('should validate array items', () => {
      const result = TypeValidator.validateArray(['a', 'b'], (item) =>
        TypeValidator.validateString(item)
      );
      assert.ok(result.valid);
    });

    test('should reject invalid array items', () => {
      const result = TypeValidator.validateArray(['a', 123], (item) =>
        TypeValidator.validateString(item)
      );
      assert.ok(!result.valid);
    });
  });

  suite('validateObject', () => {
    test('should validate object', () => {
      const result = TypeValidator.validateObject(
        { name: 'John', age: 30 },
        {
          name: (val) => TypeValidator.validateString(val),
          age: (val) => TypeValidator.validateNumber(val),
        }
      );
      assert.ok(result.valid);
    });

    test('should reject non-object', () => {
      const result = TypeValidator.validateObject('not-object', {});
      assert.ok(!result.valid);
    });

    test('should validate object fields', () => {
      const result = TypeValidator.validateObject(
        { name: 'John', age: '30' },
        {
          name: (val) => TypeValidator.validateString(val),
          age: (val) => TypeValidator.validateNumber(val),
        }
      );
      assert.ok(!result.valid);
    });
  });

  suite('validateEnum', () => {
    test('should validate enum value', () => {
      const result = TypeValidator.validateEnum('value1', ['value1', 'value2', 'value3']);
      assert.ok(result.valid);
    });

    test('should reject invalid enum value', () => {
      const result = TypeValidator.validateEnum('invalid', ['value1', 'value2']);
      assert.ok(!result.valid);
    });
  });

  suite('validateUuid', () => {
    test('should validate UUID', () => {
      const result = TypeValidator.validateUuid('123e4567-e89b-12d3-a456-426614174000');
      assert.ok(result.valid);
    });

    test('should reject invalid UUID', () => {
      const result = TypeValidator.validateUuid('not-a-uuid');
      assert.ok(!result.valid);
    });
  });

  suite('validateJson', () => {
    test('should validate JSON string', () => {
      const result = TypeValidator.validateJson('{"key": "value"}');
      assert.ok(result.valid);
      assert.deepStrictEqual(result.value, { key: 'value' });
    });

    test('should reject invalid JSON', () => {
      const result = TypeValidator.validateJson('{invalid json}');
      assert.ok(!result.valid);
    });
  });
});

