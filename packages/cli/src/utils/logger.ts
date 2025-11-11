/**
 * Enhanced logging utilities with levels and formatting
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`⚠️  ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`❌ ${message}`, ...args);
    }
  }

  success(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`✅ ${message}`, ...args);
    }
  }
}

export const logger = new Logger();

// Set log level from environment
if (process.env.DEBUG) {
  logger.setLevel(LogLevel.DEBUG);
} else if (process.env.VERBOSE) {
  logger.setLevel(LogLevel.DEBUG);
} else if (process.env.QUIET) {
  logger.setLevel(LogLevel.WARN);
}

