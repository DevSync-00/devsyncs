/**
 * TLS/SSL verification utilities.
 * 
 * Provides secure communication verification and certificate validation.
 */

import * as https from 'https';
import { URL } from 'url';

/**
 * TLS verification options
 */
export interface TlsVerificationOptions {
  /**
   * Whether to reject unauthorized certificates
   * Default: true
   */
  rejectUnauthorized?: boolean;

  /**
   * Custom certificate authority
   */
  ca?: Buffer | string | Array<Buffer | string>;

  /**
   * Client certificate
   */
  cert?: Buffer | string;

  /**
   * Client private key
   */
  key?: Buffer | string;

  /**
   * Minimum TLS version
   * Default: 'TLSv1.2'
   */
  minVersion?: string;

  /**
   * Maximum TLS version
   */
  maxVersion?: string;
}

/**
 * TLS verification result
 */
export interface TlsVerificationResult {
  valid: boolean;
  error?: string;
  certificate?: {
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    fingerprint: string;
  };
}

/**
 * TLS verification service
 */
export class TlsVerification {
  /**
   * Verify TLS connection to a URL
   * 
   * @param url - URL to verify
   * @param options - TLS verification options
   * @returns Verification result
   * 
   * @example
   * ```typescript
   * const verifier = new TlsVerification();
   * const result = await verifier.verify('https://api.example.com');
   * if (!result.valid) {
   *   console.error('TLS verification failed:', result.error);
   * }
   * ```
   */
  async verify(
    url: string,
    options: TlsVerificationOptions = {}
  ): Promise<TlsVerificationResult> {
    try {
      const parsedUrl = new URL(url);

      if (parsedUrl.protocol !== 'https:') {
        return {
          valid: false,
          error: 'URL must use HTTPS protocol',
        };
      }

      return await this.verifyHttps(parsedUrl, options);
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid URL',
      };
    }
  }

  /**
   * Verify HTTPS connection
   */
  private async verifyHttps(
    url: URL,
    options: TlsVerificationOptions
  ): Promise<TlsVerificationResult> {
    return new Promise((resolve) => {
      const tlsOptions: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'HEAD',
        rejectUnauthorized: options.rejectUnauthorized ?? true,
        ca: options.ca,
        cert: options.cert,
        key: options.key,
        minVersion: (options.minVersion || 'TLSv1.2') as any,
        maxVersion: options.maxVersion as any,
      };

      const req = https.request(tlsOptions, (res) => {
        const socket = res.socket as any;
        const cert = socket.getPeerCertificate();

        if (cert && Object.keys(cert).length > 0) {
          resolve({
            valid: true,
            certificate: {
              subject: cert.subject?.CN || cert.subject?.toString() || 'Unknown',
              issuer: cert.issuer?.CN || cert.issuer?.toString() || 'Unknown',
              validFrom: cert.valid_from || 'Unknown',
              validTo: cert.valid_to || 'Unknown',
              fingerprint: cert.fingerprint || 'Unknown',
            },
          });
        } else {
          resolve({
            valid: true,
          });
        }

        res.destroy();
      });

      req.on('error', (error) => {
        resolve({
          valid: false,
          error: error.message,
        });
      });

      req.setTimeout(5000, () => {
        req.destroy();
        resolve({
          valid: false,
          error: 'TLS verification timeout',
        });
      });

      req.end();
    });
  }

  /**
   * Create secure HTTPS agent with verification
   * 
   * @param options - TLS verification options
   * @returns Configured HTTPS agent
   */
  createSecureAgent(options: TlsVerificationOptions = {}): https.Agent {
    return new https.Agent({
      rejectUnauthorized: options.rejectUnauthorized ?? true,
      ca: options.ca,
      cert: options.cert,
      key: options.key,
      minVersion: (options.minVersion || 'TLSv1.2') as any,
      maxVersion: options.maxVersion as any,
    });
  }

  /**
   * Check if URL uses secure protocol
   * 
   * @param url - URL to check
   * @returns True if URL uses HTTPS
   */
  isSecure(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Warn if URL is not secure
   * 
   * @param url - URL to check
   * @returns Warning message if not secure, null otherwise
   */
  checkSecurity(url: string): string | null {
    if (!this.isSecure(url)) {
      return `Warning: URL ${url} does not use HTTPS. Data transmission may not be secure.`;
    }
    return null;
  }
}

/**
 * Default TLS verification instance
 */
export const defaultTlsVerification = new TlsVerification();

