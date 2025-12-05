/**
 * Rate limiting service.
 * 
 * Prevents abuse by limiting the number of requests or operations
 * per time period for a given identifier (user, IP, etc.).
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  maxRequests: number;

  /**
   * Time window in milliseconds
   */
  windowMs: number;

  /**
   * Whether to skip successful requests
   */
  skipSuccessfulRequests?: boolean;

  /**
   * Whether to skip failed requests
   */
  skipFailedRequests?: boolean;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Number of requests remaining in the window
   */
  remaining: number;

  /**
   * Time when the rate limit resets (milliseconds since epoch)
   */
  resetTime: number;

  /**
   * Total number of requests allowed in the window
   */
  limit: number;
}

/**
 * Rate limit entry
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
  requests: number[];
}

/**
 * Rate limiter service
 */
export class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: RateLimitConfig,
    private cleanupIntervalMs: number = 60000 // 1 minute
  ) {
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Check if a request is allowed
   * 
   * @param identifier - Unique identifier (user ID, IP, etc.)
   * @returns Rate limit result
   */
  check(identifier: string): RateLimitResult {
    const now = Date.now();
    const entry = this.entries.get(identifier);

    if (!entry || now >= entry.resetTime) {
      // Create new entry or reset expired entry
      const newEntry: RateLimitEntry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        requests: [],
      };
      this.entries.set(identifier, newEntry);
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: newEntry.resetTime,
        limit: this.config.maxRequests,
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        limit: this.config.maxRequests,
      };
    }

    // Increment count
    entry.count++;
    entry.requests.push(now);

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
      limit: this.config.maxRequests,
    };
  }

  /**
   * Record a successful request
   * 
   * @param identifier - Unique identifier
   */
  recordSuccess(identifier: string): void {
    if (this.config.skipSuccessfulRequests) {
      return;
    }
    this.check(identifier);
  }

  /**
   * Record a failed request
   * 
   * @param identifier - Unique identifier
   */
  recordFailure(identifier: string): void {
    if (this.config.skipFailedRequests) {
      return;
    }
    this.check(identifier);
  }

  /**
   * Reset rate limit for an identifier
   * 
   * @param identifier - Unique identifier
   */
  reset(identifier: string): void {
    this.entries.delete(identifier);
  }

  /**
   * Get current rate limit status
   * 
   * @param identifier - Unique identifier
   * @returns Rate limit result
   */
  getStatus(identifier: string): RateLimitResult {
    const entry = this.entries.get(identifier);
    const now = Date.now();

    if (!entry || now >= entry.resetTime) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs,
        limit: this.config.maxRequests,
      };
    }

    return {
      allowed: entry.count < this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
      limit: this.config.maxRequests,
    };
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [identifier, entry] of this.entries.entries()) {
      if (now >= entry.resetTime) {
        this.entries.delete(identifier);
      }
    }
  }

  /**
   * Dispose of rate limiter
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.entries.clear();
  }
}

/**
 * Create a rate limiter with default configuration
 */
export function createRateLimiter(
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
): RateLimiter {
  return new RateLimiter({
    maxRequests,
    windowMs,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  });
}

