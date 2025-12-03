import * as vscode from 'vscode';
import { DevSyncError, toDevSyncError, ErrorCode } from './index';
import { ErrorLogger, ErrorSeverity } from './logger';
import { ErrorRecovery } from './recovery';

/**
 * Error boundary for catching and handling errors in async operations
 */
export class ErrorBoundary {
  private logger: ErrorLogger;

  constructor(logger: ErrorLogger) {
    this.logger = logger;
  }

  /**
   * Wrap an async function with error handling
   */
  async wrap<T>(
    operation: () => Promise<T>,
    context?: Record<string, unknown>,
    showUserNotification: boolean = true
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      return this.handleError(error, context, showUserNotification);
    }
  }

  /**
   * Wrap a sync function with error handling
   */
  wrapSync<T>(
    operation: () => T,
    context?: Record<string, unknown>,
    showUserNotification: boolean = true
  ): T | undefined {
    try {
      return operation();
    } catch (error) {
      this.handleError(error, context, showUserNotification);
      return undefined;
    }
  }

  /**
   * Handle an error
   */
  private async handleError(
    error: unknown,
    context?: Record<string, unknown>,
    showUserNotification: boolean = true
  ): Promise<undefined> {
    const devSyncError = toDevSyncError(error, ErrorCode.UNKNOWN_ERROR);

    // Log the error
    this.logger.logError(devSyncError, ErrorSeverity.ERROR, context);

    // Show user notification if requested
    if (showUserNotification) {
      await this.showErrorToUser(devSyncError);
    }

    return undefined;
  }

  /**
   * Show error to user with recovery options
   */
  private async showErrorToUser(error: DevSyncError): Promise<void> {
    const message = error.getUserMessage();
    const actions: string[] = ['View Details'];

    // Add retry option if error is recoverable
    if (error.isRecoverable()) {
      actions.unshift('Retry');
    }

    const selection = await vscode.window.showErrorMessage(message, ...actions);

    if (selection === 'View Details') {
      this.logger.show();
    } else if (selection === 'Retry' && error.isRecoverable()) {
      // Attempt recovery
      const recovery = await ErrorRecovery.recover(error);
      if (recovery.retry) {
        await recovery.retry();
      }
    }
  }
}

/**
 * Decorator for async methods to automatically handle errors
 */
export function handleErrors(
  context?: Record<string, unknown>,
  showUserNotification: boolean = true
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const logger = new ErrorLogger(); // In real implementation, get from DI

    descriptor.value = async function (...args: any[]) {
      const boundary = new ErrorBoundary(logger);
      return boundary.wrap(
        () => originalMethod.apply(this, args),
        { ...context, method: propertyKey, class: target.constructor.name },
        showUserNotification
      );
    };

    return descriptor;
  };
}

