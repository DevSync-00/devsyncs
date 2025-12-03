/**
 * State management types and interfaces
 */

import { ScanReport, Mismatch, Migration } from '../api';

/**
 * Application state shape
 */
export interface AppState {
  // Scan state
  scan: {
    isScanning: boolean;
    lastScanReport: ScanReport | null;
    scanHistory: ScanReport[];
    selectedMismatches: string[];
  };

  // Migration state
  migration: {
    isGenerating: boolean;
    migrations: Migration[];
    selectedMigration: string | null;
  };

  // UI state
  ui: {
    sidebarExpanded: Record<string, boolean>;
    selectedView: 'scan' | 'migration' | 'config' | null;
    filters: {
      severity?: 'error' | 'warning' | 'info';
      type?: string;
      model?: string;
    };
  };

  // History for undo/redo
  history: {
    past: AppState[];
    present: AppState;
    future: AppState[];
  };
}

/**
 * Action types
 */
export enum ActionType {
  // Scan actions
  SCAN_START = 'SCAN_START',
  SCAN_COMPLETE = 'SCAN_COMPLETE',
  SCAN_FAIL = 'SCAN_FAIL',
  SET_SCAN_REPORT = 'SET_SCAN_REPORT',
  SELECT_MISMATCH = 'SELECT_MISMATCH',
  DESELECT_MISMATCH = 'DESELECT_MISMATCH',
  CLEAR_SELECTED_MISMATCHES = 'CLEAR_SELECTED_MISMATCHES',

  // Migration actions
  MIGRATION_START = 'MIGRATION_START',
  MIGRATION_COMPLETE = 'MIGRATION_COMPLETE',
  MIGRATION_FAIL = 'MIGRATION_FAIL',
  ADD_MIGRATION = 'ADD_MIGRATION',
  SELECT_MIGRATION = 'SELECT_MIGRATION',

  // UI actions
  TOGGLE_SIDEBAR_SECTION = 'TOGGLE_SIDEBAR_SECTION',
  SET_SELECTED_VIEW = 'SET_SELECTED_VIEW',
  SET_FILTER = 'SET_FILTER',
  CLEAR_FILTERS = 'CLEAR_FILTERS',

  // History actions
  UNDO = 'UNDO',
  REDO = 'REDO',
  CLEAR_HISTORY = 'CLEAR_HISTORY',
}

/**
 * Base action interface
 */
export interface Action<T extends ActionType = ActionType> {
  type: T;
  payload?: unknown;
  timestamp?: number;
}

/**
 * Action creators type
 */
export type ActionCreator<T extends ActionType> = (payload?: unknown) => Action<T>;

/**
 * Reducer function type
 */
export type Reducer = (state: AppState, action: Action) => AppState;

/**
 * State change event
 */
export interface StateChangeEvent {
  action: Action;
  previousState: AppState;
  newState: AppState;
  changedKeys: string[];
}

