/**
 * Supabase client wrapper with retry logic
 * Provides consistent error handling and retry for Supabase operations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { retry } from './retry-utils';
import { formatErrorMessage } from './error-utils';

export interface SupabaseQueryOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Execute a Supabase query with retry logic
 * Returns the full result object including data, error, and count
 */
export async function executeSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any; count?: number | null }>,
  options: SupabaseQueryOptions = {}
): Promise<{ data: T; count?: number | null }> {
  const { retries = 3, retryDelay = 1000 } = options;

  const result = await retry(
    async () => {
      const response = await queryFn();
      const { data, error, count } = response;
      
      if (error) {
        // Format error message
        const formatted = formatErrorMessage(error, {
          operation: 'query',
          resource: 'database',
        });
        throw new Error(formatted.message);
      }

      if (data === null) {
        throw new Error('Query returned null data');
      }

      return { data, count };
    },
    {
      maxAttempts: retries,
      initialDelay: retryDelay,
      retryableErrors: [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'timeout',
        'network',
        'fetch failed',
        'Connection',
      ],
    }
  );

  return result;
}

/**
 * Execute a Supabase query that may return null
 */
export async function executeSupabaseQueryNullable<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options: SupabaseQueryOptions = {}
): Promise<T | null> {
  const { retries = 3, retryDelay = 1000 } = options;

  const result = await retry(
    async () => {
      const { data, error } = await queryFn();
      
      if (error) {
        // Format error message
        const formatted = formatErrorMessage(error, {
          operation: 'query',
          resource: 'database',
        });
        throw new Error(formatted.message);
      }

      return data;
    },
    {
      maxAttempts: retries,
      initialDelay: retryDelay,
      retryableErrors: [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'timeout',
        'network',
        'fetch failed',
        'Connection',
      ],
    }
  );

  return result;
}

/**
 * Execute a Supabase mutation (insert, update, delete) with retry logic
 */
export async function executeSupabaseMutation<T>(
  mutationFn: () => Promise<{ data: T | null; error: any }>,
  options: SupabaseQueryOptions = {}
): Promise<T> {
  const { retries = 3, retryDelay = 1000 } = options;

  const result = await retry(
    async () => {
      const { data, error } = await mutationFn();
      
      if (error) {
        // Format error message
        const formatted = formatErrorMessage(error, {
          operation: 'save',
          resource: 'database',
        });
        throw new Error(formatted.message);
      }

      if (data === null) {
        throw new Error('Mutation returned null data');
      }

      return data;
    },
    {
      maxAttempts: retries,
      initialDelay: retryDelay,
      retryableErrors: [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'timeout',
        'network',
        'fetch failed',
        'Connection',
      ],
    }
  );

  return result;
}

