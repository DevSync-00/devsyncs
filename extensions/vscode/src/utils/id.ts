/**
 * Utility functions for generating unique identifiers
 */

import { randomUUID } from 'crypto';

/**
 * Generate a unique identifier
 * Uses crypto.randomUUID() if available, otherwise falls back to timestamp-based ID
 */
export function generateId(): string {
  try {
    return randomUUID();
  } catch {
    // Fallback for environments without crypto.randomUUID()
    return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  }
}

/**
 * Generate a timestamp-based identifier
 */
export function generateTimestampId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Generate a migration filename with timestamp
 */
export function generateMigrationFilename(format: string = 'sql'): string {
  return `migration_${generateTimestampId()}.${format}`;
}

