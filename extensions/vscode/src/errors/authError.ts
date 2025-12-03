import { DevSyncError, ErrorCode } from './base';

/**
 * Error thrown during authentication operations
 */
export class AuthError extends DevSyncError {
  constructor(
    message: string,
    userMessage: string = 'Authentication failed. Please try signing in again.',
    recoveryAction?: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(message, ErrorCode.AUTH_FAILED, userMessage, recoveryAction, originalError, context);
    this.name = 'AuthError';
  }

  static fromError(error: Error, context?: Record<string, unknown>): AuthError {
    let recoveryAction: string | undefined;
    let userMessage = 'Authentication failed.';

    if (error.message.includes('expired') || error.message.includes('token')) {
      return new AuthError(
        error.message,
        'Your authentication token has expired.',
        'Please sign in again using the DevSync: Sign In command.',
        error,
        { ...context, expired: true }
      );
    }

    if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
      return new AuthError(
        error.message,
        'Cannot connect to the authentication server.',
        'Check your internet connection and verify the devsync.analyzerUrl setting.',
        error,
        { ...context, network: true }
      );
    }

    if (error.message.includes('timeout')) {
      return new AuthError(
        error.message,
        'Authentication request timed out.',
        'Check your network connection and try again. If the problem persists, verify the devsync.analyzerUrl setting.',
        error,
        { ...context, timeout: true }
      );
    }

    if (error.message.includes('denied') || error.message.includes('access denied')) {
      return new AuthError(
        error.message,
        'Access denied. The authentication request was denied.',
        'Please restart the login flow and approve the request.',
        error,
        { ...context, denied: true }
      );
    }

    return new AuthError(
      error.message,
      userMessage,
      recoveryAction,
      error,
      context
    );
  }

  static expired(context?: Record<string, unknown>): AuthError {
    return new AuthError(
      'Authentication token expired',
      'Your session has expired.',
      'Please sign in again using the DevSync: Sign In command.',
      undefined,
      { ...context, expired: true }
    );
  }

  static invalidToken(context?: Record<string, unknown>): AuthError {
    return new AuthError(
      'Invalid authentication token',
      'Your authentication token is invalid.',
      'Please sign out and sign in again.',
      undefined,
      { ...context, invalidToken: true }
    );
  }

  static networkError(url: string, context?: Record<string, unknown>): AuthError {
    return new AuthError(
      `Cannot connect to authentication server at ${url}`,
      'Cannot connect to the authentication server.',
      `Check that the analyzer service is running at ${url} and verify your devsync.analyzerUrl setting.`,
      undefined,
      { ...context, url, network: true }
    );
  }
}

