/**
 * Throttle utility for updates.
 * 
 * Limits the rate at which a function can be invoked.
 */

/**
 * Throttled function type.
 */
export type ThrottledFunction<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => void;

/**
 * Throttle options.
 */
export interface ThrottleOptions {
  /** Leading edge execution */
  leading?: boolean;
  /** Trailing edge execution */
  trailing?: boolean;
}

/**
 * Creates a throttled function.
 * 
 * @param func - Function to throttle
 * @param wait - Delay in milliseconds
 * @param options - Throttle options
 * @returns Throttled function
 * 
 * @example
 * ```typescript
 * const throttledUpdate = throttle((data: any) => {
 *   updateUI(data);
 * }, 100);
 * 
 * // Rapid calls
 * throttledUpdate(data1); // Executed immediately
 * throttledUpdate(data2); // Ignored
 * throttledUpdate(data3); // Ignored
 * // After 100ms, last call executes
 * ```
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: ThrottleOptions = {}
): ThrottledFunction<T> {
  const { leading = true, trailing = true } = options;
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime = 0;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    lastArgs = args;

    if (leading && timeSinceLastCall >= wait) {
      // Execute immediately if enough time has passed
      lastCallTime = now;
      func(...args);
      lastArgs = null;
    } else if (trailing && !timeout) {
      // Schedule execution for trailing edge
      timeout = setTimeout(() => {
        if (lastArgs) {
          lastCallTime = Date.now();
          func(...lastArgs);
          lastArgs = null;
        }
        timeout = null;
      }, leading ? wait - timeSinceLastCall : wait);
    }
  };
}

/**
 * Cancellable throttled function.
 */
export interface CancellableThrottledFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
}

/**
 * Creates a cancellable throttled function.
 * 
 * @param func - Function to throttle
 * @param wait - Delay in milliseconds
 * @param options - Throttle options
 * @returns Cancellable throttled function
 * 
 * @example
 * ```typescript
 * const throttledUpdate = throttleCancellable((data: any) => {
 *   updateUI(data);
 * }, 100);
 * 
 * throttledUpdate(data);
 * throttledUpdate.cancel(); // Cancel pending execution
 * throttledUpdate.flush(); // Execute immediately if pending
 * ```
 */
export function throttleCancellable<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: ThrottleOptions = {}
): CancellableThrottledFunction<T> {
  const { leading = true, trailing = true } = options;
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime = 0;

  const throttled = function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    lastArgs = args;

    if (leading && timeSinceLastCall >= wait) {
      lastCallTime = now;
      func(...args);
      lastArgs = null;
    } else if (trailing && !timeout) {
      timeout = setTimeout(() => {
        if (lastArgs) {
          lastCallTime = Date.now();
          func(...lastArgs);
          lastArgs = null;
        }
        timeout = null;
      }, leading ? wait - timeSinceLastCall : wait);
    }
  } as CancellableThrottledFunction<T>;

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastArgs = null;
  };

  throttled.flush = () => {
    if (timeout && lastArgs) {
      clearTimeout(timeout);
      timeout = null;
      lastCallTime = Date.now();
      func(...lastArgs);
      lastArgs = null;
    }
  };

  return throttled;
}

