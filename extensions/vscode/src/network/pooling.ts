/**
 * Connection pooling system.
 * 
 * Reuses HTTP connections for better performance.
 */

/**
 * Pooled connection.
 */
interface PooledConnection {
  /** Connection URL */
  url: string;
  /** Last used timestamp */
  lastUsed: number;
  /** Use count */
  useCount: number;
}

/**
 * Pool options.
 */
export interface PoolOptions {
  /** Maximum pool size */
  maxSize?: number;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Idle timeout in milliseconds */
  idleTimeout?: number;
}

/**
 * Connection pool manager.
 */
export class ConnectionPool {
  private connections: Map<string, PooledConnection> = new Map();
  private options: Required<PoolOptions>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: PoolOptions = {}) {
    this.options = {
      maxSize: options.maxSize ?? 10,
      timeout: options.timeout ?? 30000,
      idleTimeout: options.idleTimeout ?? 60000,
    };

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Gets or creates a connection for a URL.
   */
  getConnection(url: string): string {
    const normalizedUrl = this.normalizeUrl(url);
    
    // Return existing connection if available
    if (this.connections.has(normalizedUrl)) {
      const connection = this.connections.get(normalizedUrl)!;
      connection.lastUsed = Date.now();
      connection.useCount++;
      return normalizedUrl;
    }

    // Create new connection if pool not full
    if (this.connections.size < this.options.maxSize) {
      this.connections.set(normalizedUrl, {
        url: normalizedUrl,
        lastUsed: Date.now(),
        useCount: 1,
      });
      return normalizedUrl;
    }

    // Evict least recently used connection
    this.evictLRU();
    this.connections.set(normalizedUrl, {
      url: normalizedUrl,
      lastUsed: Date.now(),
      useCount: 1,
    });
    return normalizedUrl;
  }

  /**
   * Releases a connection.
   */
  releaseConnection(url: string): void {
    const normalizedUrl = this.normalizeUrl(url);
    // Connection is kept in pool for reuse
    // Just update last used time
    if (this.connections.has(normalizedUrl)) {
      const connection = this.connections.get(normalizedUrl)!;
      connection.lastUsed = Date.now();
    }
  }

  /**
   * Evicts least recently used connection.
   */
  private evictLRU(): void {
    let lruUrl: string | null = null;
    let lruTime = Infinity;

    for (const [url, connection] of this.connections.entries()) {
      if (connection.lastUsed < lruTime) {
        lruTime = connection.lastUsed;
        lruUrl = url;
      }
    }

    if (lruUrl) {
      this.connections.delete(lruUrl);
    }
  }

  /**
   * Normalizes URL for pooling.
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Use origin for pooling (same host = same connection)
      return parsed.origin;
    } catch {
      return url;
    }
  }

  /**
   * Starts cleanup interval.
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.options.idleTimeout);
  }

  /**
   * Cleans up idle connections.
   */
  private cleanup(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [url, connection] of this.connections.entries()) {
      if (now - connection.lastUsed > this.options.idleTimeout) {
        toRemove.push(url);
      }
    }

    toRemove.forEach((url) => {
      this.connections.delete(url);
    });
  }

  /**
   * Gets pool size.
   */
  getPoolSize(): number {
    return this.connections.size;
  }

  /**
   * Clears the pool.
   */
  clear(): void {
    this.connections.clear();
  }

  /**
   * Disposes the pool.
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

