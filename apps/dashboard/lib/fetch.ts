/**
 * Centralized fetch utility with retry logic, timeout handling, and consistent error handling
 * Used across all dashboard API calls for network robustness
 */

export interface FetchOptions extends RequestInit {
  timeout?: number;
  maxRetries?: number;
  retryableStatuses?: number[];
  retryableErrors?: string[];
}

export interface FetchError extends Error {
  status?: number;
  statusText?: string;
  response?: Response;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];
const DEFAULT_RETRYABLE_ERRORS = [
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'ETIMEDOUT',
  'fetch failed',
  'network',
  'timeout',
  'The user aborted a request',
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

function isRetryableError(error: unknown, retryableErrors: string[]): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return retryableErrors.some((pattern) => message.includes(pattern.toLowerCase()));
}

function isRetryableStatus(status: number, retryableStatuses: number[]): boolean {
  return retryableStatuses.includes(status);
}

async function attemptFetch(
  url: string,
  options: FetchOptions,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await Promise.race([
      fetch(url, {
        ...options,
        signal: options.signal || controller.signal,
      }),
      createTimeoutPromise(timeoutMs),
    ]);

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Centralized fetch function with automatic retry, timeout, and error handling
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options including timeout, retry config, and standard RequestInit
 * @returns Promise resolving to Response
 * @throws FetchError with status, statusText, and response details
 * 
 * @example
 * ```ts
 * const response = await robustFetch('/api/projects', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'My Project' }),
 *   timeout: 10000,
 *   maxRetries: 2,
 * });
 * const data = await response.json();
 * ```
 */
export async function robustFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
    retryableErrors = DEFAULT_RETRYABLE_ERRORS,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;
  let delay = 1000; // Start with 1 second delay
  const maxDelay = 10000; // Cap at 10 seconds
  const backoffMultiplier = 2;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await attemptFetch(url, fetchOptions, timeout);

      // If response is OK, return it immediately
      if (response.ok) {
        return response;
      }

      // Check if status is retryable
      if (isRetryableStatus(response.status, retryableStatuses) && attempt < maxRetries) {
        lastError = new Error(`Request failed with status ${response.status}: ${response.statusText}`);
        // Wait before retrying
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelay);
        continue;
      }

      let message = `Request failed: ${response.status} ${response.statusText}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorBody = await response.clone().json();
          const detail = errorBody?.details || errorBody?.message || errorBody?.error;
          if (detail) {
            message = errorBody?.error && errorBody.error !== detail
              ? `${errorBody.error}: ${detail}`
              : String(detail);
          }
        }
      } catch {
        // Keep the default HTTP status message if the error body cannot be read.
      }

      // Non-retryable error or last attempt - throw with full context
      const error: FetchError = new Error(message) as FetchError;
      error.status = response.status;
      error.statusText = response.statusText;
      error.response = response;
      throw error;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (isRetryableError(error, retryableErrors) && attempt < maxRetries) {
        // Wait before retrying with exponential backoff
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelay);
        continue;
      }

      // Non-retryable error or last attempt
      if (error instanceof Error && 'status' in error) {
        throw error; // Already a FetchError
      }

      const fetchError: FetchError = new Error(
        error instanceof Error ? error.message : 'Network request failed'
      ) as FetchError;
      if (error instanceof Error && 'status' in error) {
        fetchError.status = (error as any).status;
        fetchError.statusText = (error as any).statusText;
        fetchError.response = (error as any).response;
      }
      throw fetchError;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Request failed after all retries');
}

/**
 * Convenience wrapper that automatically parses JSON responses
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @returns Promise resolving to parsed JSON data
 * 
 * @example
 * ```ts
 * const data = await robustFetchJSON('/api/projects');
 * ```
 */
export async function robustFetchJSON<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const response = await robustFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    const fetchError: FetchError = new Error(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`
    ) as FetchError;
    fetchError.status = response.status;
    fetchError.statusText = response.statusText;
    fetchError.response = response;
    throw fetchError;
  }
}

/**
 * Helper to extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if ('status' in error && 'statusText' in error) {
      const fetchError = error as FetchError;
      return fetchError.statusText || fetchError.message || 'Request failed';
    }
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

/**
 * Helper to check if an error is a network/retryable error
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('fetch failed') ||
    message.includes('econnrefused') ||
    message.includes('enotfound')
  );
}

