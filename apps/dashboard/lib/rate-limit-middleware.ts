/**
 * Rate limiting middleware for Next.js API routes
 * Can be used in middleware.ts or directly in API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, generateRateLimitKey } from './rate-limiter';
import { logger } from './logger';
import { trackMessage } from './error-tracking';

/**
 * Rate limit middleware
 * Returns null if request should proceed, or a response if rate limited
 */
export function rateLimitMiddleware(request: NextRequest): NextResponse | null {
  const path = request.nextUrl.pathname;
  
  // Only apply rate limiting to API routes
  if (!path.startsWith('/api/')) {
    return null;
  }

  try {
    const result = checkRateLimit(request as any);

    if (!result.allowed) {
      // Rate limit exceeded
      const key = generateRateLimitKey(request as any);
      
      logger.warn('Rate limit exceeded', {
        path,
        key,
        retryAfter: result.retryAfter,
      });

      trackMessage(
        `Rate limit exceeded for ${path}`,
        'warning',
        {
          operation: 'rate_limit',
          metadata: {
            path,
            key,
            retryAfter: result.retryAfter,
          },
        }
      );

      // Return rate limit response
      const response = NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        },
        { status: 429 }
      );

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', String(result.remaining + 1));
      response.headers.set('X-RateLimit-Remaining', '0');
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)));
      response.headers.set('Retry-After', String(result.retryAfter || 60));

      return response;
    }

    // Request allowed - add rate limit headers to response
    // We'll need to add these in the actual response, so we store them in request
    (request as any).rateLimitHeaders = {
      'X-RateLimit-Limit': String(result.remaining + 1),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
    };

    return null;
  } catch (error) {
    // If rate limiting fails, log but don't block the request
    logger.error('Rate limit check failed', error instanceof Error ? error : new Error(String(error)), {
      path,
    });
    return null;
  }
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  headers: Record<string, string>
): void {
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
}

/**
 * Wrapper for API route handlers with rate limiting
 */
export function withRateLimit(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  customConfig?: { skipRateLimit?: boolean }
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    // Check rate limit
    if (!customConfig?.skipRateLimit) {
      const rateLimitResponse = rateLimitMiddleware(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }
    }

    // Execute handler
    const response = await handler(request, context);

    // Add rate limit headers if available
    const rateLimitHeaders = (request as any).rateLimitHeaders;
    if (rateLimitHeaders) {
      addRateLimitHeaders(response, rateLimitHeaders);
    }

    return response;
  };
}

