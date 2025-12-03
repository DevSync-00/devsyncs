import * as vscode from 'vscode';
import { DevSyncError, ErrorCode } from './base';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Error log entry
 */
export interface ErrorLogEntry {
  timestamp: Date;
  error: DevSyncError;
  severity: ErrorSeverity;
  context?: Record<string, unknown>;
  stack?: string;
}

/**
 * Centralized error logging service
 */
export class ErrorLogger {
  private outputChannel: vscode.OutputChannel;
  private logEntries: ErrorLogEntry[] = [];
  private maxLogEntries: number = 1000;

  constructor(outputChannelName: string = 'DevSync Errors') {
    this.outputChannel = vscode.window.createOutputChannel(outputChannelName);
  }

  /**
   * Log an error
   */
  logError(
    error: DevSyncError,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    context?: Record<string, unknown>
  ): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date(),
      error,
      severity,
      context: { ...error.context, ...context },
      stack: error.stack,
    };

    // Add to in-memory log
    this.logEntries.push(entry);
    if (this.logEntries.length > this.maxLogEntries) {
      this.logEntries.shift(); // Remove oldest entry
    }

    // Write to output channel
    this.writeToOutput(entry);

    // Show notification for critical errors
    if (severity === ErrorSeverity.CRITICAL) {
      this.showCriticalError(error);
    }
  }

  /**
   * Log a warning
   */
  logWarning(error: DevSyncError, context?: Record<string, unknown>): void {
    this.logError(error, ErrorSeverity.WARNING, context);
  }

  /**
   * Log an info message
   */
  logInfo(error: DevSyncError, context?: Record<string, unknown>): void {
    this.logError(error, ErrorSeverity.INFO, context);
  }

  /**
   * Write error to output channel
   */
  private writeToOutput(entry: ErrorLogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const severity = entry.severity.toUpperCase();
    const logMessage = entry.error.getLogMessage();

    this.outputChannel.appendLine(`[${timestamp}] [${severity}] ${logMessage}`);

    if (entry.stack) {
      this.outputChannel.appendLine('Stack trace:');
      this.outputChannel.appendLine(entry.stack);
    }

    if (entry.context && Object.keys(entry.context).length > 0) {
      this.outputChannel.appendLine(`Context: ${JSON.stringify(entry.context, null, 2)}`);
    }

    this.outputChannel.appendLine('---');
  }

  /**
   * Show critical error notification
   */
  private showCriticalError(error: DevSyncError): void {
    const message = error.getUserMessage();
    const actions = ['View Details', 'Dismiss'];

    if (error.isRecoverable() && error.recoveryAction) {
      actions.unshift('Retry');
    }

    vscode.window.showErrorMessage(message, ...actions).then((selection) => {
      if (selection === 'View Details') {
        this.outputChannel.show(true);
      } else if (selection === 'Retry' && error.isRecoverable()) {
        // Retry logic would be handled by the caller
        // This is just a notification mechanism
      }
    });
  }

  /**
   * Get recent error logs
   */
  getRecentLogs(count: number = 10): ErrorLogEntry[] {
    return this.logEntries.slice(-count).reverse();
  }

  /**
   * Get errors by code
   */
  getErrorsByCode(code: ErrorCode): ErrorLogEntry[] {
    return this.logEntries.filter((entry) => entry.error.code === code);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logEntries = [];
    this.outputChannel.clear();
  }

  /**
   * Show output channel
   */
  show(): void {
    this.outputChannel.show(true);
  }

  /**
   * Dispose the logger
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}

