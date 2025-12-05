/**
 * Automatic retry with exponential backoff.
 * 
 * Provides configurable retry strategies with exponential backoff,
 * jitter, and custom retry conditions.
 */

import { DevSyncError } from './base';

/**
 * Retry configuration.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  multiplier?: number;
  /** Whether to add jitter to delays */
  jitter?: boolean;
  /** Custom retry condition - return true to retry, false to abort */
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

/**
 * Retry result.
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result value if successful */
  value?: T;
  /** Error if failed */
  error?: Error;
  /** Number of attempts made */
  attempts: number;
  /** Total time taken */
  duration: number;
}

/**
 * Retry manager with exponential backoff.
 */
export class RetryManager {
  /**
   * Retries an operation with exponential backoff.
   * 
   * @param operation - The operation to retry
   * @param config - Retry configuration
   * @returns Promise resolving to retry result
   */
  static async retry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = {
      maxRetries: 3,
      initialDelay: 1000,
      multiplier: 2,
      jitter: true,
    }
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const maxDelay = config.maxDelay || Infinity;
    const multiplier = config.multiplier || 2;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const value = await operation();
        return {
          success: true,
          value,
          attempts: attempt + 1,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        if (attempt < config.maxRetries) {
          if (config.shouldRetry && !config.shouldRetry(lastError, attempt)) {
            break;
          }

          // Calculate delay with exponential backoff
          const baseDelay = config.initialDelay * Math.pow(multiplier, attempt);
          const delay = Math.min(baseDelay, maxDelay);

          // Add jitter if enabled (random value between 0.5x and 1.5x)
          const finalDelay = config.jitter
            ? delay * (0.5 + Math.random())
            : delay;

          await this.delay(finalDelay);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: config.maxRetries + 1,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Retries an operation with custom retry condition.
   * 
   * @param operation - The operation to retry
   * @param shouldRetry - Function that determines if we should retry
   * @param config - Retry configuration
   * @returns Promise resolving to retry result
   */
  static async retryWithCondition<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: Error, attempt: number) => boolean,
    config?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    return this.retry(operation, {
      maxRetries: 3,
      initialDelay: 1000,
      multiplier: 2,
      jitter: true,
      ...config,
      shouldRetry,
    });
  }

  /**
   * Retries only on specific error types.
   * 
   * @param operation - The operation to retry
   * @param errorTypes - Array of error types to retry on
   * @param config - Retry configuration
   * @returns Promise resolving to retry result
   */
  static async retryOnErrors<T>(
    operation: () => Promise<T>,
    errorTypes: (new (...args: any[]) => Error)[],
    config?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    return this.retry(operation, {
      maxRetries: 3,
      initialDelay: 1000,
      multiplier: 2,
      jitter: true,
      ...config,
      shouldRetry: (error, attempt) => {
        return errorTypes.some((ErrorType) => error instanceof ErrorType);
      },
    });
  }

  /**
   * Retries only on network errors.
   * 
   * @param operation - The operation to retry
   * @param config - Retry configuration
   * @returns Promise resolving to retry result
   */
  static async retryOnNetworkError<T>(
    operation: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    return this.retry(operation, {
      maxRetries: 3,
      initialDelay: 1000,
      multiplier: 2,
      jitter: true,
      ...config,
      shouldRetry: (error) => {
        // Check for network-related errors
        const message = error.message.toLowerCase();
        return (
          message.includes('network') ||
          message.includes('timeout') ||
          message.includes('connection') ||
          message.includes('econnrefused') ||
          message.includes('enotfound')
        );
      },
    });
  }

  /**
   * Delays execution.
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

