/**
 * Enhanced error recovery system.
 * 
 * Integrates all error recovery mechanisms: retry, partial success,
 * rollback, suggestions, and state saving.
 */

import * as vscode from 'vscode';
import { DevSyncError } from './base';
import { RetryManager, RetryResult } from './retry';
import { PartialSuccessHandler, PartialSuccessResult } from './partialSuccess';
import { RollbackManager, getRollbackManager } from './rollback';
import { ErrorSuggestionProvider } from './suggestions';
import { StateSaver } from './stateSaver';
import { IStateStore } from '../interfaces';

/**
 * Enhanced recovery options.
 */
export interface EnhancedRecoveryOptions {
  /** Whether to retry on failure */
  retry?: {
    enabled: boolean;
    maxRetries?: number;
    initialDelay?: number;
  };
  /** Whether to handle partial success */
  partialSuccess?: {
    enabled: boolean;
    continueOnError?: boolean;
    minSuccessRate?: number;
  };
  /** Whether to save state before operation */
  saveState?: {
    enabled: boolean;
    operation: string;
  };
  /** Whether to show recovery suggestions */
  showSuggestions?: boolean;
  /** Custom error handler */
  onError?: (error: Error) => void;
}

/**
 * Enhanced recovery result.
 */
export interface EnhancedRecoveryResult<T> {
  /** Whether operation succeeded */
  success: boolean;
  /** Result value */
  value?: T;
  /** Error if failed */
  error?: Error;
  /** Whether retry was attempted */
  retried: boolean;
  /** Number of retry attempts */
  retryAttempts: number;
  /** Whether state was saved */
  stateSaved: boolean;
  /** State ID if saved */
  stateId?: string;
}

/**
 * Enhanced error recovery manager.
 */
export class EnhancedRecovery {
  private rollbackManager: RollbackManager;
  private stateSaver?: StateSaver;

  constructor(stateStore?: IStateStore) {
    this.rollbackManager = getRollbackManager();
    if (stateStore) {
      this.stateSaver = new StateSaver(stateStore);
    }
  }

  /**
   * Executes an operation with enhanced error recovery.
   * 
   * @param operation - Operation to execute
   * @param options - Recovery options
   * @returns Promise resolving to recovery result
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: EnhancedRecoveryOptions = {}
  ): Promise<EnhancedRecoveryResult<T>> {
    const {
      retry = { enabled: true, maxRetries: 3, initialDelay: 1000 },
      saveState = { enabled: false, operation: 'unknown' },
      showSuggestions = true,
      onError,
    } = options;

    let stateId: string | undefined;
    let retried = false;
    let retryAttempts = 0;

    // Save state if enabled
    if (saveState.enabled && this.stateSaver) {
      stateId = this.stateSaver.saveStateBeforeOperation(saveState.operation);
    }

    // Execute with retry if enabled
    let result: RetryResult<T>;
    if (retry.enabled) {
      result = await RetryManager.retry(operation, {
        maxRetries: retry.maxRetries || 3,
        initialDelay: retry.initialDelay || 1000,
        multiplier: 2,
        jitter: true,
      });
      retried = result.attempts > 1;
      retryAttempts = result.attempts;
    } else {
      try {
        const value = await operation();
        result = {
          success: true,
          value,
          attempts: 1,
          duration: 0,
        };
      } catch (error) {
        result = {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          attempts: 1,
          duration: 0,
        };
      }
    }

    // Handle result
    if (result.success && result.value !== undefined) {
      return {
        success: true,
        value: result.value,
        retried,
        retryAttempts,
        stateSaved: !!stateId,
        stateId,
      };
    }

    // Operation failed - handle error
    const error = result.error || new Error('Operation failed');
    
    if (onError) {
      onError(error);
    }

    // Show suggestions if enabled
    if (showSuggestions && error instanceof DevSyncError) {
      await ErrorSuggestionProvider.showSuggestions(error);
    }

    // Rollback if state was saved
    if (stateId && this.stateSaver) {
      try {
        await this.stateSaver.rollbackToState(stateId);
      } catch (rollbackError) {
        console.error('Failed to rollback state:', rollbackError);
      }
    }

    return {
      success: false,
      error,
      retried,
      retryAttempts,
      stateSaved: !!stateId,
      stateId,
    };
  }

  /**
   * Executes batch operations with partial success handling.
   * 
   * @param items - Items to process
   * @param processor - Function to process each item
   * @param options - Recovery options
   * @returns Promise resolving to partial success result
   */
  async executeBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: EnhancedRecoveryOptions & {
      partialSuccess?: {
        enabled: boolean;
        continueOnError?: boolean;
        minSuccessRate?: number;
      };
    } = {}
  ): Promise<PartialSuccessResult<R>> {
    const {
      partialSuccess = {
        enabled: true,
        continueOnError: true,
        minSuccessRate: 0.5,
      },
    } = options;

    if (partialSuccess.enabled) {
      return PartialSuccessHandler.processItems(items, processor, {
        continueOnError: partialSuccess.continueOnError,
        minSuccessRate: partialSuccess.minSuccessRate,
      });
    }

    // Process without partial success handling
    const results = await Promise.allSettled(
      items.map((item) => processor(item))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      total: items.length,
      succeeded,
      failed,
      results: results.map((r, i) => ({
        id: `item-${i}`,
        data: r.status === 'fulfilled' ? r.value : (undefined as any),
        success: r.status === 'fulfilled',
        error: r.status === 'rejected' ? r.reason : undefined,
      })),
      overallSuccess: succeeded > 0,
    };
  }

  /**
   * Undoes the last operation.
   */
  async undoLast(): Promise<void> {
    if (this.stateSaver) {
      await this.stateSaver.rollbackLast();
    } else {
      await this.rollbackManager.rollbackLast();
    }
  }

  /**
   * Gets recovery suggestions for an error.
   */
  getSuggestions(
    error: DevSyncError,
    context?: Record<string, unknown>
  ): ReturnType<typeof ErrorSuggestionProvider.getSuggestions> {
    return ErrorSuggestionProvider.getSuggestions(error, context);
  }
}

