/**
 * Reducers for state management
 */

import { AppState, Action, ActionType } from './types';
import { ScanReport, Migration } from '../api';

/**
 * Create initial state
 */
export function createInitialState(): AppState {
  const baseState: Omit<AppState, 'history'> = {
    scan: {
      isScanning: false,
      lastScanReport: null,
      scanHistory: [],
      selectedMismatches: [],
    },
    migration: {
      isGenerating: false,
      migrations: [],
      selectedMigration: null,
    },
    ui: {
      sidebarExpanded: {},
      selectedView: null,
      filters: {},
    },
  };

  return {
    ...baseState,
    history: {
      past: [],
      present: baseState as AppState,
      future: [],
    },
  };
}

/**
 * Scan reducer
 */
function scanReducer(state: AppState['scan'], action: Action): AppState['scan'] {
  switch (action.type) {
    case ActionType.SCAN_START:
      return { ...state, isScanning: true };

    case ActionType.SCAN_COMPLETE:
      const report = action.payload as ScanReport;
      return {
        ...state,
        isScanning: false,
        lastScanReport: report,
        scanHistory: [report, ...state.scanHistory].slice(0, 50), // Keep last 50
      };

    case ActionType.SCAN_FAIL:
      return { ...state, isScanning: false };

    case ActionType.SET_SCAN_REPORT:
      return {
        ...state,
        lastScanReport: action.payload as ScanReport,
      };

    case ActionType.SELECT_MISMATCH:
      if (action.payload && typeof action.payload === 'object' && 'mismatchId' in action.payload) {
        const mismatchId = action.payload.mismatchId as string;
        if (!state.selectedMismatches.includes(mismatchId)) {
          return {
            ...state,
            selectedMismatches: [...state.selectedMismatches, mismatchId],
          };
        }
      }
      return state;

    case ActionType.DESELECT_MISMATCH:
      if (action.payload && typeof action.payload === 'object' && 'mismatchId' in action.payload) {
        const mismatchId = action.payload.mismatchId as string;
        return {
          ...state,
          selectedMismatches: state.selectedMismatches.filter(
            (id) => id !== mismatchId
          ),
        };
      }
      return state;

    case ActionType.CLEAR_SELECTED_MISMATCHES:
      return {
        ...state,
        selectedMismatches: [],
      };

    default:
      return state;
  }
}

/**
 * Migration reducer
 */
function migrationReducer(
  state: AppState['migration'],
  action: Action
): AppState['migration'] {
  switch (action.type) {
    case ActionType.MIGRATION_START:
      return { ...state, isGenerating: true };

    case ActionType.MIGRATION_COMPLETE:
    case ActionType.ADD_MIGRATION:
      const migration = action.payload as Migration;
      return {
        ...state,
        isGenerating: false,
        migrations: [migration, ...state.migrations].slice(0, 50), // Keep last 50
      };

    case ActionType.MIGRATION_FAIL:
      return { ...state, isGenerating: false };

    case ActionType.SELECT_MIGRATION:
      if (action.payload && typeof action.payload === 'object' && 'migrationId' in action.payload) {
        return {
          ...state,
          selectedMigration: action.payload.migrationId as string,
        };
      }
      return state;

    default:
      return state;
  }
}

/**
 * UI reducer
 */
function uiReducer(state: AppState['ui'], action: Action): AppState['ui'] {
  switch (action.type) {
    case ActionType.TOGGLE_SIDEBAR_SECTION:
      if (action.payload && typeof action.payload === 'object' && 'section' in action.payload) {
        const section = action.payload.section as string;
        return {
          ...state,
          sidebarExpanded: {
            ...state.sidebarExpanded,
            [section]: !state.sidebarExpanded[section],
          },
        };
      }
      return state;

    case ActionType.SET_SELECTED_VIEW:
      if (action.payload && typeof action.payload === 'object' && 'view' in action.payload) {
        return {
          ...state,
          selectedView: action.payload.view as 'scan' | 'migration' | 'config' | null,
        };
      }
      return state;

    case ActionType.SET_FILTER:
      if (action.payload && typeof action.payload === 'object') {
        return {
          ...state,
          filters: { ...state.filters, ...(action.payload as Record<string, unknown>) },
        };
      }
      return state;

    case ActionType.CLEAR_FILTERS:
      return {
        ...state,
        filters: {},
      };

    default:
      return state;
  }
}

/**
 * History reducer (for undo/redo)
 */
function historyReducer(
  state: AppState['history'],
  action: Action,
  newPresent: AppState
): AppState['history'] {
  switch (action.type) {
    case ActionType.UNDO:
      if (state.past.length === 0) {
        return state;
      }
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      return {
        past: newPast,
        present: previous,
        future: [state.present, ...state.future],
      };

    case ActionType.REDO:
      if (state.future.length === 0) {
        return state;
      }
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        past: [...state.past, state.present],
        present: next,
        future: newFuture,
      };

    case ActionType.CLEAR_HISTORY:
      return {
        past: [],
        present: newPresent,
        future: [],
      };

    default:
      // Add current state to history for all non-history actions
      // (we're in default case, so it's not UNDO, REDO, or CLEAR_HISTORY)
      return {
        past: [...state.past, state.present].slice(-50), // Keep last 50 states
        present: newPresent,
        future: [], // Clear future when new action is performed
      };
  }
}

/**
 * Root reducer
 */
export function rootReducer(state: AppState, action: Action): AppState {
  // Handle history actions first
  let newState: AppState;
  
  const isHistoryAction = action.type === ActionType.UNDO || action.type === ActionType.REDO;
  
  if (isHistoryAction) {
    // For undo/redo, use history reducer
    const newHistory = historyReducer(state.history, action, state);
    newState = {
      ...newHistory.present,
      history: newHistory,
    };
  } else {
    // Apply regular reducers
    newState = {
      scan: scanReducer(state.scan, action),
      migration: migrationReducer(state.migration, action),
      ui: uiReducer(state.ui, action),
      history: state.history,
    };

    // Update history (skip for CLEAR_HISTORY as it's handled in historyReducer)
    if (action.type !== ActionType.CLEAR_HISTORY) {
      newState.history = historyReducer(state.history, action, newState);
    } else {
      newState.history = historyReducer(state.history, action, newState);
    }
  }

  return newState;
}

