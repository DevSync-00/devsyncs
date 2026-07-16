/**
 * Centralized fetch utilities with retry and timeout support
 * Provides consistent error handling and retry logic across the dashboard
 */

import { isRetryableError } from './error-utils';

export interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  retryableStatusCodes?: number[];
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second
const DEFAULT_RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a response status is retryable
 */
function isRetryableStatus(status: number, retryableStatusCodes: number[]): boolean {
  return retryableStatusCodes.includes(status);
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Enhanced fetch with retry logic and timeout
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    retryableStatusCodes = DEFAULT_RETRYABLE_STATUS_CODES,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Attempt fetch with timeout
      const response = await fetchWithTimeout(url, fetchOptions, timeout);

      // Check if status is retryable
      if (!response.ok && isRetryableStatus(response.status, retryableStatusCodes)) {
        lastResponse = response;
        
        // Don't retry on last attempt
        if (attempt === retries) {
          break;
        }

        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      // Success or non-retryable error
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryableError(error) || attempt === retries) {
        throw error;
      }

      // Exponential backoff
      const delay = retryDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  // If we have a response, return it (even if it's an error)
  if (lastResponse) {
    return lastResponse;
  }

  // Otherwise throw the last error
  throw lastError || new Error('Fetch failed after retries');
}

/**
 * Fetch JSON with retry and timeout
 * Automatically handles JSON parsing and error formatting
 */
export async function fetchJSON<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Handle non-JSON responses
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Expected JSON response, got ${contentType}: ${text.substring(0, 100)}`);
  }

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.details
      ? `${data.error || data.message || `HTTP ${response.status}`}: ${data.details}`
      : data.error || data.message || `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return data as T;
}

/**
 * Create an AbortController for request cancellation
 */
export function createAbortController(): AbortController {
  return new AbortController();
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ETIMEDOUT') ||
    error.message.includes('timeout')
  );
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('timeout') || error.message.includes('timed out');
}

