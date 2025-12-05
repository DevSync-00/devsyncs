/**
 * Caching system for scan results and other data.
 * 
 * Provides capabilities to cache frequently accessed data with TTL and eviction policies.
 */

/**
 * Cache entry.
 */
interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Expiration timestamp */
  expiresAt: number;
  /** Access timestamp */
  accessedAt: number;
  /** Access count */
  accessCount: number;
}

/**
 * Cache options.
 */
export interface CacheOptions {
  /** Time to live in milliseconds */
  ttl?: number;
  /** Maximum cache size */
  maxSize?: number;
  /** Eviction policy */
  evictionPolicy?: 'lru' | 'lfu' | 'fifo';
}

/**
 * Cache manager.
 */
export class DataCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl ?? 5 * 60 * 1000, // 5 minutes default
      maxSize: options.maxSize ?? 100,
      evictionPolicy: options.evictionPolicy ?? 'lru',
    };
  }

  /**
   * Gets cached data.
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      return undefined;
    }

    // Update access info
    entry.accessedAt = Date.now();
    entry.accessCount++;

    // Update access order for LRU
    if (this.options.evictionPolicy === 'lru') {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);
    }

    return entry.data;
  }

  /**
   * Sets cached data.
   */
  set(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.options.ttl);

    // Update existing entry
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.data = data;
      entry.expiresAt = expiresAt;
      entry.accessedAt = Date.now();
      entry.accessCount++;

      // Update access order for LRU
      if (this.options.evictionPolicy === 'lru') {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
          this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(key);
      }
      return;
    }

    // Add new entry
    this.cache.set(key, {
      data,
      expiresAt,
      accessedAt: Date.now(),
      accessCount: 1,
    });

    // Add to access order
    if (this.options.evictionPolicy === 'lru' || this.options.evictionPolicy === 'fifo') {
      this.accessOrder.push(key);
    }

    // Evict if cache is too large
    if (this.cache.size > this.options.maxSize) {
      this.evict();
    }
  }

  /**
   * Checks if key exists and is valid.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      return false;
    }

    return true;
  }

  /**
   * Deletes cached data.
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
    return deleted;
  }

  /**
   * Clears all cached data.
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Gets cache size.
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Evicts entries based on eviction policy.
   */
  private evict(): void {
    if (this.cache.size === 0) {
      return;
    }

    let keyToEvict: string | undefined;

    switch (this.options.evictionPolicy) {
      case 'lru':
        // Least recently used (first in access order)
        keyToEvict = this.accessOrder.shift();
        break;

      case 'lfu':
        // Least frequently used
        let minAccessCount = Infinity;
        for (const [key, entry] of this.cache.entries()) {
          if (entry.accessCount < minAccessCount) {
            minAccessCount = entry.accessCount;
            keyToEvict = key;
          }
        }
        break;

      case 'fifo':
        // First in, first out
        keyToEvict = this.accessOrder.shift();
        break;
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict);
    }
  }

  /**
   * Cleans expired entries.
   */
  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
          this.accessOrder.splice(index, 1);
        }
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * Global cache manager for scan results.
 */
class ScanResultsCache {
  private static instance: DataCache<any> | null = null;

  /**
   * Gets the scan results cache instance.
   */
  static getInstance(): DataCache<any> {
    if (!this.instance) {
      this.instance = new DataCache({
        ttl: 10 * 60 * 1000, // 10 minutes
        maxSize: 50,
        evictionPolicy: 'lru',
      });
    }
    return this.instance;
  }
}

/**
 * Gets the scan results cache.
 */
export function getScanResultsCache<T>(): DataCache<T> {
  return ScanResultsCache.getInstance() as DataCache<T>;
}

