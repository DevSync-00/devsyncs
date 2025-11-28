/**
 * API route wrapper with performance monitoring and error tracking
 * Use this to wrap API route handlers for consistent monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { measurePerformance } from './performance-monitor';
import { trackError } from './error-tracking';
import { logger } from './logger';
import { formatErrorMessage } from './error-utils';

export interface ApiHandlerContext {
  userId?: string;
  projectId?: string;
  operation: string;
}

/**
 * Wrap an API route handler with performance monitoring and error tracking
 */
export function withApiMonitoring<T = any>(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse<T>>,
  operation: string
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse<T>> => {
    const startTime = Date.now();
    const method = request.method;
    const path = request.nextUrl.pathname;

    try {
      // Measure performance
      const response = await measurePerformance(
        `API ${method} ${path}`,
        async () => {
          return await handler(request, context);
        },
        {
          method,
          path,
          operation,
        }
      );

      // Log successful request
      const duration = Date.now() - startTime;
      logger.apiRequest(method, path, response.status, duration, {
        operation,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Track error
      trackError(error, {
        operation,
        metadata: {
          method,
          path,
          duration,
        },
      });

      // Log error
      logger.error(`API ${method} ${path} failed`, error instanceof Error ? error : new Error(String(error)), {
        operation,
        duration,
      });

      // Return error response
      const formatted = formatErrorMessage(error, {
        operation,
        resource: path,
      });

      return NextResponse.json(
        {
          error: formatted.message,
          code: (formatted as any).code || 'INTERNAL_ERROR',
        } as any,
        { status: (formatted as any).statusCode || 500 }
      );
    }
  };
}

/**
 * Extract user context from request
 */
export async function extractUserContext(request: NextRequest): Promise<ApiHandlerContext | null> {
  try {
    // Try to get user from auth header or session
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      // API key authentication - user ID would be in token
      // For now, return null as we'd need to decode the token
      return null;
    }

    // For session-based auth, user context would be extracted from session
    // This is a placeholder - actual implementation would decode session
    return null;
  } catch {
    return null;
  }
}

