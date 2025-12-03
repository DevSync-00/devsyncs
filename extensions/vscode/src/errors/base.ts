/**
 * Base error class for all DevSync errors
 */
export class DevSyncError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage: string,
    public readonly recoveryAction?: string,
    public readonly originalError?: Error,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DevSyncError';
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DevSyncError);
    }
  }

  /**
   * Get a formatted error message for logging
   */
  getLogMessage(): string {
    let logMessage = `[${this.code}] ${this.message}`;
    if (this.context) {
      logMessage += ` | Context: ${JSON.stringify(this.context)}`;
    }
    if (this.originalError) {
      logMessage += ` | Original: ${this.originalError.message}`;
    }
    return logMessage;
  }

  /**
   * Get user-friendly error message with recovery action
   */
  getUserMessage(): string {
    let message = this.userMessage;
    if (this.recoveryAction) {
      message += `\n\n💡 ${this.recoveryAction}`;
    }
    return message;
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    return this.recoveryAction !== undefined;
  }
}

/**
 * Error codes for different error types
 */
export enum ErrorCode {
  // Scan errors
  SCAN_FAILED = 'SCAN_FAILED',
  SCAN_TIMEOUT = 'SCAN_TIMEOUT',
  SCAN_INVALID_CONFIG = 'SCAN_INVALID_CONFIG',
  SCAN_NO_WORKSPACE = 'SCAN_NO_WORKSPACE',
  
  // Migration errors
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  MIGRATION_INVALID = 'MIGRATION_INVALID',
  MIGRATION_NO_SCAN = 'MIGRATION_NO_SCAN',
  MIGRATION_DB_ERROR = 'MIGRATION_DB_ERROR',
  
  // Auth errors
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
  AUTH_NETWORK_ERROR = 'AUTH_NETWORK_ERROR',
  
  // API errors
  API_NETWORK_ERROR = 'API_NETWORK_ERROR',
  API_UNAUTHORIZED = 'API_UNAUTHORIZED',
  API_NOT_FOUND = 'API_NOT_FOUND',
  API_SERVER_ERROR = 'API_SERVER_ERROR',
  API_TIMEOUT = 'API_TIMEOUT',
  
  // CLI errors
  CLI_NOT_FOUND = 'CLI_NOT_FOUND',
  CLI_EXECUTION_FAILED = 'CLI_EXECUTION_FAILED',
  CLI_BUILD_FAILED = 'CLI_BUILD_FAILED',
  
  // Configuration errors
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_MISSING = 'CONFIG_MISSING',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

