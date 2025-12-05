/**
 * Memoization utilities for expensive calculations.
 * 
 * Provides utilities to cache expensive function results.
 */

/**
 * Memoized function result.
 */
interface MemoizedResult<T> {
  /** Cached result */
  result: T;
  /** Cache timestamp */
  timestamp: number;
}

/**
 * Memoization options.
 */
export interface MemoizeOptions {
  /** Cache TTL in milliseconds */
  ttl?: number;
  /** Maximum cache size */
  maxSize?: number;
  /** Custom key generator */
  keyGenerator?: (...args: any[]) => string;
}

/**
 * Creates a memoized function.
 * 
 * @param func - Function to memoize
 * @param options - Memoization options
 * @returns Memoized function
 * 
 * @example
 * ```typescript
 * const expensiveCalculation = memoize((n: number) => {
 *   // Expensive computation
 *   return n * n;
 * }, { ttl: 60000 }); // Cache for 60 seconds
 * 
 * expensiveCalculation(5); // Computes and caches
 * expensiveCalculation(5); // Returns cached result
 * ```
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  options: MemoizeOptions = {}
): T {
  const {
    ttl,
    maxSize = 100,
    keyGenerator = (...args) => JSON.stringify(args),
  } = options;

  const cache = new Map<string, MemoizedResult<ReturnType<T>>>();
  const accessOrder: string[] = [];

  return function memoized(...args: Parameters<T>): ReturnType<T> {
    const key = keyGenerator(...args);
    const cached = cache.get(key);

    // Check if cached result is still valid
    if (cached) {
      if (!ttl || Date.now() - cached.timestamp < ttl) {
        // Move to end (LRU)
        const index = accessOrder.indexOf(key);
        if (index > -1) {
          accessOrder.splice(index, 1);
        }
        accessOrder.push(key);
        return cached.result;
      } else {
        // Expired, remove from cache
        cache.delete(key);
        const index = accessOrder.indexOf(key);
        if (index > -1) {
          accessOrder.splice(index, 1);
        }
      }
    }

    // Compute result
    const result = func(...args);

    // Add to cache
    cache.set(key, {
      result,
      timestamp: Date.now(),
    });
    accessOrder.push(key);

    // Evict if cache is too large
    if (cache.size > maxSize) {
      const oldestKey = accessOrder.shift();
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }

    return result;
  } as T;
}

/**
 * Weak memoization using WeakMap (for object keys).
 */
export function weakMemoize<T extends (...args: any[]) => any>(func: T): T {
  const cache = new WeakMap<object, ReturnType<T>>();

  return function weakMemoized(...args: Parameters<T>): ReturnType<T> {
    // Only works with object keys
    const key = args[0] as object;
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = func(...args);
    cache.set(key, result);
    return result;
  } as T;
}

/**
 * Memoizes a function with a custom equality check.
 */
export function memoizeWithEquality<T extends (...args: any[]) => any>(
  func: T,
  equalityCheck: (a: Parameters<T>, b: Parameters<T>) => boolean,
  options: Omit<MemoizeOptions, 'keyGenerator'> = {}
): T {
  const { ttl, maxSize = 100 } = options;
  const cache: Array<{
    args: Parameters<T>;
    result: MemoizedResult<ReturnType<T>>;
  }> = [];

  return function memoized(...args: Parameters<T>): ReturnType<T> {
    // Find cached result with matching args
    const cached = cache.find((entry) => equalityCheck(entry.args, args));

    if (cached) {
      if (!ttl || Date.now() - cached.result.timestamp < ttl) {
        return cached.result.result;
      } else {
        // Expired, remove from cache
        const index = cache.indexOf(cached);
        cache.splice(index, 1);
      }
    }

    // Compute result
    const result = func(...args);

    // Add to cache
    cache.push({
      args,
      result: {
        result,
        timestamp: Date.now(),
      },
    });

    // Evict if cache is too large
    if (cache.length > maxSize) {
      cache.shift();
    }

    return result;
  } as T;
}

