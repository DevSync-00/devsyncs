/**
 * Input validation manager.
 * 
 * Integrates all input validation features including validation,
 * SQL sanitization, rate limiting, and type checking.
 */

import * as vscode from 'vscode';
import { InputValidator, ValidationOptions } from './inputValidation';
import { SqlSanitization, ParameterizedQuery } from './sqlSanitization';
import { RateLimiter, RateLimitConfig, createRateLimiter } from './rateLimiting';
import { TypeValidator, TypeValidationResult } from './typeValidation';

/**
 * Input validation manager configuration
 */
export interface InputValidationManagerConfig {
  /**
   * Rate limiting configuration
   */
  rateLimit?: RateLimitConfig;

  /**
   * Default validation options
   */
  defaultValidationOptions?: ValidationOptions;
}

/**
 * Input validation manager
 */
export class InputValidationManager {
  private rateLimiter: RateLimiter;
  private defaultOptions: ValidationOptions;

  constructor(
    private context: vscode.ExtensionContext,
    config: InputValidationManagerConfig = {}
  ) {
    // Initialize rate limiter
    this.rateLimiter = config.rateLimit
      ? new RateLimiter(config.rateLimit)
      : createRateLimiter(100, 60000); // 100 requests per minute

    // Set default validation options
    this.defaultOptions = {
      maxLength: 10000,
      minLength: 1,
      trim: true,
      allowEmpty: false,
      blockedPatterns: [
        ...InputValidator.getSqlInjectionPatterns(),
        ...InputValidator.getXssPatterns(),
      ],
      ...config.defaultValidationOptions,
    };
  }

  /**
   * Validate user input
   * 
   * @param value - Value to validate
   * @param options - Validation options
   * @returns Validation result
   */
  validateInput(value: unknown, options?: ValidationOptions) {
    return InputValidator.validateString(value, {
      ...this.defaultOptions,
      ...options,
    });
  }

  /**
   * Validate and sanitize SQL query
   * 
   * @param query - SQL query template
   * @param params - Query parameters
   * @returns Parameterized query
   */
  parameterizeQuery(query: string, params: unknown[]): ParameterizedQuery {
    // Validate parameters
    const validatedParams = params.map((param, index) => {
      const validation = this.validateInput(param);
      if (!validation.valid) {
        throw new Error(`Parameter ${index}: ${validation.error}`);
      }
      return validation.sanitized!;
    });

    return SqlSanitization.parameterize(query, validatedParams);
  }

  /**
   * Check rate limit
   * 
   * @param identifier - Unique identifier (user ID, IP, etc.)
   * @returns Rate limit result
   */
  checkRateLimit(identifier: string) {
    return this.rateLimiter.check(identifier);
  }

  /**
   * Validate type
   * 
   * @param value - Value to validate
   * @param type - Type validator function
   * @returns Validation result
   */
  validateType<T>(
    value: unknown,
    validator: (val: unknown) => TypeValidationResult
  ): TypeValidationResult {
    return validator(value);
  }

  /**
   * Validate multiple inputs
   * 
   * @param inputs - Record of input values
   * @param schema - Validation schema
   * @returns Validation result
   */
  validateInputs(
    inputs: Record<string, unknown>,
    schema: Record<string, ValidationOptions | ((val: unknown) => TypeValidationResult)>
  ): { valid: boolean; errors: Record<string, string>; sanitized?: Record<string, unknown> } {
    const errors: Record<string, string> = {};
    const sanitized: Record<string, unknown> = {};

    for (const [key, validator] of Object.entries(schema)) {
      const value = inputs[key];

      if (typeof validator === 'function') {
        // Type validator
        const result = validator(value);
        if (!result.valid) {
          errors[key] = result.error || 'Validation failed';
        } else {
          sanitized[key] = result.value;
        }
      } else {
        // Input validator
        const result = this.validateInput(value, validator);
        if (!result.valid) {
          errors[key] = result.error || 'Validation failed';
        } else {
          sanitized[key] = result.sanitized;
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
      sanitized: Object.keys(errors).length === 0 ? sanitized : undefined,
    };
  }

  /**
   * Dispose of validation manager
   */
  dispose(): void {
    this.rateLimiter.dispose();
  }
}

/**
 * Create input validation manager
 */
export function createInputValidationManager(
  context: vscode.ExtensionContext,
  config?: InputValidationManagerConfig
): InputValidationManager {
  return new InputValidationManager(context, config);
}

