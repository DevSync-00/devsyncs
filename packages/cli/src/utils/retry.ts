/**
 * Retry utility with exponential backoff
 */
export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    retryableErrors = []
  } = options;

  let lastError: Error | null = null;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if error is retryable
      const isRetryable = retryableErrors.length === 0 || 
        retryableErrors.some(pattern => lastError!.message.includes(pattern));
      
      if (!isRetryable || attempt === maxAttempts) {
        throw lastError;
      }

      // Wait before retrying
      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError || new Error('Retry failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Timeout wrapper for async operations
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

