/**
 * Utility functions for async delays and timeouts
 */

/**
 * Creates a promise that resolves after the specified number of milliseconds
 * @param ms - Number of milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const handle = setTimeout(() => {
      clearTimeout(handle);
      resolve();
    }, ms);
  });
}

/**
 * Creates a promise that rejects after the specified timeout
 * @param ms - Number of milliseconds before timeout
 * @param message - Optional error message
 * @returns Promise that rejects with a timeout error
 */
export function timeout(ms: number, message: string = 'Operation timed out'): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });
}

/**
 * Creates a timeout controller for aborting operations
 * @param ms - Number of milliseconds before timeout
 * @returns Object with abort controller and cleanup function
 */
export function createTimeoutController(ms: number): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);

  return {
    controller,
    cleanup: () => clearTimeout(timeoutId),
  };
}

