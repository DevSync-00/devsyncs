/**
 * Enhanced error handling utilities
 */

export interface ErrorDetails {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, any>;
  timestamp: string;
}

export class AppError extends Error {
  public code: string;
  public statusCode: number;
  public details?: Record<string, any>;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'DATABASE_ERROR', 500, details);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND_ERROR', 404);
    this.name = 'NotFoundError';
  }
}

export function formatError(error: unknown): ErrorDetails {
  if (error instanceof AppError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      timestamp: new Date().toISOString(),
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
    timestamp: new Date().toISOString(),
  };
}

export function logError(error: unknown, context?: Record<string, any>): void {
  const errorDetails = formatError(error);
  
  const logData = {
    ...errorDetails,
    context,
    stack: error instanceof Error ? error.stack : undefined,
  };

  // Log to console with proper formatting
  console.error('[ERROR]', JSON.stringify(logData, null, 2));
  
  // In production, you would send this to an error tracking service
  // e.g., Sentry, LogRocket, etc.
}

export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorMessage: string = 'An error occurred'
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(error);
    throw error instanceof AppError ? error : new AppError(errorMessage);
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    // Don't retry client errors (4xx)
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return false;
    }
    // Retry server errors (5xx) and network errors
    return error.statusCode >= 500;
  }
  
  // Retry unknown errors (might be network issues)
  return true;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }
      
      // Exponential backoff
      const backoffDelay = delay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  throw lastError;
}

