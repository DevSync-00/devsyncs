/**
 * Retry system with exponential backoff.
 * 
 * Retries failed requests with exponential backoff delays.
 */

/**
 * Retry options.
 */
export interface RetryOptions {
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier */
  multiplier?: number;
  /** Retry condition function */
  shouldRetry?: (error: any, attempt: number) => boolean;
}

/**
 * Retry manager.
 */
export class RetryManager {
  private options: Required<RetryOptions>;

  constructor(options: RetryOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      initialDelay: options.initialDelay ?? 1000,
      maxDelay: options.maxDelay ?? 30000,
      multiplier: options.multiplier ?? 2,
      shouldRetry: options.shouldRetry ?? this.defaultShouldRetry,
    };
  }

  /**
   * Executes a function with retry.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should retry
        if (attempt < this.options.maxRetries && this.options.shouldRetry(error, attempt)) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error('Retry failed');
  }

  /**
   * Calculates delay for retry attempt.
   */
  private calculateDelay(attempt: number): number {
    const delay = this.options.initialDelay * Math.pow(this.options.multiplier, attempt);
    return Math.min(delay, this.options.maxDelay);
  }

  /**
   * Default retry condition.
   */
  private defaultShouldRetry(error: any, attempt: number): boolean {
    // Retry on network errors
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('enotfound') ||
        message.includes('econnreset') ||
        message.includes('etimedout')
      );
    }

    // Retry on HTTP 5xx errors
    if (typeof error === 'object' && error !== null) {
      const status = (error as any).status;
      if (typeof status === 'number' && status >= 500 && status < 600) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sleeps for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

