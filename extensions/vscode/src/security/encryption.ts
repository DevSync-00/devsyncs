/**
 * Encryption service for sensitive data at rest.
 * 
 * Provides encryption/decryption capabilities for sensitive data stored in VS Code.
 * Uses AES-256-GCM encryption with a key derived from VS Code secrets API.
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';

/**
 * Encryption algorithm and configuration
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Encryption key storage key
 */
const ENCRYPTION_KEY_STORAGE_KEY = 'devsync.security.encryptionKey';

/**
 * Encrypted data structure
 */
interface EncryptedData {
  iv: string; // Initialization vector (base64)
  salt: string; // Salt for key derivation (base64)
  tag: string; // Authentication tag (base64)
  data: string; // Encrypted data (base64)
}

/**
 * Encryption service for sensitive data
 */
export class EncryptionService {
  private encryptionKey: Buffer | null = null;
  private keyDerivationPassword: string | null = null;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Initialize the encryption service
   */
  async initialize(): Promise<void> {
    await this.ensureEncryptionKey();
  }

  /**
   * Encrypt sensitive data
   * 
   * @param plaintext - The data to encrypt
   * @returns Encrypted data as base64 string
   * 
   * @example
   * ```typescript
   * const encrypted = await encryptionService.encrypt('sensitive-connection-string');
   * await context.secrets.store('db.connection', encrypted);
   * ```
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty string');
    }

    await this.ensureEncryptionKey();

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive encryption key from master key and salt
    const key = crypto.pbkdf2Sync(
      this.encryptionKey!,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      'sha256'
    );

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Create encrypted data structure
    const encryptedData: EncryptedData = {
      iv: iv.toString('base64'),
      salt: salt.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64'),
    };

    return JSON.stringify(encryptedData);
  }

  /**
   * Decrypt sensitive data
   * 
   * @param encryptedData - The encrypted data (base64 JSON string)
   * @returns Decrypted plaintext
   * 
   * @example
   * ```typescript
   * const encrypted = await context.secrets.get('db.connection');
   * if (encrypted) {
   *   const decrypted = await encryptionService.decrypt(encrypted);
   * }
   * ```
   */
  async decrypt(encryptedData: string): Promise<string> {
    if (!encryptedData) {
      throw new Error('Cannot decrypt empty string');
    }

    await this.ensureEncryptionKey();

    let data: EncryptedData;
    try {
      data = JSON.parse(encryptedData) as EncryptedData;
    } catch {
      throw new Error('Invalid encrypted data format');
    }

    // Validate structure
    if (!data.iv || !data.salt || !data.tag || !data.data) {
      throw new Error('Invalid encrypted data structure');
    }

    // Decode base64 values
    const iv = Buffer.from(data.iv, 'base64');
    const salt = Buffer.from(data.salt, 'base64');
    const tag = Buffer.from(data.tag, 'base64');
    const encrypted = Buffer.from(data.data, 'base64');

    // Derive decryption key
    const key = crypto.pbkdf2Sync(
      this.encryptionKey!,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      'sha256'
    );

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt data
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  }

  /**
   * Rotate encryption key (re-encrypts all data)
   * 
   * @param reencryptCallback - Callback to re-encrypt stored data with new key
   * @returns Promise that resolves when rotation is complete
   */
  async rotateKey(
    reencryptCallback: (encrypt: (data: string) => Promise<string>) => Promise<void>
  ): Promise<void> {
    // Generate new key
    const newKey = crypto.randomBytes(KEY_LENGTH);
    const oldKey = this.encryptionKey;

    // Temporarily set new key
    this.encryptionKey = newKey;
    await this.storeEncryptionKey();

    try {
      // Re-encrypt all data with new key
      await reencryptCallback((data: string) => this.encrypt(data));
    } catch (error) {
      // Rollback on failure
      this.encryptionKey = oldKey;
      await this.storeEncryptionKey();
      throw error;
    }
  }

  /**
   * Ensure encryption key exists or generate a new one
   */
  private async ensureEncryptionKey(): Promise<void> {
    if (this.encryptionKey) {
      return;
    }

    // Try to load existing key
    const storedKey = await this.context.secrets.get(ENCRYPTION_KEY_STORAGE_KEY);
    
    if (storedKey) {
      try {
        this.encryptionKey = Buffer.from(storedKey, 'base64');
        return;
      } catch {
        // Invalid key format, generate new one
        console.warn('[Security] Invalid encryption key format, generating new key');
      }
    }

    // Generate new key
    this.encryptionKey = crypto.randomBytes(KEY_LENGTH);
    await this.storeEncryptionKey();
  }

  /**
   * Store encryption key securely
   */
  private async storeEncryptionKey(): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    await this.context.secrets.store(
      ENCRYPTION_KEY_STORAGE_KEY,
      this.encryptionKey.toString('base64')
    );
  }

  /**
   * Clear encryption key (for logout/security reset)
   */
  async clearKey(): Promise<void> {
    this.encryptionKey = null;
    await this.context.secrets.delete(ENCRYPTION_KEY_STORAGE_KEY);
  }
}

/**
 * Create and initialize encryption service
 */
export async function createEncryptionService(
  context: vscode.ExtensionContext
): Promise<EncryptionService> {
  const service = new EncryptionService(context);
  await service.initialize();
  return service;
}

