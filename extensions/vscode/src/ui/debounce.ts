/**
 * Debounce utility for user input.
 * 
 * Delays execution of a function until after a specified time has passed
 * since the last time it was invoked.
 */

/**
 * Debounced function type.
 */
export type DebouncedFunction<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => void;

/**
 * Creates a debounced function.
 * 
 * @param func - Function to debounce
 * @param wait - Delay in milliseconds
 * @param immediate - If true, execute immediately on first call
 * @returns Debounced function
 * 
 * @example
 * ```typescript
 * const debouncedSearch = debounce((query: string) => {
 *   performSearch(query);
 * }, 300);
 * 
 * // User types "hello"
 * debouncedSearch('h'); // Not executed
 * debouncedSearch('he'); // Not executed
 * debouncedSearch('hel'); // Not executed
 * debouncedSearch('hell'); // Not executed
 * debouncedSearch('hello'); // Executed after 300ms
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): DebouncedFunction<T> {
  let timeout: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) {
        func(...args);
      }
    }, wait);

    if (callNow) {
      func(...args);
    }
  };
}

/**
 * Cancellable debounced function.
 */
export interface CancellableDebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
}

/**
 * Creates a cancellable debounced function.
 * 
 * @param func - Function to debounce
 * @param wait - Delay in milliseconds
 * @param immediate - If true, execute immediately on first call
 * @returns Cancellable debounced function
 * 
 * @example
 * ```typescript
 * const debouncedSearch = debounceCancellable((query: string) => {
 *   performSearch(query);
 * }, 300);
 * 
 * debouncedSearch('hello');
 * debouncedSearch.cancel(); // Cancel pending execution
 * debouncedSearch.flush(); // Execute immediately if pending
 * ```
 */
export function debounceCancellable<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): CancellableDebouncedFunction<T> {
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = function debounced(...args: Parameters<T>) {
    lastArgs = args;
    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate) {
        func(...lastArgs!);
      }
    }, wait);

    if (callNow) {
      func(...args);
    }
  } as CancellableDebouncedFunction<T>;

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastArgs = null;
  };

  debounced.flush = () => {
    if (timeout && lastArgs) {
      clearTimeout(timeout);
      timeout = null;
      func(...lastArgs);
      lastArgs = null;
    }
  };

  return debounced;
}

