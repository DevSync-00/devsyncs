/**
 * Caching system for frequently accessed data.
 * 
 * Provides in-memory caching with TTL and size limits.
 */

/**
 * Cache entry.
 */
interface CacheEntry<T> {
  /** Cached value */
  value: T;
  /** Expiration timestamp */
  expiresAt: number;
  /** Access count */
  accessCount: number;
  /** Last access time */
  lastAccess: number;
}

/**
 * Cache options.
 */
export interface CacheOptions {
  /** Time to live in milliseconds */
  ttl?: number;
  /** Maximum cache size */
  maxSize?: number;
  /** Eviction strategy */
  evictionStrategy?: 'lru' | 'lfu' | 'fifo';
}

/**
 * Cache manager.
 */
export class CacheManager {
  private static caches: Map<string, Map<string, CacheEntry<any>>> = new Map();
  private static options: Map<string, CacheOptions> = new Map();
  private static cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Creates a named cache.
   */
  static createCache(name: string, options: CacheOptions = {}): void {
    this.caches.set(name, new Map());
    this.options.set(name, {
      ttl: options.ttl || 5 * 60 * 1000, // 5 minutes default
      maxSize: options.maxSize || 100, // 100 items default
      evictionStrategy: options.evictionStrategy || 'lru',
    });

    // Start cleanup interval if not already started
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 60000); // Cleanup every minute
    }
  }

  /**
   * Gets a value from cache.
   */
  static get<T>(cacheName: string, key: string): T | undefined {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      return undefined;
    }

    const entry = cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return undefined;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccess = Date.now();

    return entry.value as T;
  }

  /**
   * Sets a value in cache.
   */
  static set<T>(cacheName: string, key: string, value: T, ttl?: number): void {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      throw new Error(`Cache ${cacheName} does not exist`);
    }

    const options = this.options.get(cacheName)!;
    const expiresAt = Date.now() + (ttl || options.ttl!);

    // Check size limit
    if (cache.size >= options.maxSize!) {
      this.evict(cacheName, options.evictionStrategy!);
    }

    cache.set(key, {
      value,
      expiresAt,
      accessCount: 0,
      lastAccess: Date.now(),
    });
  }

  /**
   * Checks if a key exists in cache.
   */
  static has(cacheName: string, key: string): boolean {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      return false;
    }

    const entry = cache.get(key);
    if (!entry) {
      return false;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Deletes a key from cache.
   */
  static delete(cacheName: string, key: string): boolean {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      return false;
    }
    return cache.delete(key);
  }

  /**
   * Clears a cache.
   */
  static clear(cacheName: string): void {
    const cache = this.caches.get(cacheName);
    if (cache) {
      cache.clear();
    }
  }

  /**
   * Clears all caches.
   */
  static clearAll(): void {
    this.caches.forEach((cache) => cache.clear());
  }

  /**
   * Gets cache statistics.
   */
  static getStats(cacheName: string): {
    size: number;
    maxSize: number;
    hitRate?: number;
  } {
    const cache = this.caches.get(cacheName);
    const options = this.options.get(cacheName);
    if (!cache || !options) {
      throw new Error(`Cache ${cacheName} does not exist`);
    }

    return {
      size: cache.size,
      maxSize: options.maxSize!,
    };
  }

  /**
   * Evicts entries based on strategy.
   */
  private static evict(cacheName: string, strategy: 'lru' | 'lfu' | 'fifo'): void {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      return;
    }

    // Remove 10% of entries
    const toRemove = Math.max(1, Math.floor(cache.size * 0.1));
    const entries = Array.from(cache.entries());

    let sorted: typeof entries;
    switch (strategy) {
      case 'lru':
        sorted = entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
        break;
      case 'lfu':
        sorted = entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        break;
      case 'fifo':
        sorted = entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        break;
    }

    sorted.slice(0, toRemove).forEach(([key]) => {
      cache.delete(key);
    });
  }

  /**
   * Cleans up expired entries.
   */
  private static cleanup(): void {
    const now = Date.now();
    this.caches.forEach((cache) => {
      const keysToDelete: string[] = [];
      cache.forEach((entry, key) => {
        if (now > entry.expiresAt) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((key) => cache.delete(key));
    });
  }

  /**
   * Disposes the cache manager.
   */
  static dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clearAll();
    this.caches.clear();
    this.options.clear();
  }
}

