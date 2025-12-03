import { DevSyncError, ErrorCode } from './base';

/**
 * Error thrown during migration operations
 */
export class MigrationError extends DevSyncError {
  constructor(
    message: string,
    userMessage: string = 'Failed to generate migration. Please check your configuration and try again.',
    recoveryAction?: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(message, ErrorCode.MIGRATION_FAILED, userMessage, recoveryAction, originalError, context);
    this.name = 'MigrationError';
  }

  static fromError(error: Error, context?: Record<string, unknown>): MigrationError {
    let recoveryAction: string | undefined;
    let userMessage = 'Failed to generate migration.';

    if (error.message.includes('database') || error.message.includes('connection')) {
      return new MigrationError(
        error.message,
        'Cannot connect to the database.',
        'Verify your database connection string in devsync.databaseConnection or .devsync/config.json.',
        error,
        { ...context, dbConnection: true }
      );
    }

    if (error.message.includes('SQL') || error.message.includes('syntax')) {
      return new MigrationError(
        error.message,
        'Invalid SQL syntax in migration.',
        'Review the migration SQL and fix any syntax errors before applying.',
        error,
        { ...context, sqlError: true }
      );
    }

    if (error.message.includes('permission') || error.message.includes('access denied')) {
      return new MigrationError(
        error.message,
        'Database permission denied.',
        'Ensure your database user has the necessary permissions to create tables and modify schema.',
        error,
        { ...context, permission: true }
      );
    }

    return new MigrationError(
      error.message,
      userMessage,
      recoveryAction,
      error,
      context
    );
  }

  static noScanReport(): MigrationError {
    return new MigrationError(
      'No scan report found',
      'No scan report is available. You need to run a scan first.',
      'Run a scan operation to detect schema mismatches, then try generating a migration again.',
      undefined,
      { noScan: true }
    );
  }

  static invalidMigration(reason: string, context?: Record<string, unknown>): MigrationError {
    return new MigrationError(
      `Invalid migration: ${reason}`,
      'The generated migration is invalid.',
      'Review the scan results and ensure all mismatches are valid before generating a migration.',
      undefined,
      { ...context, invalid: true, reason }
    );
  }

  static dbError(operation: string, originalError: Error, context?: Record<string, unknown>): MigrationError {
    return new MigrationError(
      `Database error during ${operation}: ${originalError.message}`,
      `Failed to execute database operation: ${operation}.`,
      'Check your database connection and ensure the database is accessible. Review the error details for more information.',
      originalError,
      { ...context, operation, dbError: true }
    );
  }
}

