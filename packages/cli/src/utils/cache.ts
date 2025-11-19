import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * Simple file-based cache for scan results
 */
export interface CacheOptions {
  cacheDir?: string;
  ttl?: number; // Time to live in milliseconds
}

export class Cache {
  private cacheDir: string;
  private ttl: number;

  constructor(options: CacheOptions = {}) {
    this.cacheDir = options.cacheDir || join(process.cwd(), '.devsync', 'cache');
    this.ttl = options.ttl || 3600000; // 1 hour default

    // Ensure cache directory exists
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Generate cache key from data
   */
  private getCacheKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  /**
   * Get cache file path
   */
  private getCachePath(key: string): string {
    return join(this.cacheDir, `${this.getCacheKey(key)}.json`);
  }

  /**
   * Get cached value
   */
  get<T>(key: string): T | null {
    const cachePath = this.getCachePath(key);

    if (!existsSync(cachePath)) {
      return null;
    }

    try {
      const stats = statSync(cachePath);
      const age = Date.now() - stats.mtimeMs;

      // Check if cache is expired
      if (age > this.ttl) {
        return null;
      }

      const content = readFileSync(cachePath, 'utf-8');
      const data = JSON.parse(content);

      return data.value as T;
    } catch (error) {
      // If cache is corrupted, return null
      return null;
    }
  }

  /**
   * Set cached value
   */
  set<T>(key: string, value: T): void {
    const cachePath = this.getCachePath(key);

    try {
      const data = {
        key,
        value,
        timestamp: Date.now()
      };

      writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      // Silently fail if cache write fails
    }
  }

  /**
   * Clear cache
   */
  clear(): void {
    // Cache is file-based, so clearing means deleting files
    // This is a simple implementation - could be improved
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
}

