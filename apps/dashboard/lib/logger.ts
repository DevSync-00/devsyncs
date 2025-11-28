/**
 * Structured logging utilities
 * Provides consistent logging across the application
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
}

class Logger {
  private minLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  /**
   * Format log entry
   */
  private formatEntry(entry: LogEntry): string {
    const { level, message, timestamp, context, error } = entry;
    
    const parts = [
      `[${timestamp}]`,
      `[${level.toUpperCase()}]`,
      message,
    ];

    if (context && Object.keys(context).length > 0) {
      parts.push(JSON.stringify(context));
    }

    if (error) {
      parts.push(`\nError: ${error.message}`);
      if (error.stack) {
        parts.push(`\nStack: ${error.stack}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Log an entry
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    };

    const formatted = this.formatEntry(entry);

    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }

    // In production, you might want to send logs to a logging service
    // e.g., LogRocket, Datadog, CloudWatch, etc.
  }

  /**
   * Debug log
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  /**
   * Info log
   */
  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  /**
   * Warning log
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  /**
   * Error log
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log('error', message, context, error);
  }

  /**
   * Log API request
   */
  apiRequest(method: string, path: string, statusCode: number, duration: number, context?: Record<string, any>): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `${method} ${path} ${statusCode} (${duration}ms)`, context);
  }

  /**
   * Log database query
   */
  dbQuery(operation: string, duration: number, context?: Record<string, any>): void {
    const level = duration > 1000 ? 'warn' : 'info';
    this.log(level, `DB ${operation} (${duration}ms)`, context);
  }
}

// Singleton instance
export const logger = new Logger();

/**
 * Create a scoped logger with default context
 */
export function createScopedLogger(defaultContext: Record<string, any>) {
  return {
    debug: (message: string, context?: Record<string, any>) => {
      logger.debug(message, { ...defaultContext, ...context });
    },
    info: (message: string, context?: Record<string, any>) => {
      logger.info(message, { ...defaultContext, ...context });
    },
    warn: (message: string, context?: Record<string, any>) => {
      logger.warn(message, { ...defaultContext, ...context });
    },
    error: (message: string, error?: Error, context?: Record<string, any>) => {
      logger.error(message, error, { ...defaultContext, ...context });
    },
  };
}

