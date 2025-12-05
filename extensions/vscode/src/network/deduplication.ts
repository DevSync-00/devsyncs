/**
 * Request deduplication system.
 * 
 * Prevents duplicate requests by caching in-flight requests and reusing their promises.
 */

/**
 * Deduplication key generator.
 */
export type DeduplicationKeyGenerator = (method: string, url: string, body?: any) => string;

/**
 * Deduplication options.
 */
export interface DeduplicationOptions {
  /** Key generator function */
  keyGenerator?: DeduplicationKeyGenerator;
  /** Maximum cache size */
  maxCacheSize?: number;
  /** Cache TTL in milliseconds */
  ttl?: number;
}

/**
 * Request deduplication manager.
 */
export class RequestDeduplication {
  private inFlight: Map<string, Promise<any>> = new Map();
  private cache: Map<string, { data: any; expiresAt: number }> = new Map();
  private options: Required<DeduplicationOptions>;

  constructor(options: DeduplicationOptions = {}) {
    this.options = {
      keyGenerator: options.keyGenerator ?? this.defaultKeyGenerator,
      maxCacheSize: options.maxCacheSize ?? 100,
      ttl: options.ttl ?? 5000, // 5 seconds default
    };
  }

  /**
   * Executes a request with deduplication.
   */
  async execute<T>(
    method: string,
    url: string,
    requestFn: () => Promise<T>,
    body?: any
  ): Promise<T> {
    const key = this.options.keyGenerator(method, url, body);

    // Check if request is in flight
    const inFlightRequest = this.inFlight.get(key);
    if (inFlightRequest) {
      return inFlightRequest as Promise<T>;
    }

    // Check cache
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }

    // Execute request
    const requestPromise = requestFn()
      .then((data) => {
        // Cache result
        this.cache.set(key, {
          data,
          expiresAt: Date.now() + this.options.ttl,
        });

        // Clean up in-flight
        this.inFlight.delete(key);

        // Evict if cache is too large
        if (this.cache.size > this.options.maxCacheSize) {
          this.evictOldest();
        }

        return data;
      })
      .catch((error) => {
        // Clean up on error
        this.inFlight.delete(key);
        throw error;
      });

    // Store in-flight request
    this.inFlight.set(key, requestPromise);

    return requestPromise;
  }

  /**
   * Default key generator.
   */
  private defaultKeyGenerator: DeduplicationKeyGenerator = (method, url, body) => {
    const bodyKey = body ? JSON.stringify(body) : '';
    return `${method}:${url}:${bodyKey}`;
  };

  /**
   * Evicts oldest cache entry.
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestExpiresAt = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < oldestExpiresAt) {
        oldestExpiresAt = entry.expiresAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clears cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clears in-flight requests.
   */
  clearInFlight(): void {
    this.inFlight.clear();
  }

  /**
   * Clears all.
   */
  clear(): void {
    this.clearCache();
    this.clearInFlight();
  }
}

