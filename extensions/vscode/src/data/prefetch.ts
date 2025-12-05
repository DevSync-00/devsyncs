/**
 * Smart prefetching system.
 * 
 * Provides capabilities to prefetch data that is likely to be needed soon.
 */

/**
 * Prefetch strategy.
 */
export type PrefetchStrategy = 'adjacent' | 'next' | 'all' | 'custom';

/**
 * Prefetch options.
 */
export interface PrefetchOptions {
  /** Prefetch strategy */
  strategy?: PrefetchStrategy;
  /** Custom prefetch function */
  customPrefetch?: (current: any) => Promise<any[]>;
  /** Maximum prefetch items */
  maxPrefetch?: number;
  /** Prefetch delay in milliseconds */
  delay?: number;
}

/**
 * Prefetch manager.
 */
export class PrefetchManager<T> {
  private prefetchFn: (item: T) => Promise<T[]>;
  private options: Required<PrefetchOptions>;
  private prefetched: Map<string, T[]> = new Map();
  private prefetching: Set<string> = new Set();

  constructor(
    prefetchFn: (item: T) => Promise<T[]>,
    options: PrefetchOptions = {}
  ) {
    this.prefetchFn = prefetchFn;
    this.options = {
      strategy: options.strategy ?? 'adjacent',
      customPrefetch: options.customPrefetch ?? (async () => []),
      maxPrefetch: options.maxPrefetch ?? 5,
      delay: options.delay ?? 100,
    };
  }

  /**
   * Prefetches data for an item.
   */
  async prefetch(item: T, getKey: (item: T) => string): Promise<void> {
    const key = getKey(item);

    // Skip if already prefetched or prefetching
    if (this.prefetched.has(key) || this.prefetching.has(key)) {
      return;
    }

    // Delay prefetch to avoid blocking
    await new Promise((resolve) => setTimeout(resolve, this.options.delay));

    this.prefetching.add(key);
    try {
      const prefetched = await this.prefetchFn(item);
      this.prefetched.set(key, prefetched.slice(0, this.options.maxPrefetch));
    } catch (error) {
      console.warn('Prefetch failed:', error);
    } finally {
      this.prefetching.delete(key);
    }
  }

  /**
   * Gets prefetched data for an item.
   */
  getPrefetched(item: T, getKey: (item: T) => string): T[] | undefined {
    const key = getKey(item);
    return this.prefetched.get(key);
  }

  /**
   * Clears prefetched data.
   */
  clearPrefetched(key?: string): void {
    if (key) {
      this.prefetched.delete(key);
    } else {
      this.prefetched.clear();
    }
  }

  /**
   * Prefetches adjacent items.
   */
  async prefetchAdjacent(
    items: T[],
    currentIndex: number,
    getKey: (item: T) => string
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // Prefetch previous items
    for (let i = Math.max(0, currentIndex - 2); i < currentIndex; i++) {
      promises.push(this.prefetch(items[i], getKey));
    }

    // Prefetch next items
    for (let i = currentIndex + 1; i < Math.min(items.length, currentIndex + 3); i++) {
      promises.push(this.prefetch(items[i], getKey));
    }

    await Promise.all(promises);
  }

  /**
   * Prefetches next items.
   */
  async prefetchNext(
    items: T[],
    currentIndex: number,
    getKey: (item: T) => string
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let i = currentIndex + 1; i < Math.min(items.length, currentIndex + this.options.maxPrefetch + 1); i++) {
      promises.push(this.prefetch(items[i], getKey));
    }

    await Promise.all(promises);
  }
}

