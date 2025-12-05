/**
 * Rollback capabilities for operations.
 * 
 * Provides state management and rollback functionality for
 * operations that need to be reversible.
 */

import * as vscode from 'vscode';
import { DevSyncError } from './base';

/**
 * Operation state snapshot.
 */
export interface OperationState {
  /** Unique identifier for this state */
  id: string;
  /** Timestamp when state was saved */
  timestamp: number;
  /** Operation type */
  operation: string;
  /** State data */
  data: Record<string, unknown>;
  /** Rollback function */
  rollback: () => Promise<void>;
}

/**
 * Rollback manager.
 */
export class RollbackManager {
  private states: OperationState[] = [];
  private maxStates: number = 10;

  /**
   * Saves current state before an operation.
   * 
   * @param operation - Operation identifier
   * @param data - State data to save
   * @param rollback - Function to rollback this state
   * @returns State ID
   */
  saveState(
    operation: string,
    data: Record<string, unknown>,
    rollback: () => Promise<void>
  ): string {
    const state: OperationState = {
      id: `state-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      operation,
      data,
      rollback,
    };

    this.states.push(state);

    // Keep only the most recent states
    if (this.states.length > this.maxStates) {
      this.states.shift();
    }

    return state.id;
  }

  /**
   * Rolls back to a specific state.
   * 
   * @param stateId - State ID to rollback to
   * @returns Promise resolving when rollback is complete
   */
  async rollbackTo(stateId: string): Promise<void> {
    const stateIndex = this.states.findIndex((s) => s.id === stateId);
    if (stateIndex === -1) {
      throw new Error(`State ${stateId} not found`);
    }

    // Rollback all states from the target state to the most recent
    for (let i = this.states.length - 1; i >= stateIndex; i--) {
      try {
        await this.states[i].rollback();
      } catch (error) {
        throw new Error(
          `Failed to rollback state ${this.states[i].id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Remove rolled back states
    this.states = this.states.slice(0, stateIndex);
  }

  /**
   * Rolls back the last operation.
   * 
   * @returns Promise resolving when rollback is complete
   */
  async rollbackLast(): Promise<void> {
    if (this.states.length === 0) {
      throw new Error('No states to rollback');
    }

    const lastState = this.states[this.states.length - 1];
    await this.rollbackTo(lastState.id);
  }

  /**
   * Gets all saved states.
   */
  getStates(): OperationState[] {
    return [...this.states];
  }

  /**
   * Gets state by ID.
   */
  getState(stateId: string): OperationState | undefined {
    return this.states.find((s) => s.id === stateId);
  }

  /**
   * Clears all states.
   */
  clear(): void {
    this.states = [];
  }

  /**
   * Executes an operation with automatic rollback on error.
   * 
   * @param operation - Operation identifier
   * @param execute - Function to execute the operation
   * @param rollback - Function to rollback the operation
   * @param saveState - Function to save current state
   * @returns Promise resolving to operation result
   */
  async executeWithRollback<T>(
    operation: string,
    execute: () => Promise<T>,
    rollback: () => Promise<void>,
    saveState?: () => Promise<Record<string, unknown>>
  ): Promise<T> {
    // Save state before operation
    let stateId: string | undefined;
    if (saveState) {
      const stateData = await saveState();
      stateId = this.saveState(operation, stateData, rollback);
    } else {
      stateId = this.saveState(operation, {}, rollback);
    }

    try {
      const result = await execute();
      // Operation succeeded, keep the state for potential manual rollback
      return result;
    } catch (error) {
      // Operation failed, rollback automatically
      if (stateId) {
        try {
          await this.rollbackTo(stateId);
        } catch (rollbackError) {
          throw new Error(
            `Operation failed and rollback also failed: ${error instanceof Error ? error.message : String(error)}. Rollback error: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
          );
        }
      }
      throw error;
    }
  }
}

/**
 * Global rollback manager instance.
 */
let globalRollbackManager: RollbackManager | null = null;

/**
 * Gets the global rollback manager.
 */
export function getRollbackManager(): RollbackManager {
  if (!globalRollbackManager) {
    globalRollbackManager = new RollbackManager();
  }
  return globalRollbackManager;
}

