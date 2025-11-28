/**
 * Error handling utilities for better UX
 * Provides user-friendly error messages with actionable guidance
 */

export interface ErrorContext {
  operation?: string;
  resource?: string;
  details?: Record<string, any>;
}

/**
 * Format error message to be user-friendly and actionable
 */
export function formatErrorMessage(error: unknown, context?: ErrorContext): {
  title: string;
  message: string;
  actionable?: string;
} {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const operation = context?.operation || 'operation';
  const resource = context?.resource || 'resource';

  // Network errors
  if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server.',
      actionable: 'Please check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.',
    };
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
    return {
      title: 'Request Timeout',
      message: 'The request took too long to complete.',
      actionable: 'Please try again. If the problem continues, the server may be experiencing high load.',
    };
  }

  // Authentication errors
  if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('authentication')) {
    return {
      title: 'Authentication Required',
      message: 'Your session has expired.',
      actionable: 'Please sign in again to continue.',
    };
  }

  // Authorization errors
  if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('permission')) {
    return {
      title: 'Access Denied',
      message: `You don't have permission to ${operation} this ${resource}.`,
      actionable: 'If you believe this is an error, please contact your team administrator.',
    };
  }

  // Not found errors
  if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
    return {
      title: 'Not Found',
      message: `The ${resource} you're looking for doesn't exist or has been deleted.`,
      actionable: 'Please check the URL or try refreshing the page.',
    };
  }

  // Validation errors
  if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('400')) {
    return {
      title: 'Invalid Input',
      message: errorMessage,
      actionable: 'Please check your input and try again.',
    };
  }

  // Database errors
  if (errorMessage.includes('database') || errorMessage.includes('SQL') || errorMessage.includes('constraint')) {
    return {
      title: 'Database Error',
      message: 'An error occurred while saving data.',
      actionable: 'Please try again. If the problem persists, contact support.',
    };
  }

  // Rate limiting
  if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
    return {
      title: 'Too Many Requests',
      message: 'You\'ve made too many requests. Please wait a moment.',
      actionable: 'Please wait a few seconds before trying again.',
    };
  }

  // Server errors
  if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
    return {
      title: 'Server Error',
      message: 'Something went wrong on our end.',
      actionable: 'Please try again in a moment. If the problem persists, contact support.',
    };
  }

  // Generic error
  return {
    title: 'Error',
    message: errorMessage || 'An unexpected error occurred.',
    actionable: 'Please try again. If the problem persists, contact support.',
  };
}

/**
 * Get error message string for simple use cases
 */
export function getErrorMessage(error: unknown, context?: ErrorContext): string {
  const formatted = formatErrorMessage(error, context);
  return formatted.actionable 
    ? `${formatted.message} ${formatted.actionable}`
    : formatted.message;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Network errors are retryable
  if (errorMessage.includes('fetch') || errorMessage.includes('network') || 
      errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
    return true;
  }
  
  // Server errors (5xx) are retryable
  if (errorMessage.includes('500') || errorMessage.includes('502') || 
      errorMessage.includes('503') || errorMessage.includes('504')) {
    return true;
  }
  
  // Rate limiting is retryable
  if (errorMessage.includes('429')) {
    return true;
  }
  
  // Client errors (4xx except 429) are not retryable
  if (errorMessage.includes('400') || errorMessage.includes('401') || 
      errorMessage.includes('403') || errorMessage.includes('404')) {
    return false;
  }
  
  // Unknown errors - assume not retryable
  return false;
}

