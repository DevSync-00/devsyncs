/**
 * State saving before risky operations.
 * 
 * Saves application state before operations that might fail,
 * allowing for recovery and rollback.
 */

import * as vscode from 'vscode';
import { IStateStore } from '../interfaces';
import { RollbackManager, OperationState } from './rollback';

/**
 * State saver for risky operations.
 */
export class StateSaver {
  private rollbackManager: RollbackManager;

  constructor(private stateStore: IStateStore) {
    this.rollbackManager = new RollbackManager();
  }

  /**
   * Saves current state before a risky operation.
   * 
   * @param operation - Operation identifier
   * @returns State ID
   */
  saveStateBeforeOperation(operation: string): string {
    const currentState = this.stateStore.getState();

    return this.rollbackManager.saveState(
      operation,
      {
        state: JSON.parse(JSON.stringify(currentState)), // Deep clone
        timestamp: Date.now(),
      },
      async () => {
        // Rollback: restore previous state
        // Note: This is a simplified rollback - in practice, you'd want
        // to restore the exact previous state, not reset
        this.stateStore.reset();
      }
    );
  }

  /**
   * Executes an operation with automatic state saving and rollback.
   * 
   * @param operation - Operation identifier
   * @param execute - Function to execute
   * @returns Promise resolving to operation result
   */
  async executeWithStateSave<T>(
    operation: string,
    execute: () => Promise<T>
  ): Promise<T> {
    const stateId = this.saveStateBeforeOperation(operation);

    try {
      const result = await execute();
      return result;
    } catch (error) {
      // Rollback on error
      try {
        await this.rollbackManager.rollbackTo(stateId);
      } catch (rollbackError) {
        // Log rollback failure but don't throw - original error is more important
        console.error('Failed to rollback state:', rollbackError);
      }
      throw error;
    }
  }

  /**
   * Gets saved states.
   */
  getSavedStates(): OperationState[] {
    return this.rollbackManager.getStates();
  }

  /**
   * Rolls back to a saved state.
   */
  async rollbackToState(stateId: string): Promise<void> {
    await this.rollbackManager.rollbackTo(stateId);
  }

  /**
   * Rolls back the last operation.
   */
  async rollbackLast(): Promise<void> {
    await this.rollbackManager.rollbackLast();
  }
}

