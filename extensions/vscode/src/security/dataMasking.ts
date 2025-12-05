/**
 * Data masking service for UI display.
 * 
 * Masks sensitive data when displaying it in the UI to prevent accidental
 * exposure of credentials, tokens, or other sensitive information.
 */

/**
 * Masking options
 */
export interface MaskingOptions {
  /**
   * Number of characters to show at the start
   * Default: 4
   */
  prefixLength?: number;

  /**
   * Number of characters to show at the end
   * Default: 4
   */
  suffixLength?: number;

  /**
   * Character to use for masking
   * Default: '*'
   */
  maskChar?: string;

  /**
   * Minimum length to apply masking
   * Default: 8
   */
  minLength?: number;
}

/**
 * Data masking service
 */
export class DataMasking {
  private defaultOptions: Required<MaskingOptions> = {
    prefixLength: 4,
    suffixLength: 4,
    maskChar: '*',
    minLength: 8,
  };

  /**
   * Mask a string value
   * 
   * @param value - Value to mask
   * @param options - Masking options
   * @returns Masked value
   * 
   * @example
   * const masking = new DataMasking();
   * masking.mask('sk-1234567890abcdef'); // Returns masked value
   */
  mask(value: string, options: MaskingOptions = {}): string {
    if (!value || typeof value !== 'string') {
      return value;
    }

    const opts = { ...this.defaultOptions, ...options };

    // Don't mask short values
    if (value.length < opts.minLength) {
      return opts.maskChar.repeat(value.length);
    }

    // Don't mask if value is too short to show prefix and suffix
    if (value.length <= opts.prefixLength + opts.suffixLength) {
      return opts.maskChar.repeat(value.length);
    }

    const prefix = value.substring(0, opts.prefixLength);
    const suffix = value.substring(value.length - opts.suffixLength);
    const maskedLength = value.length - opts.prefixLength - opts.suffixLength;
    const masked = opts.maskChar.repeat(maskedLength);

    return `${prefix}${masked}${suffix}`;
  }

  /**
   * Mask an email address
   * 
   * @param email - Email address to mask
   * @returns Masked email
   * 
   * @example
   * masking.maskEmail('user@example.com'); // Returns masked email
   */
  maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
      return this.mask(email);
    }

    const [localPart, domain] = email.split('@');
    const maskedLocal = this.mask(localPart, { prefixLength: 1, suffixLength: 0 });
    const [domainName, ...tldParts] = domain.split('.');
    const maskedDomain = this.mask(domainName, { prefixLength: 1, suffixLength: 0 });
    const tld = tldParts.join('.');

    return `${maskedLocal}@${maskedDomain}.${tld}`;
  }

  /**
   * Mask a connection string
   * 
   * @param connectionString - Connection string to mask
   * @returns Masked connection string
   * 
   * @example
   * masking.maskConnectionString('postgresql://user:pass@host/db');
   * // Returns masked connection string
   */
  maskConnectionString(connectionString: string): string {
    if (!connectionString) {
      return connectionString;
    }

    try {
      // Try to parse as URL
      const url = new URL(connectionString);

      // Mask username
      if (url.username) {
        url.username = this.mask(url.username, { prefixLength: 1, suffixLength: 0 });
      }

      // Mask password
      if (url.password) {
        url.password = this.mask(url.password, { prefixLength: 1, suffixLength: 0 });
      }

      // Mask hostname (keep TLD visible)
      if (url.hostname) {
        const parts = url.hostname.split('.');
        if (parts.length > 1) {
          const domain = parts.slice(0, -1).join('.');
          const tld = parts[parts.length - 1];
          url.hostname = `${this.mask(domain, { prefixLength: 1, suffixLength: 0 })}.${tld}`;
        } else {
          url.hostname = this.mask(url.hostname, { prefixLength: 1, suffixLength: 0 });
        }
      }

      return url.toString();
    } catch {
      // If parsing fails, just mask the whole string
      return this.mask(connectionString, { prefixLength: 4, suffixLength: 4 });
    }
  }

  /**
   * Mask an API key
   * 
   * @param apiKey - API key to mask
   * @returns Masked API key
   */
  maskApiKey(apiKey: string): string {
    if (!apiKey) {
      return apiKey;
    }

    // Common API key prefixes
    const prefixes = ['sk-', 'pk-', 'ak-', 'api-', 'key-'];
    for (const prefix of prefixes) {
      if (apiKey.startsWith(prefix)) {
        const keyPart = apiKey.substring(prefix.length);
        return `${prefix}${this.mask(keyPart, { prefixLength: 4, suffixLength: 4 })}`;
      }
    }

    return this.mask(apiKey, { prefixLength: 4, suffixLength: 4 });
  }

  /**
   * Mask a token (JWT, access token, etc.)
   * 
   * @param token - Token to mask
   * @returns Masked token
   */
  maskToken(token: string): string {
    if (!token) {
      return token;
    }

    // JWT tokens have 3 parts separated by dots
    if (token.includes('.') && token.split('.').length === 3) {
      const parts = token.split('.');
      const masked0 = this.mask(parts[0], { prefixLength: 4, suffixLength: 0 });
      const masked1 = this.mask(parts[1], { prefixLength: 0, suffixLength: 0 });
      const masked2 = this.mask(parts[2], { prefixLength: 0, suffixLength: 4 });
      return masked0 + '.' + masked1 + '.' + masked2;
    }

    return this.mask(token, { prefixLength: 4, suffixLength: 4 });
  }

  /**
   * Mask a credit card number
   * 
   * @param cardNumber - Card number to mask
   * @returns Masked card number
   */
  maskCardNumber(cardNumber: string): string {
    if (!cardNumber) {
      return cardNumber;
    }

    // Remove spaces and dashes
    const cleaned = cardNumber.replace(/[\s-]/g, '');

    if (cleaned.length < 4) {
      return this.mask(cleaned);
    }

    // Show last 4 digits
    const last4 = cleaned.substring(cleaned.length - 4);
    return `****-****-****-${last4}`;
  }

  /**
   * Check if a value looks like sensitive data
   * 
   * @param value - Value to check
   * @returns True if value looks sensitive
   */
  looksSensitive(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }

    // Check for common sensitive patterns
    const sensitivePatterns = [
      /^sk-[a-zA-Z0-9]+$/i, // API keys
      /^pk-[a-zA-Z0-9]+$/i, // Public keys
      /^eyJ[A-Za-z0-9_-]+\./i, // JWT tokens
      /^[a-zA-Z0-9_-]{20,}$/, // Long tokens
      /^postgresql:\/\//i, // Connection strings
      /^mysql:\/\//i,
      /^mongodb:\/\//i,
      /@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // Email-like
    ];

    return sensitivePatterns.some((pattern) => pattern.test(value));
  }
}

/**
 * Default data masking instance
 */
export const defaultDataMasking = new DataMasking();

