/**
 * Error tracking utilities
 * Provides centralized error tracking with optional Sentry integration
 */

import { formatError, type ErrorDetails } from './error-handler';

export interface ErrorContext {
  userId?: string;
  projectId?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

let errorTrackingEnabled = false;
let sentryClient: any = null;

/**
 * Initialize error tracking (Sentry or other service)
 */
export function initErrorTracking(dsn?: string): void {
  if (!dsn) {
    // No DSN provided, use console logging only
    errorTrackingEnabled = true;
    return;
  }

  // Sentry initialization is optional
  // To enable Sentry, install @sentry/nextjs package
  // For now, we'll just use console logging
  errorTrackingEnabled = true;
}

/**
 * Track an error
 */
export function trackError(
  error: unknown,
  context?: ErrorContext
): void {
  const errorDetails = formatError(error);
  
  // Log to console
  console.error('[ERROR]', {
    ...errorDetails,
    context,
    timestamp: new Date().toISOString(),
  });

  // Send to error tracking service if enabled
  if (errorTrackingEnabled && sentryClient) {
    try {
      if (context?.userId) {
        sentryClient.setUser({ id: context.userId });
      }

      sentryClient.captureException(error, {
        tags: {
          operation: context?.operation,
          projectId: context?.projectId,
        },
        extra: {
          ...context?.metadata,
          errorDetails,
        },
      });
    } catch (err) {
      // Error tracking failed, just log
      console.error('Failed to send error to tracking service:', err);
    }
  }
}

/**
 * Track a message (non-error)
 */
export function trackMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: ErrorContext
): void {
  console.log(`[${level.toUpperCase()}]`, message, context);

  if (errorTrackingEnabled && sentryClient) {
    try {
      if (context?.userId) {
        sentryClient.setUser({ id: context.userId });
      }

      sentryClient.captureMessage(message, {
        level: level as any,
        tags: {
          operation: context?.operation,
          projectId: context?.projectId,
        },
        extra: context?.metadata,
      });
    } catch (err) {
      console.error('Failed to send message to tracking service:', err);
    }
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, email?: string, metadata?: Record<string, any>): void {
  if (errorTrackingEnabled && sentryClient) {
    try {
      sentryClient.setUser({
        id: userId,
        email,
        ...metadata,
      });
    } catch (err) {
      console.error('Failed to set user context:', err);
    }
  }
}

/**
 * Clear user context
 */
export function clearUserContext(): void {
  if (errorTrackingEnabled && sentryClient) {
    try {
      sentryClient.setUser(null);
    } catch (err) {
      console.error('Failed to clear user context:', err);
    }
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  level: 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
): void {
  if (errorTrackingEnabled && sentryClient) {
    try {
      sentryClient.addBreadcrumb({
        message,
        category,
        level: level as any,
        data,
        timestamp: Date.now() / 1000,
      });
    } catch (err) {
      console.error('Failed to add breadcrumb:', err);
    }
  }
}

/**
 * Wrap a function with error tracking
 */
export function withErrorTracking<T>(
  fn: () => Promise<T>,
  context?: ErrorContext
): Promise<T> {
  return fn().catch((error) => {
    trackError(error, context);
    throw error;
  });
}

