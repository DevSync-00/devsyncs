# State Management

This directory contains the centralized state management implementation for the DevSync VS Code extension, addressing improvement 1.4 from the IMPROVEMENTS.md roadmap.

## Overview

The state management system provides:
- **Centralized State Store** - Redux-like pattern with actions, reducers, and store
- **Event-Driven Updates** - Reactive state changes with event emission
- **State Persistence** - Automatic persistence to VS Code storage
- **Undo/Redo** - Full undo/redo functionality for user actions

## Structure

### Types (`types.ts`)
- `AppState` - Complete application state shape
- `Action` - Action interface with type and payload
- `ActionType` - Enumeration of all action types
- `StateChangeEvent` - Event emitted on state changes

### Actions (`actions.ts`)
Action creators organized by domain:
- `scanActions` - Scan-related actions
- `migrationActions` - Migration-related actions
- `uiActions` - UI state actions
- `historyActions` - Undo/redo actions

### Reducers (`reducers.ts`)
- `rootReducer` - Main reducer that combines all domain reducers
- `scanReducer` - Handles scan state
- `migrationReducer` - Handles migration state
- `uiReducer` - Handles UI state
- `historyReducer` - Handles undo/redo history

### Store (`store.ts`)
- `StateStore` - Main state store class
- State persistence
- Event emission
- Undo/redo functionality

## Usage

### Basic Usage

```typescript
import { StateStore } from './state';
import { scanActions } from './state';

// Get state store from DI container
const stateStore = container.getStateStore();

// Get current state
const state = stateStore.getState();

// Get a slice of state
const scanState = stateStore.getStateSlice('scan');

// Dispatch an action
stateStore.dispatch(scanActions.start());

// Subscribe to state changes
const disposable = stateStore.subscribe((event) => {
  console.log('State changed:', event.changedKeys);
  console.log('New state:', event.newState);
});
```

### Subscribing to Specific State Slices

```typescript
// Subscribe to scan state changes only
stateStore.subscribeToSlice('scan', (newScanState, previousScanState) => {
  if (newScanState.isScanning !== previousScanState.isScanning) {
    console.log('Scan status changed:', newScanState.isScanning);
  }
});
```

### Undo/Redo

```typescript
// Check if undo is available
if (stateStore.canUndo()) {
  stateStore.undo();
}

// Check if redo is available
if (stateStore.canRedo()) {
  stateStore.redo();
}
```

### Action Creators

```typescript
import { scanActions, migrationActions, uiActions } from './state';

// Scan actions
stateStore.dispatch(scanActions.start());
stateStore.dispatch(scanActions.complete(scanReport));
stateStore.dispatch(scanActions.fail('Error message'));

// Migration actions
stateStore.dispatch(migrationActions.start());
stateStore.dispatch(migrationActions.complete(migration));

// UI actions
stateStore.dispatch(uiActions.toggleSidebarSection('scan-results'));
stateStore.dispatch(uiActions.setSelectedView('scan'));
stateStore.dispatch(uiActions.setFilter({ severity: 'error' }));
```

## State Shape

```typescript
{
  scan: {
    isScanning: boolean;
    lastScanReport: ScanReport | null;
    scanHistory: ScanReport[];
    selectedMismatches: string[];
  },
  migration: {
    isGenerating: boolean;
    migrations: Migration[];
    selectedMigration: string | null;
  },
  ui: {
    sidebarExpanded: Record<string, boolean>;
    selectedView: 'scan' | 'migration' | 'config' | null;
    filters: {
      severity?: 'error' | 'warning' | 'info';
      type?: string;
      model?: string;
    };
  },
  history: {
    past: AppState[];
    present: AppState;
    future: AppState[];
  }
}
```

## Features

### Event-Driven Architecture
All state changes emit events that components can subscribe to, enabling reactive updates.

### State Persistence
State is automatically persisted to VS Code's global storage, so it survives extension restarts.

### Undo/Redo
Full undo/redo support with history tracking. The last 50 states are kept in memory.

### Type Safety
Full TypeScript type safety for all state, actions, and reducers.

### Immutability
State updates are immutable - reducers return new state objects rather than mutating existing ones.

## Integration

The StateStore is integrated into:
- `DIContainer` - Available as a service
- `DevSyncCommands` - Uses state store for scan and migration operations
- All components can access state through the store

## Benefits

1. **Centralized State** - Single source of truth for all application state
2. **Predictable Updates** - All state changes go through actions and reducers
3. **Time Travel** - Undo/redo enables time travel debugging
4. **Persistence** - State survives extension restarts
5. **Reactive** - Components can react to state changes automatically
6. **Type Safe** - Full TypeScript support

