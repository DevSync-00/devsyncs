/**
 * Data protection integration module.
 * 
 * Integrates all data protection features including credential storage,
 * log sanitization, data masking, and TLS verification.
 */

import * as vscode from 'vscode';
import { CredentialStorage } from './credentialStorage';
import { LogSanitizer, LogSanitizerOptions } from './logSanitizer';
import { DataMasking } from './dataMasking';
import { TlsVerification, TlsVerificationOptions } from './tlsVerification';
import { EncryptionService } from './encryption';

/**
 * Data protection manager
 */
export class DataProtectionManager {
  public readonly credentialStorage: CredentialStorage;
  public readonly logSanitizer: LogSanitizer;
  public readonly dataMasking: DataMasking;
  public readonly tlsVerification: TlsVerification;

  constructor(
    context: vscode.ExtensionContext,
    encryptionService?: EncryptionService,
    logSanitizerOptions?: LogSanitizerOptions
  ) {
    // Initialize credential storage with encryption
    this.credentialStorage = new CredentialStorage(context, encryptionService);

    // Initialize log sanitizer
    this.logSanitizer = new LogSanitizer(logSanitizerOptions);

    // Initialize data masking
    this.dataMasking = new DataMasking();

    // Initialize TLS verification
    this.tlsVerification = new TlsVerification();

    // Set up secure console logging wrapper
    this.setupSecureLogging();
  }

  /**
   * Set up secure console logging that automatically sanitizes output
   */
  private setupSecureLogging(): void {
    // Wrap console methods to sanitize output
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    const originalDebug = console.debug;

    console.log = (...args: unknown[]) => {
      const sanitized = args.map((arg) => this.logSanitizer.sanitizeObject(arg));
      originalLog(...sanitized);
    };

    console.error = (...args: unknown[]) => {
      const sanitized = args.map((arg) => {
        if (arg instanceof Error) {
          return this.logSanitizer.sanitizeError(arg);
        }
        return this.logSanitizer.sanitizeObject(arg);
      });
      originalError(...sanitized);
    };

    console.warn = (...args: unknown[]) => {
      const sanitized = args.map((arg) => this.logSanitizer.sanitizeObject(arg));
      originalWarn(...sanitized);
    };

    console.info = (...args: unknown[]) => {
      const sanitized = args.map((arg) => this.logSanitizer.sanitizeObject(arg));
      originalInfo(...sanitized);
    };

    console.debug = (...args: unknown[]) => {
      const sanitized = args.map((arg) => this.logSanitizer.sanitizeObject(arg));
      originalDebug(...sanitized);
    };
  }

  /**
   * Store connection string securely
   */
  async storeConnectionString(connectionString: string): Promise<void> {
    // Verify TLS if it's a connection string
    if (connectionString.startsWith('http://')) {
      const warning = this.tlsVerification.checkSecurity(connectionString);
      if (warning) {
        console.warn(warning);
      }
    }

    await this.credentialStorage.storeConnectionString(connectionString);
  }

  /**
   * Get connection string (masked for display)
   */
  async getConnectionString(masked: boolean = false): Promise<string | null> {
    const connectionString = await this.credentialStorage.getConnectionString();
    if (!connectionString) {
      return null;
    }

    if (masked) {
      return this.dataMasking.maskConnectionString(connectionString);
    }

    return connectionString;
  }

  /**
   * Verify TLS connection before making requests
   */
  async verifyTls(url: string, options?: TlsVerificationOptions): Promise<boolean> {
    const result = await this.tlsVerification.verify(url, options);
    if (!result.valid) {
      console.error(`TLS verification failed for ${url}:`, result.error);
    }
    return result.valid;
  }
}

/**
 * Create and initialize data protection manager
 */
export async function createDataProtectionManager(
  context: vscode.ExtensionContext,
  encryptionService?: EncryptionService,
  logSanitizerOptions?: LogSanitizerOptions
): Promise<DataProtectionManager> {
  return new DataProtectionManager(context, encryptionService, logSanitizerOptions);
}

