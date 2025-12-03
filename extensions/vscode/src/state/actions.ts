/**
 * Action creators for state management
 */

import { Action, ActionType } from './types';
import { ScanReport, Migration } from '../api';

/**
 * Scan actions
 */
export const scanActions = {
  start: (): Action<ActionType.SCAN_START> => ({
    type: ActionType.SCAN_START,
    timestamp: Date.now(),
  }),

  complete: (report: ScanReport): Action<ActionType.SCAN_COMPLETE> => ({
    type: ActionType.SCAN_COMPLETE,
    payload: report,
    timestamp: Date.now(),
  }),

  fail: (error: string): Action<ActionType.SCAN_FAIL> => ({
    type: ActionType.SCAN_FAIL,
    payload: { error },
    timestamp: Date.now(),
  }),

  setReport: (report: ScanReport): Action<ActionType.SET_SCAN_REPORT> => ({
    type: ActionType.SET_SCAN_REPORT,
    payload: report,
    timestamp: Date.now(),
  }),

  selectMismatch: (mismatchId: string): Action<ActionType.SELECT_MISMATCH> => ({
    type: ActionType.SELECT_MISMATCH,
    payload: { mismatchId },
    timestamp: Date.now(),
  }),

  deselectMismatch: (mismatchId: string): Action<ActionType.DESELECT_MISMATCH> => ({
    type: ActionType.DESELECT_MISMATCH,
    payload: { mismatchId },
    timestamp: Date.now(),
  }),

  clearSelected: (): Action<ActionType.CLEAR_SELECTED_MISMATCHES> => ({
    type: ActionType.CLEAR_SELECTED_MISMATCHES,
    timestamp: Date.now(),
  }),
};

/**
 * Migration actions
 */
export const migrationActions = {
  start: (): Action<ActionType.MIGRATION_START> => ({
    type: ActionType.MIGRATION_START,
    timestamp: Date.now(),
  }),

  complete: (migration: Migration): Action<ActionType.MIGRATION_COMPLETE> => ({
    type: ActionType.MIGRATION_COMPLETE,
    payload: migration,
    timestamp: Date.now(),
  }),

  fail: (error: string): Action<ActionType.MIGRATION_FAIL> => ({
    type: ActionType.MIGRATION_FAIL,
    payload: { error },
    timestamp: Date.now(),
  }),

  add: (migration: Migration): Action<ActionType.ADD_MIGRATION> => ({
    type: ActionType.ADD_MIGRATION,
    payload: migration,
    timestamp: Date.now(),
  }),

  select: (migrationId: string): Action<ActionType.SELECT_MIGRATION> => ({
    type: ActionType.SELECT_MIGRATION,
    payload: { migrationId },
    timestamp: Date.now(),
  }),
};

/**
 * UI actions
 */
export const uiActions = {
  toggleSidebarSection: (section: string): Action<ActionType.TOGGLE_SIDEBAR_SECTION> => ({
    type: ActionType.TOGGLE_SIDEBAR_SECTION,
    payload: { section },
    timestamp: Date.now(),
  }),

  setSelectedView: (view: 'scan' | 'migration' | 'config' | null): Action<ActionType.SET_SELECTED_VIEW> => ({
    type: ActionType.SET_SELECTED_VIEW,
    payload: { view },
    timestamp: Date.now(),
  }),

  setFilter: (filter: { severity?: 'error' | 'warning' | 'info'; type?: string; model?: string }): Action<ActionType.SET_FILTER> => ({
    type: ActionType.SET_FILTER,
    payload: filter,
    timestamp: Date.now(),
  }),

  clearFilters: (): Action<ActionType.CLEAR_FILTERS> => ({
    type: ActionType.CLEAR_FILTERS,
    timestamp: Date.now(),
  }),
};

/**
 * History actions
 */
export const historyActions = {
  undo: (): Action<ActionType.UNDO> => ({
    type: ActionType.UNDO,
    timestamp: Date.now(),
  }),

  redo: (): Action<ActionType.REDO> => ({
    type: ActionType.REDO,
    timestamp: Date.now(),
  }),

  clear: (): Action<ActionType.CLEAR_HISTORY> => ({
    type: ActionType.CLEAR_HISTORY,
    timestamp: Date.now(),
  }),
};

