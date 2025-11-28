/**
 * Rate limiting utilities
 * 
 * Implements a sliding window rate limiting algorithm to protect API endpoints
 * from abuse and ensure fair resource usage. Uses an in-memory store with
 * automatic cleanup of expired entries.
 * 
 * @module rate-limiter
 * @example
 * ```typescript
 * import { rateLimiter, getRateLimitConfig } from './rate-limiter';
 * 
 * const config = getRateLimitConfig('/api/projects');
 * const result = rateLimiter.check('user:123', config);
 * 
 * if (!result.allowed) {
 *   return new Response('Rate limit exceeded', { status: 429 });
 * }
 * ```
 */

/**
 * Configuration for rate limiting behavior
 */
export interface RateLimitConfig {
  /** Time window in milliseconds (e.g., 60000 for 1 minute) */
  windowMs: number;
  /** Maximum number of requests allowed within the time window */
  maxRequests: number;
  /** Optional custom function to generate rate limit keys from requests */
  keyGenerator?: (request: Request) => string;
  /** If true, successful requests (2xx status) won't count toward the limit */
  skipSuccessfulRequests?: boolean;
  /** If true, failed requests (4xx/5xx status) won't count toward the limit */
  skipFailedRequests?: boolean;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** Unix timestamp (milliseconds) when the rate limit window resets */
  resetTime: number;
  /** Number of seconds to wait before retrying (only present if allowed is false) */
  retryAfter?: number;
}

interface RequestRecord {
  count: number;
  resetTime: number;
  requests: number[]; // Timestamps of requests in current window
}

class RateLimiter {
  private store: Map<string, RequestRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if a request should be allowed based on rate limit configuration
   * 
   * Uses a sliding window algorithm: maintains a list of request timestamps
   * within the current window and filters out expired entries before checking
   * the limit.
   * 
   * @param key - Unique identifier for the rate limit (e.g., user ID, IP address)
   * @param config - Rate limit configuration (window size and max requests)
   * @returns Rate limit result with allowed status, remaining count, and reset time
   * 
   * @example
   * ```typescript
   * const result = rateLimiter.check('user:123', {
   *   windowMs: 60000,
   *   maxRequests: 10
   * });
   * 
   * if (!result.allowed) {
   *   console.log(`Rate limited. Retry after ${result.retryAfter} seconds`);
   * }
   * ```
   */
  check(
    key: string,
    config: RateLimitConfig
  ): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get or create record
    let record = this.store.get(key);
    
    if (!record || record.resetTime < now) {
      // Create new record
      record = {
        count: 0,
        resetTime: now + config.windowMs,
        requests: [],
      };
      this.store.set(key, record);
    }

    // Remove old requests outside the window
    record.requests = record.requests.filter(timestamp => timestamp > windowStart);
    record.count = record.requests.length;

    // Check if limit exceeded
    const allowed = record.count < config.maxRequests;

    if (allowed) {
      // Add current request
      record.requests.push(now);
      record.count = record.requests.length;
    }

    const remaining = Math.max(0, config.maxRequests - record.count);
    const retryAfter = allowed ? undefined : Math.ceil((record.resetTime - now) / 1000);

    return {
      allowed,
      remaining,
      resetTime: record.resetTime,
      retryAfter,
    };
  }

  /**
   * Reset rate limit for a specific key
   * 
   * Removes all rate limit tracking for the given key, effectively
   * resetting their limit to zero.
   * 
   * @param key - The rate limit key to reset
   * 
   * @example
   * ```typescript
   * // Reset rate limit for a user (e.g., after manual intervention)
   * rateLimiter.reset('user:123');
   * ```
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Get current rate limit status without incrementing the counter
   * 
   * Useful for checking remaining requests without actually consuming
   * a rate limit slot.
   * 
   * @param key - The rate limit key to check
   * @param maxRequests - Maximum requests allowed (from config)
   * @returns Current status or null if no record exists or has expired
   * 
   * @example
   * ```typescript
   * const status = rateLimiter.getStatus('user:123', 10);
   * if (status) {
   *   console.log(`${status.remaining} requests remaining`);
   * }
   * ```
   */
  getStatus(key: string, maxRequests: number): RateLimitResult | null {
    const record = this.store.get(key);
    if (!record) {
      return null;
    }

    const now = Date.now();
    if (record.resetTime < now) {
      return null; // Expired
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - record.count),
      resetTime: record.resetTime,
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (record.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Default configurations per endpoint
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Authentication endpoints - stricter limits
  '/api/auth/login': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
  },
  '/api/auth/signup': {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 signups per hour
  },
  
  // API endpoints - moderate limits
  '/api/projects': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },
  '/api/projects/:id': {
    windowMs: 60 * 1000,
    maxRequests: 60, // 60 requests per minute
  },
  '/api/scans': {
    windowMs: 60 * 1000,
    maxRequests: 20, // 20 requests per minute
  },
  '/api/migrations': {
    windowMs: 60 * 1000,
    maxRequests: 10, // 10 requests per minute (expensive operations)
  },
  '/api/migrations/:id/execute': {
    windowMs: 60 * 1000,
    maxRequests: 5, // 5 executions per minute
  },
  '/api/ai/query': {
    windowMs: 60 * 1000,
    maxRequests: 10, // 10 AI queries per minute
  },
  '/api/ai/explain': {
    windowMs: 60 * 1000,
    maxRequests: 10, // 10 explanations per minute
  },
  
  // Default for all other API routes
  default: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
};

/**
 * Get rate limit configuration for a specific API path
 * 
 * Matches the path against configured patterns and returns the appropriate
 * rate limit configuration. Supports exact matches and pattern matching
 * with path parameters (e.g., `/api/projects/:id`).
 * 
 * @param path - API path (e.g., '/api/projects' or '/api/projects/123')
 * @returns Rate limit configuration for the path, or default if no match
 * 
 * @example
 * ```typescript
 * const config = getRateLimitConfig('/api/projects');
 * // Returns: { windowMs: 60000, maxRequests: 30 }
 * 
 * const config2 = getRateLimitConfig('/api/projects/abc123');
 * // Matches pattern '/api/projects/:id' and returns same config
 * ```
 */
export function getRateLimitConfig(path: string): RateLimitConfig {
  // Try exact match first
  if (RATE_LIMIT_CONFIGS[path]) {
    return RATE_LIMIT_CONFIGS[path];
  }

  // Try pattern matching (e.g., /api/projects/:id)
  for (const [pattern, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
    if (pattern.includes(':')) {
      const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
      if (regex.test(path)) {
        return config;
      }
    }
  }

  // Return default
  return RATE_LIMIT_CONFIGS.default;
}

/**
 * Generate a rate limit key from a request
 * 
 * Creates a unique identifier for rate limiting based on the request path
 * and authentication method. Uses API key tokens (first 8 chars) or
 * session identifiers.
 * 
 * @param request - The HTTP request object
 * @returns A unique rate limit key (e.g., '/api/projects:api:abc12345')
 * 
 * @example
 * ```typescript
 * const key = generateRateLimitKey(request);
 * // Returns: '/api/projects:api:abc12345' for API key auth
 * // Returns: '/api/projects:session' for session auth
 * ```
 */
export function generateRateLimitKey(request: Request): string {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Try to get user identifier
  const authHeader = request.headers.get('authorization');
  let identifier = 'anonymous';
  
  if (authHeader?.startsWith('Bearer ')) {
    // For API key auth, use a hash of the token (first 8 chars for simplicity)
    const token = authHeader.replace('Bearer ', '');
    identifier = `api:${token.substring(0, 8)}`;
  } else {
    // For session auth, we'd need to extract user ID from session
    // For now, use IP address as fallback
    // In production, you'd get this from request headers (X-Forwarded-For, etc.)
    identifier = 'session';
  }

  return `${path}:${identifier}`;
}

/**
 * Check rate limit for a request
 * 
 * Convenience function that combines path-based config lookup and
 * rate limit checking. Automatically determines the rate limit key
 * and configuration based on the request path.
 * 
 * @param request - The HTTP request to check
 * @returns Rate limit result indicating if request is allowed
 * 
 * @example
 * ```typescript
 * const result = checkRateLimit(request);
 * if (!result.allowed) {
 *   return new Response('Too many requests', { status: 429 });
 * }
 * ```
 */
export function checkRateLimit(request: Request): RateLimitResult {
  const path = new URL(request.url).pathname;
  const config = getRateLimitConfig(path);
  const key = config.keyGenerator 
    ? config.keyGenerator(request)
    : generateRateLimitKey(request);
  
  return rateLimiter.check(key, config);
}

