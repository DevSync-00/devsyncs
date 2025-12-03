/**
 * Central export for all error classes
 */
export { DevSyncError, ErrorCode } from './base';
export { ScanError } from './scanError';
export { MigrationError } from './migrationError';
export { AuthError } from './authError';

import { DevSyncError, ErrorCode } from './base';

/**
 * Type guard to check if an error is a DevSyncError
 */
export function isDevSyncError(error: unknown): error is DevSyncError {
  return error instanceof DevSyncError;
}

/**
 * Convert any error to a DevSyncError
 */
export function toDevSyncError(error: unknown, defaultCode: ErrorCode = ErrorCode.UNKNOWN_ERROR): DevSyncError {
  if (isDevSyncError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new DevSyncError(
      error.message,
      defaultCode,
      'An unexpected error occurred.',
      'Please try again. If the problem persists, check the output panel for details.',
      error
    );
  }

  return new DevSyncError(
    String(error),
    defaultCode,
    'An unexpected error occurred.',
    'Please try again. If the problem persists, check the output panel for details.'
  );
}

