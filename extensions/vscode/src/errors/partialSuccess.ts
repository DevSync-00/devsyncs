/**
 * Partial success handling.
 * 
 * Handles operations that partially succeed, allowing for
 * graceful degradation and recovery.
 */

import { DevSyncError } from './base';

/**
 * Partial result item.
 */
export interface PartialResultItem<T> {
  /** Item identifier */
  id: string;
  /** Item data */
  data: T;
  /** Whether this item succeeded */
  success: boolean;
  /** Error if failed */
  error?: Error;
}

/**
 * Partial success result.
 */
export interface PartialSuccessResult<T> {
  /** Total items processed */
  total: number;
  /** Number of successful items */
  succeeded: number;
  /** Number of failed items */
  failed: number;
  /** Results for each item */
  results: PartialResultItem<T>[];
  /** Whether overall operation was successful */
  overallSuccess: boolean;
}

/**
 * Partial success handler.
 */
export class PartialSuccessHandler {
  /**
   * Processes items with partial success handling.
   * 
   * @param items - Items to process
   * @param processor - Function to process each item
   * @param options - Processing options
   * @returns Promise resolving to partial success result
   */
  static async processItems<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      continueOnError?: boolean;
      minSuccessRate?: number; // 0-1, minimum success rate to consider overall success
      onItemError?: (item: T, error: Error) => void;
    } = {}
  ): Promise<PartialSuccessResult<R>> {
    const {
      continueOnError = true,
      minSuccessRate = 0.5,
      onItemError,
    } = options;

    const results: PartialResultItem<R>[] = [];
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = `item-${i}`;

      try {
        const data = await processor(item);
        results.push({ id, data, success: true });
        succeeded++;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        results.push({ id, data: undefined as any, success: false, error: err });
        failed++;

        if (onItemError) {
          onItemError(item, err);
        }

        if (!continueOnError) {
          // Stop processing on first error
          break;
        }
      }
    }

    const successRate = succeeded / items.length;
    const overallSuccess = successRate >= minSuccessRate;

    return {
      total: items.length,
      succeeded,
      failed,
      results,
      overallSuccess,
    };
  }

  /**
   * Processes items in batches with partial success handling.
   * 
   * @param items - Items to process
   * @param batchSize - Number of items per batch
   * @param processor - Function to process each item
   * @param options - Processing options
   * @returns Promise resolving to partial success result
   */
  static async processBatches<T, R>(
    items: T[],
    batchSize: number,
    processor: (item: T) => Promise<R>,
    options: {
      continueOnError?: boolean;
      minSuccessRate?: number;
      onItemError?: (item: T, error: Error) => void;
      onBatchComplete?: (batchIndex: number, batchResult: PartialSuccessResult<R>) => void;
    } = {}
  ): Promise<PartialSuccessResult<R>> {
    const allResults: PartialResultItem<R>[] = [];
    let totalSucceeded = 0;
    let totalFailed = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);

      const batchResult = await this.processItems(batch, processor, {
        ...options,
        onItemError: (item, error) => {
          if (options.onItemError) {
            options.onItemError(item, error);
          }
        },
      });

      allResults.push(...batchResult.results);
      totalSucceeded += batchResult.succeeded;
      totalFailed += batchResult.failed;

      if (options.onBatchComplete) {
        options.onBatchComplete(batchIndex, batchResult);
      }

      // Stop if we've exceeded minimum success rate threshold
      if (!batchResult.overallSuccess && !options.continueOnError) {
        break;
      }
    }

    const successRate = totalSucceeded / items.length;
    const minSuccessRate = options.minSuccessRate || 0.5;
    const overallSuccess = successRate >= minSuccessRate;

    return {
      total: items.length,
      succeeded: totalSucceeded,
      failed: totalFailed,
      results: allResults,
      overallSuccess,
    };
  }

  /**
   * Gets summary message for partial success result.
   */
  static getSummaryMessage<T>(result: PartialSuccessResult<T>): string {
    if (result.overallSuccess) {
      if (result.failed === 0) {
        return `All ${result.total} items processed successfully.`;
      }
      return `${result.succeeded} of ${result.total} items processed successfully. ${result.failed} failed.`;
    }
    return `Operation partially failed: ${result.succeeded} succeeded, ${result.failed} failed out of ${result.total} total.`;
  }
}

