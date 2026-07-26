/**
 * Centralized state store (Redux-like pattern)
 */

import { EventEmitter } from 'vscode';
import { AppState, Action, StateChangeEvent, ActionType } from './types';
import { rootReducer, createInitialState } from './reducers';
import * as vscode from 'vscode';

/**
 * State store class
 */
export class StateStore {
  private state: AppState;
  private readonly onStateChangeEmitter = new EventEmitter<StateChangeEvent>();
  public readonly onStateChange = this.onStateChangeEmitter.event;

  constructor(
    private context: vscode.ExtensionContext,
    initialState?: AppState
  ) {
    this.state = initialState || this.loadPersistedState() || createInitialState();
    this.setupPersistence();
  }

  /**
   * Get current state
   */
  getState(): AppState {
    return this.state;
  }

  /**
   * Get a slice of state
   */
  getStateSlice<K extends keyof AppState>(slice: K): AppState[K] {
    return this.state[slice];
  }

  /**
   * Dispatch an action
   */
  dispatch(action: Action): void {
    const previousState = { ...this.state };
    this.state = rootReducer(this.state, action);

    // Determine which keys changed
    const changedKeys = this.getChangedKeys(previousState, this.state);

    // Emit state change event
    this.onStateChangeEmitter.fire({
      action,
      previousState,
      newState: this.state,
      changedKeys,
    });

    // Persist state (debounced)
    this.persistState();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(
    callback: (event: StateChangeEvent) => void
  ): vscode.Disposable {
    return this.onStateChange(callback);
  }

  /**
   * Subscribe to specific state slice changes
   */
  subscribeToSlice<K extends keyof AppState>(
    slice: K,
    callback: (newValue: AppState[K], previousValue: AppState[K]) => void
  ): vscode.Disposable {
    let previousValue = this.state[slice];

    return this.onStateChange((event) => {
      if (event.changedKeys.includes(slice)) {
        const newValue = event.newState[slice];
        callback(newValue, previousValue);
        previousValue = newValue;
      }
    });
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.state.history.past.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.state.history.future.length > 0;
  }

  /**
   * Undo last action
   */
  undo(): void {
    if (this.canUndo()) {
      this.dispatch({ type: ActionType.UNDO, timestamp: Date.now() });
    }
  }

  /**
   * Redo last undone action
   */
  redo(): void {
    if (this.canRedo()) {
      this.dispatch({ type: ActionType.REDO, timestamp: Date.now() });
    }
  }

  /**
   * Reset state to initial
   */
  reset(): void {
    const previousState = { ...this.state };
    this.state = createInitialState();
    this.persistState();
    this.onStateChangeEmitter.fire({
      action: { type: ActionType.CLEAR_HISTORY, timestamp: Date.now() },
      previousState,
      newState: this.state,
      changedKeys: Object.keys(this.state) as string[],
    });
  }

  /**
   * Get changed keys between two states
   */
  private getChangedKeys(previous: AppState, current: AppState): string[] {
    const changed: string[] = [];

    // Check each top-level key
    for (const key of Object.keys(current) as Array<keyof AppState>) {
      if (key === 'history') continue; // Skip history in changed keys

      if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
        changed.push(key);
      }
    }

    return changed;
  }

  /**
   * Load persisted state from storage
   */
  private loadPersistedState(): AppState | null {
    try {
      const persisted = this.context.globalState.get<AppState>('devsync.state');
      if (persisted) {
        // Merge with initial state to ensure all keys exist
        const initialState = createInitialState();
        return {
          ...initialState,
          ...persisted,
          // Ensure nested objects are merged correctly
          scan: { ...initialState.scan, ...persisted.scan },
          migration: { ...initialState.migration, ...persisted.migration },
          ui: { ...initialState.ui, ...persisted.ui },
        };
      }
    } catch (error) {
      console.error('Failed to load persisted state:', error);
    }
    return null;
  }

  /**
   * Persist state to storage
   */
  private persistStateDebounced: NodeJS.Timeout | null = null;

  private persistState(): void {
    // Debounce persistence to avoid too many writes
    if (this.persistStateDebounced) {
      clearTimeout(this.persistStateDebounced);
    }

    this.persistStateDebounced = setTimeout(() => {
      this.persistStateDebounced = null;
      void this.writePersistedState();
    }, 500); // 500ms debounce
  }

  /**
   * Flush pending state to VS Code storage.
   *
   * Workflow boundaries can await this before creating another container or
   * reading state from a fresh extension session.
   */
  async flush(): Promise<void> {
    if (this.persistStateDebounced) {
      clearTimeout(this.persistStateDebounced);
      this.persistStateDebounced = null;
    }
    await this.writePersistedState();
  }

  private async writePersistedState(): Promise<void> {
    try {
      // Don't persist history to avoid storage bloat.
      const stateToPersist: Partial<AppState> = {
        scan: this.state.scan,
        migration: this.state.migration,
        ui: this.state.ui,
      };

      await this.context.globalState.update('devsync.state', stateToPersist);
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  /**
   * Setup automatic persistence on state changes
   */
  private setupPersistence(): void {
    // Persistence is handled in persistState() which is called after each dispatch
  }

  /**
   * Dispose the store
   */
  dispose(): void {
    // Persist immediately rather than scheduling work after disposal.
    if (this.persistStateDebounced) {
      clearTimeout(this.persistStateDebounced);
      this.persistStateDebounced = null;
    }
    void this.writePersistedState();
    this.onStateChangeEmitter.dispose();
  }
}

