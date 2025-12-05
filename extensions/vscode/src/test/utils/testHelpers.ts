/**
 * Test helper utilities.
 * 
 * Provides common utilities for writing unit tests.
 */

import * as assert from 'assert';

/**
 * Assert that a promise rejects with a specific error
 */
export async function assertRejects(
  promise: Promise<any>,
  expectedError?: string | RegExp | ((error: Error) => boolean)
): Promise<void> {
  try {
    await promise;
    assert.fail('Expected promise to reject');
  } catch (error) {
    if (expectedError === undefined) {
      return; // Any error is fine
    }

    if (typeof expectedError === 'string') {
      assert.strictEqual(
        error instanceof Error ? error.message : String(error),
        expectedError,
        'Error message should match'
      );
    } else if (expectedError instanceof RegExp) {
      const message = error instanceof Error ? error.message : String(error);
      assert.ok(
        expectedError.test(message),
        `Error message "${message}" should match pattern ${expectedError}`
      );
    } else if (typeof expectedError === 'function') {
      assert.ok(
        error instanceof Error && expectedError(error),
        'Error should match predicate'
      );
    }
  }
}

/**
 * Wait for a specified amount of time
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock function that tracks calls
 */
export function createMockFunction<T extends (...args: any[]) => any>(
  implementation?: T
): T & { calls: any[]; reset: () => void } {
  const calls: any[] = [];
  const fn = ((...args: any[]) => {
    calls.push(args);
    if (implementation) {
      return implementation(...args);
    }
  }) as T & { calls: any[]; reset: () => void };

  fn.calls = calls;
  fn.reset = () => {
    calls.length = 0;
  };

  return fn;
}

/**
 * Assert that two objects are deeply equal
 */
export function assertDeepEqual(actual: any, expected: any, message?: string): void {
  assert.deepStrictEqual(actual, expected, message);
}

/**
 * Assert that a value is within a range
 */
export function assertInRange(
  value: number,
  min: number,
  max: number,
  message?: string
): void {
  assert.ok(value >= min && value <= max, message || `Value ${value} should be between ${min} and ${max}`);
}

/**
 * Create a test data generator
 */
export class TestDataGenerator {
  /**
   * Generate a random string
   */
  static randomString(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate a random number
   */
  static randomNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate a random email
   */
  static randomEmail(): string {
    return `${this.randomString(8)}@${this.randomString(6)}.com`;
  }

  /**
   * Generate a random UUID
   */
  static randomUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Generate a random date
   */
  static randomDate(start: Date = new Date(2020, 0, 1), end: Date = new Date()): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }
}

