/**
 * Type validation utilities.
 * 
 * Provides runtime type checking and validation to ensure
 * data matches expected types and schemas.
 */

import { InputValidator } from './inputValidation';

/**
 * Type validation result
 */
export interface TypeValidationResult {
  valid: boolean;
  error?: string;
  value?: unknown;
}

/**
 * Type validator service
 */
export class TypeValidator {
  /**
   * Validate a value is a string
   * 
   * @param value - Value to validate
   * @param options - Validation options
   * @returns Validation result
   */
  static validateString(value: unknown, options?: {
    maxLength?: number;
    minLength?: number;
    pattern?: RegExp | string;
  }): TypeValidationResult {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `Expected string, got ${typeof value}`,
      };
    }

    const result = InputValidator.validateString(value, options);
    return {
      valid: result.valid,
      error: result.error,
      value: result.sanitized,
    };
  }

  /**
   * Validate a value is a number
   * 
   * @param value - Value to validate
   * @param options - Validation options
   * @returns Validation result
   */
  static validateNumber(value: unknown, options?: {
    min?: number;
    max?: number;
    integer?: boolean;
  }): TypeValidationResult {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        valid: false,
        error: `Expected number, got ${typeof value}`,
      };
    }

    const result = InputValidator.validateNumber(value, options);
    return {
      valid: result.valid,
      error: result.error,
      value,
    };
  }

  /**
   * Validate a value is a boolean
   * 
   * @param value - Value to validate
   * @returns Validation result
   */
  static validateBoolean(value: unknown): TypeValidationResult {
    if (typeof value !== 'boolean') {
      return {
        valid: false,
        error: `Expected boolean, got ${typeof value}`,
      };
    }

    return {
      valid: true,
      value,
    };
  }

  /**
   * Validate a value is an array
   * 
   * @param value - Value to validate
   * @param itemValidator - Validator for array items
   * @returns Validation result
   */
  static validateArray<T>(
    value: unknown,
    itemValidator?: (item: unknown) => TypeValidationResult
  ): TypeValidationResult {
    if (!Array.isArray(value)) {
      return {
        valid: false,
        error: `Expected array, got ${typeof value}`,
      };
    }

    if (itemValidator) {
      for (let i = 0; i < value.length; i++) {
        const itemResult = itemValidator(value[i]);
        if (!itemResult.valid) {
          return {
            valid: false,
            error: `Array item at index ${i}: ${itemResult.error}`,
          };
        }
      }
    }

    return {
      valid: true,
      value,
    };
  }

  /**
   * Validate a value is an object
   * 
   * @param value - Value to validate
   * @param schema - Schema definition
   * @returns Validation result
   */
  static validateObject(
    value: unknown,
    schema: Record<string, (val: unknown) => TypeValidationResult>
  ): TypeValidationResult {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {
        valid: false,
        error: `Expected object, got ${typeof value}`,
      };
    }

    const obj = value as Record<string, unknown>;
    const validated: Record<string, unknown> = {};

    for (const [key, validator] of Object.entries(schema)) {
      const fieldValue = obj[key];
      const fieldResult = validator(fieldValue);
      if (!fieldResult.valid) {
        return {
          valid: false,
          error: `Field '${key}': ${fieldResult.error}`,
        };
      }
      validated[key] = fieldResult.value;
    }

    return {
      valid: true,
      value: validated,
    };
  }

  /**
   * Validate a value matches one of several types
   * 
   * @param value - Value to validate
   * @param validators - Array of validators to try
   * @returns Validation result
   */
  static validateUnion(
    value: unknown,
    validators: Array<(val: unknown) => TypeValidationResult>
  ): TypeValidationResult {
    for (const validator of validators) {
      const result = validator(value);
      if (result.valid) {
        return result;
      }
    }

    return {
      valid: false,
      error: 'Value does not match any expected type',
    };
  }

  /**
   * Validate a value is one of specific values
   * 
   * @param value - Value to validate
   * @param allowedValues - Array of allowed values
   * @returns Validation result
   */
  static validateEnum<T>(value: unknown, allowedValues: T[]): TypeValidationResult {
    if (!allowedValues.includes(value as T)) {
      return {
        valid: false,
        error: `Value must be one of: ${allowedValues.join(', ')}`,
      };
    }

    return {
      valid: true,
      value,
    };
  }

  /**
   * Validate a value is a Date
   * 
   * @param value - Value to validate
   * @returns Validation result
   */
  static validateDate(value: unknown): TypeValidationResult {
    if (!(value instanceof Date)) {
      return {
        valid: false,
        error: `Expected Date, got ${typeof value}`,
      };
    }

    if (isNaN(value.getTime())) {
      return {
        valid: false,
        error: 'Invalid date',
      };
    }

    return {
      valid: true,
      value,
    };
  }

  /**
   * Validate a value is a valid UUID
   * 
   * @param value - Value to validate
   * @returns Validation result
   */
  static validateUuid(value: unknown): TypeValidationResult {
    const stringResult = this.validateString(value, {
      pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    });

    return {
      valid: stringResult.valid,
      error: stringResult.error,
      value: stringResult.value,
    };
  }

  /**
   * Validate a value is a valid JSON string
   * 
   * @param value - Value to validate
   * @returns Validation result
   */
  static validateJson(value: unknown): TypeValidationResult {
    const stringResult = this.validateString(value);
    if (!stringResult.valid) {
      return stringResult;
    }

    try {
      const parsed = JSON.parse(stringResult.value as string);
      return {
        valid: true,
        value: parsed,
      };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid JSON: ${error instanceof Error ? error.message : 'Parse error'}`,
      };
    }
  }
}

