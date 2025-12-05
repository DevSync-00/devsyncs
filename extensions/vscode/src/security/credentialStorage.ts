/**
 * Secure credential storage service.
 * 
 * Provides secure storage for sensitive credentials like connection strings,
 * API keys, and passwords using VS Code secrets API with encryption.
 */

import * as vscode from 'vscode';
import { EncryptionService } from './encryption';

/**
 * Credential storage key prefix
 */
const CREDENTIAL_PREFIX = 'devsync.credential.';

/**
 * Secure credential storage manager
 */
export class CredentialStorage {
  private encryption: EncryptionService | null = null;

  constructor(
    private context: vscode.ExtensionContext,
    encryptionService?: EncryptionService
  ) {
    if (encryptionService) {
      this.encryption = encryptionService;
    }
  }

  /**
   * Set encryption service (if not provided in constructor)
   */
  async setEncryptionService(encryption: EncryptionService): Promise<void> {
    this.encryption = encryption;
  }

  /**
   * Store a credential securely
   * 
   * @param key - Credential key (will be prefixed automatically)
   * @param value - Credential value to store
   * @param encrypt - Whether to encrypt the value (default: true)
   * 
   * @example
   * ```typescript
   * await credentialStorage.store('database.connection', 'postgresql://...', true);
   * ```
   */
  async store(key: string, value: string, encrypt: boolean = true): Promise<void> {
    if (!value) {
      throw new Error('Cannot store empty credential');
    }

    const storageKey = this.getStorageKey(key);
    let valueToStore = value;

    // Encrypt if encryption is enabled and service is available
    if (encrypt && this.encryption) {
      try {
        valueToStore = await this.encryption.encrypt(value);
      } catch (error) {
        console.error('[CredentialStorage] Encryption failed, storing unencrypted:', error);
        // Fall back to unencrypted storage if encryption fails
        encrypt = false;
      }
    }

    // Store in VS Code secrets (always encrypted by VS Code)
    await this.context.secrets.store(storageKey, valueToStore);

    // Store metadata about encryption status
    if (encrypt) {
      await this.context.globalState.update(`${storageKey}.encrypted`, true);
    }
  }

  /**
   * Retrieve a credential
   * 
   * @param key - Credential key
   * @returns Decrypted credential value or null if not found
   * 
   * @example
   * ```typescript
   * const connectionString = await credentialStorage.get('database.connection');
   * ```
   */
  async get(key: string): Promise<string | null> {
    const storageKey = this.getStorageKey(key);
    const encrypted = await this.context.secrets.get(storageKey);

    if (!encrypted) {
      return null;
    }

    // Check if value is encrypted with our encryption service
    const isEncrypted = this.context.globalState.get<boolean>(`${storageKey}.encrypted`, false);

    if (isEncrypted && this.encryption) {
      try {
        return await this.encryption.decrypt(encrypted);
      } catch (error) {
        console.error('[CredentialStorage] Decryption failed:', error);
        throw new Error('Failed to decrypt credential');
      }
    }

    // Return as-is if not encrypted with our service (VS Code still encrypts it)
    return encrypted;
  }

  /**
   * Delete a credential
   * 
   * @param key - Credential key
   */
  async delete(key: string): Promise<void> {
    const storageKey = this.getStorageKey(key);
    await this.context.secrets.delete(storageKey);
    await this.context.globalState.update(`${storageKey}.encrypted`, undefined);
  }

  /**
   * Check if a credential exists
   * 
   * @param key - Credential key
   * @returns True if credential exists
   */
  async exists(key: string): Promise<boolean> {
    const storageKey = this.getStorageKey(key);
    const value = await this.context.secrets.get(storageKey);
    return value !== null && value !== undefined;
  }

  /**
   * List all stored credential keys
   * 
   * @returns Array of credential keys (without prefix)
   */
  async list(): Promise<string[]> {
    // VS Code secrets API doesn't provide a list method
    // We'll track keys in globalState
    const keys = this.context.globalState.get<string[]>('devsync.credential.keys', []);
    return keys.filter(async (key) => await this.exists(key));
  }

  /**
   * Store connection string securely
   * 
   * @param connectionString - Database connection string
   */
  async storeConnectionString(connectionString: string): Promise<void> {
    await this.store('database.connection', connectionString, true);
    await this.trackKey('database.connection');
  }

  /**
   * Get connection string
   * 
   * @returns Connection string or null
   */
  async getConnectionString(): Promise<string | null> {
    return await this.get('database.connection');
  }

  /**
   * Store API key securely
   * 
   * @param apiKey - API key
   */
  async storeApiKey(apiKey: string): Promise<void> {
    await this.store('api.key', apiKey, true);
    await this.trackKey('api.key');
  }

  /**
   * Get API key
   * 
   * @returns API key or null
   */
  async getApiKey(): Promise<string | null> {
    return await this.get('api.key');
  }

  /**
   * Clear all stored credentials
   */
  async clearAll(): Promise<void> {
    const keys = await this.list();
    for (const key of keys) {
      await this.delete(key);
    }
    await this.context.globalState.update('devsync.credential.keys', []);
  }

  /**
   * Get storage key with prefix
   */
  private getStorageKey(key: string): string {
    return `${CREDENTIAL_PREFIX}${key}`;
  }

  /**
   * Track a credential key
   */
  private async trackKey(key: string): Promise<void> {
    const keys = this.context.globalState.get<string[]>('devsync.credential.keys', []);
    if (!keys.includes(key)) {
      keys.push(key);
      await this.context.globalState.update('devsync.credential.keys', keys);
    }
  }
}

