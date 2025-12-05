/**
 * Log sanitization service.
 * 
 * Removes sensitive information from log messages before they are written
 * to console, files, or other logging destinations.
 */

/**
 * Patterns to detect and mask sensitive data
 */
const SENSITIVE_PATTERNS: Array<{
  pattern: RegExp;
  replacement: string;
  description: string;
}> = [
  // Connection strings
  {
    pattern: /(postgresql|postgres|mysql|mongodb|redis|sqlite):\/\/[^@]+@[^\s"']+/gi,
    replacement: '[CONNECTION_STRING]',
    description: 'Database connection strings',
  },
  // API keys (various formats)
  {
    pattern: /(api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    replacement: '$1: [API_KEY]',
    description: 'API keys',
  },
  // JWT tokens
  {
    pattern: /(bearer\s+)?eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/gi,
    replacement: '[JWT_TOKEN]',
    description: 'JWT tokens',
  },
  // Passwords
  {
    pattern: /(password|pwd|pass)\s*[:=]\s*['"]?([^\s"']{3,})['"]?/gi,
    replacement: '$1: [PASSWORD]',
    description: 'Passwords',
  },
  // Access tokens
  {
    pattern: /(access[_-]?token|token)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    replacement: '$1: [ACCESS_TOKEN]',
    description: 'Access tokens',
  },
  // Secret keys
  {
    pattern: /(secret[_-]?key|secret)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    replacement: '$1: [SECRET_KEY]',
    description: 'Secret keys',
  },
  // Email addresses (optional - can be configured)
  {
    pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    replacement: '[EMAIL]',
    description: 'Email addresses',
  },
  // Credit card numbers
  {
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    replacement: '[CARD_NUMBER]',
    description: 'Credit card numbers',
  },
  // Social security numbers (US format)
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN]',
    description: 'Social security numbers',
  },
];

/**
 * Log sanitization options
 */
export interface LogSanitizerOptions {
  /**
   * Whether to mask email addresses
   * Default: false
   */
  maskEmails?: boolean;

  /**
   * Whether to mask IP addresses
   * Default: false
   */
  maskIpAddresses?: boolean;

  /**
   * Custom patterns to add
   */
  customPatterns?: Array<{
    pattern: RegExp;
    replacement: string;
    description: string;
  }>;

  /**
   * Patterns to exclude (by description)
   */
  excludePatterns?: string[];
}

/**
 * Log sanitizer service
 */
export class LogSanitizer {
  private patterns: Array<{
    pattern: RegExp;
    replacement: string;
    description: string;
  }>;

  constructor(options: LogSanitizerOptions = {}) {
    this.patterns = [...SENSITIVE_PATTERNS];

    // Add IP address pattern if enabled
    if (options.maskIpAddresses) {
      this.patterns.push({
        pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        replacement: '[IP_ADDRESS]',
        description: 'IP addresses',
      });
    }

    // Remove email pattern if disabled
    if (!options.maskEmails) {
      this.patterns = this.patterns.filter((p) => p.description !== 'Email addresses');
    }

    // Add custom patterns
    if (options.customPatterns) {
      this.patterns.push(...options.customPatterns);
    }

    // Exclude specified patterns
    if (options.excludePatterns) {
      this.patterns = this.patterns.filter(
        (p) => !options.excludePatterns!.includes(p.description)
      );
    }
  }

  /**
   * Sanitize a log message
   * 
   * @param message - Log message to sanitize
   * @returns Sanitized message
   * 
   * @example
   * ```typescript
   * const sanitizer = new LogSanitizer();
   * const safe = sanitizer.sanitize('Connecting to postgresql://user:pass@host/db');
   * // Returns: 'Connecting to [CONNECTION_STRING]'
   * ```
   */
  sanitize(message: string): string {
    if (!message || typeof message !== 'string') {
      return String(message);
    }

    let sanitized = message;

    // Apply each pattern
    for (const { pattern, replacement } of this.patterns) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    return sanitized;
  }

  /**
   * Sanitize an object (recursively)
   * 
   * @param obj - Object to sanitize
   * @param maxDepth - Maximum recursion depth (default: 10)
   * @returns Sanitized object
   */
  sanitizeObject(obj: unknown, maxDepth: number = 10): unknown {
    if (maxDepth <= 0) {
      return '[MAX_DEPTH_REACHED]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitize(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item, maxDepth - 1));
    }

    if (typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize key as well
        const sanitizedKey = this.sanitize(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value, maxDepth - 1);
      }
      return sanitized;
    }

    return String(obj);
  }

  /**
   * Sanitize error object
   * 
   * @param error - Error object to sanitize
   * @returns Sanitized error information
   */
  sanitizeError(error: unknown): {
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  } {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: this.sanitize(error.message),
        stack: error.stack ? this.sanitize(error.stack) : undefined,
        cause: (error as { cause?: unknown }).cause ? this.sanitizeObject((error as { cause?: unknown }).cause) : undefined,
      };
    }

    return {
      name: 'Unknown',
      message: this.sanitize(String(error)),
    };
  }
}

/**
 * Default log sanitizer instance
 */
export const defaultLogSanitizer = new LogSanitizer({
  maskEmails: false,
  maskIpAddresses: false,
});

