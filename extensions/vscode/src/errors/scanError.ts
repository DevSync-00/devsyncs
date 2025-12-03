import { DevSyncError, ErrorCode } from './base';

/**
 * Error thrown during scan operations
 */
export class ScanError extends DevSyncError {
  constructor(
    message: string,
    userMessage: string = 'Failed to scan schema. Please check your configuration and try again.',
    recoveryAction?: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(message, ErrorCode.SCAN_FAILED, userMessage, recoveryAction, originalError, context);
    this.name = 'ScanError';
  }

  static fromError(error: Error, context?: Record<string, unknown>): ScanError {
    // Determine recovery action based on error type
    let recoveryAction: string | undefined;
    let userMessage = 'Failed to scan schema.';

    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return new ScanError(
        error.message,
        'Scan operation timed out. The operation took too long to complete.',
        'Try scanning a smaller portion of your codebase or check your network connection.',
        error,
        { ...context, timeout: true }
      );
    }

    if (error.message.includes('ECONNREFUSED') || error.message.includes('network')) {
      return new ScanError(
        error.message,
        'Cannot connect to the DevSync API.',
        'Check that the API server is running and verify your devsync.apiUrl setting.',
        error,
        { ...context, network: true }
      );
    }

    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      return new ScanError(
        error.message,
        'Authentication failed. Your API key may be invalid or expired.',
        'Update your devsync.apiKey in settings or sign in again.',
        error,
        { ...context, auth: true }
      );
    }

    if (error.message.includes('404') || error.message.includes('not found')) {
      return new ScanError(
        error.message,
        'Project or resource not found.',
        'Verify your devsync.projectId setting matches your project.',
        error,
        { ...context, notFound: true }
      );
    }

    return new ScanError(
      error.message,
      userMessage,
      recoveryAction,
      error,
      context
    );
  }

  static timeout(context?: Record<string, unknown>): ScanError {
    return new ScanError(
      'Scan operation timed out',
      'The scan operation took too long and was cancelled.',
      'Try scanning a smaller portion of your codebase or increase the timeout setting.',
      undefined,
      { ...context, timeout: true }
    );
  }

  static invalidConfig(missingFields: string[], context?: Record<string, unknown>): ScanError {
    return new ScanError(
      `Invalid configuration: missing ${missingFields.join(', ')}`,
      'DevSync is not properly configured.',
      `Please configure: ${missingFields.join(', ')} in your VS Code settings.`,
      undefined,
      { ...context, missingFields }
    );
  }

  static noWorkspace(): ScanError {
    return new ScanError(
      'No workspace folder open',
      'No workspace folder is currently open.',
      'Open a workspace folder and try again.',
      undefined,
      { workspace: false }
    );
  }
}

