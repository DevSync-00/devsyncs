import { DevSyncConfig, CONFIG_SCHEMA, ConfigProperty } from './schema';

/**
 * Validation error
 */
export class ConfigValidationError extends Error {
  constructor(
    public readonly key: string,
    public readonly value: unknown,
    public readonly reason: string
  ) {
    super(`Configuration validation failed for '${key}': ${reason}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: string[];
}

/**
 * Configuration validator
 */
export class ConfigValidator {
  /**
   * Validate a single configuration value
   */
  static validateProperty(key: keyof DevSyncConfig, value: unknown): ConfigValidationError | null {
    const property = CONFIG_SCHEMA[key];
    if (!property) {
      return new ConfigValidationError(key as string, value, 'Unknown configuration key');
    }

    // Check required
    if (property.required && (value === undefined || value === null || value === '')) {
      return new ConfigValidationError(key as string, value, 'Required field is missing');
    }

    // Skip validation if value is default or empty
    if (value === undefined || value === null || value === '' || value === property.default) {
      return null;
    }

    // Check type
    const typeCheck = this.checkType(value, property.type);
    if (typeCheck) {
      return new ConfigValidationError(key as string, value, typeCheck);
    }

    // Check enum
    if (property.enum && typeof value === 'string' && !property.enum.includes(value)) {
      return new ConfigValidationError(
        key as string,
        value,
        `Value must be one of: ${property.enum.join(', ')}`
      );
    }

    // Check pattern
    if (property.pattern && typeof value === 'string') {
      const regex = new RegExp(property.pattern);
      if (!regex.test(value)) {
        return new ConfigValidationError(
          key as string,
          value,
          `Value does not match required pattern: ${property.pattern}`
        );
      }
    }

    // Check min/max for numbers
    if (property.type === 'number' && typeof value === 'number') {
      if (property.min !== undefined && value < property.min) {
        return new ConfigValidationError(
          key as string,
          value,
          `Value must be at least ${property.min}`
        );
      }
      if (property.max !== undefined && value > property.max) {
        return new ConfigValidationError(
          key as string,
          value,
          `Value must be at most ${property.max}`
        );
      }
    }

    // Check custom validator
    if (property.validator) {
      const result = property.validator(value);
      if (result !== true) {
        return new ConfigValidationError(
          key as string,
          value,
          typeof result === 'string' ? result : 'Validation failed'
        );
      }
    }

    return null;
  }

  /**
   * Validate entire configuration object
   */
  static validate(config: Partial<DevSyncConfig>): ValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: string[] = [];

    // Validate each property
    for (const [key, value] of Object.entries(config)) {
      const error = this.validateProperty(key as keyof DevSyncConfig, value);
      if (error) {
        errors.push(error);
      }
    }

    // Check for missing required fields
    for (const [key, property] of Object.entries(CONFIG_SCHEMA)) {
      if (property.required && (config[key as keyof DevSyncConfig] === undefined)) {
        errors.push(
          new ConfigValidationError(key, undefined, 'Required field is missing')
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if value matches expected type
   */
  private static checkType(value: unknown, expectedType: string): string | null {
    const actualType = typeof value;

    switch (expectedType) {
      case 'string':
        return actualType === 'string' ? null : `Expected string, got ${actualType}`;
      case 'number':
        return actualType === 'number' ? null : `Expected number, got ${actualType}`;
      case 'boolean':
        return actualType === 'boolean' ? null : `Expected boolean, got ${actualType}`;
      case 'array':
        return Array.isArray(value) ? null : `Expected array, got ${actualType}`;
      case 'object':
        return actualType === 'object' && !Array.isArray(value) && value !== null
          ? null
          : `Expected object, got ${actualType}`;
      default:
        return null;
    }
  }

  /**
   * Sanitize configuration values
   */
  static sanitize(config: Partial<DevSyncConfig>): DevSyncConfig {
    const sanitized: any = {};

    for (const [key, property] of Object.entries(CONFIG_SCHEMA)) {
      const value = config[key as keyof DevSyncConfig];
      
      // Use default if value is undefined or empty
      if (value === undefined || value === null || value === '') {
        sanitized[key] = property.default;
      } else {
        // Type conversion
        switch (property.type) {
          case 'string':
            sanitized[key] = String(value);
            break;
          case 'number':
            sanitized[key] = Number(value);
            if (isNaN(sanitized[key])) {
              sanitized[key] = property.default;
            }
            break;
          case 'boolean':
            sanitized[key] = Boolean(value);
            break;
          default:
            sanitized[key] = value;
        }
      }
    }

    return sanitized as DevSyncConfig;
  }
}

