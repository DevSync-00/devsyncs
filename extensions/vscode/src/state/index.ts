/**
 * Central export for state management
 */
export { StateStore } from './store';
export { rootReducer, createInitialState } from './reducers';
export { scanActions, migrationActions, uiActions, historyActions } from './actions';
export type {
  AppState,
  Action,
  ActionType,
  StateChangeEvent,
  ActionCreator,
  Reducer,
} from './types';

