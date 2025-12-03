# Command Execution Enhancements

This module provides enhanced command execution features including preview, progress tracking, task queuing, pause/resume, and detailed status reporting.

## Features

### 1. Preview Changes Before Applying

The `PreviewManager` shows users what changes will be made before executing commands:

- **Change summary**: Shows count of additions, modifications, and deletions
- **Diff view**: Visual comparison of original vs modified content
- **User confirmation**: Requires explicit approval before applying changes
- **Single or batch preview**: Supports previewing individual or multiple changes

### 2. Real-Time Progress Updates

The `ProgressTracker` provides detailed progress information:

- **Percentage tracking**: Shows completion percentage (0-100%)
- **Step-by-step progress**: Tracks progress through multiple steps
- **Estimated time remaining**: Calculates and displays time estimates
- **Status messages**: Provides detailed messages for each step

### 3. Detailed Status Messages

The `StatusReporter` provides comprehensive status reporting:

- **Multiple levels**: Info, success, warning, and error levels
- **Status bar integration**: Updates VS Code status bar
- **Notifications**: Shows user-friendly notifications
- **Duration tracking**: Reports how long operations took

### 4. Estimated Completion Time

Progress tracker automatically calculates:

- **Time estimates**: Based on elapsed time and progress
- **Step duration tracking**: Learns from previous steps for better estimates
- **Human-readable format**: Displays time in seconds, minutes, etc.

### 5. Pause/Resume Operations

The `TaskQueue` supports pausing and resuming:

- **Queue pause**: Pause all queued tasks
- **Task cancellation**: Cancel specific tasks
- **Resume support**: Resume paused operations
- **Status tracking**: Track task status (pending, running, paused, completed, failed, cancelled)

### 6. Background Task Queue

The `TaskQueue` manages background task execution:

- **Priority-based**: Tasks can have priorities for ordering
- **Sequential execution**: Processes one task at a time
- **Event-driven**: Emits events for task lifecycle
- **Result tracking**: Stores results for completed tasks

### 7. Notification System for Completion

Automatic notifications when operations complete:

- **Success notifications**: Shows completion with duration
- **Error notifications**: Shows errors with retry options
- **Status bar updates**: Updates status bar with results
- **Action buttons**: Provides actionable buttons (Retry, Dismiss, etc.)

## Usage

### Progress Tracking

```typescript
import { ProgressTracker } from './execution';

const tracker = new ProgressTracker();
tracker.start(4, 'Starting operation...');

tracker.onProgressUpdate((update) => {
  console.log(`${update.percentage}% - ${update.message}`);
  if (update.estimatedTimeRemaining) {
    console.log(`Estimated time: ${tracker.formatTimeRemaining(update.estimatedTimeRemaining)}`);
  }
});

tracker.nextStep('Step 1 complete');
tracker.update(50, 'Halfway there...');
tracker.complete('Operation complete');
```

### Task Queue

```typescript
import { TaskQueue, Task } from './execution';

const queue = new TaskQueue();

const task: Task = {
  id: 'task-1',
  name: 'Scan Schema',
  description: 'Scanning for schema mismatches',
  priority: 10,
  execute: async (progress, cancellationToken) => {
    progress.start(3, 'Starting scan...');
    // ... perform scan
    progress.complete('Scan complete');
  },
};

queue.enqueue(task);

// Pause/resume
queue.pause();
queue.resume();

// Cancel specific task
queue.cancelTask('task-1');
```

### Preview Manager

```typescript
import { PreviewManager, PreviewChange } from './execution';

const previewManager = new PreviewManager();

const changes: PreviewChange[] = [
  {
    type: 'modify',
    filePath: 'schema.prisma',
    originalContent: 'model User { id Int }',
    modifiedContent: 'model User { id Int email String }',
    description: 'Add email field to User model',
  },
];

const result = await previewManager.showPreview(changes);
if (result.approved) {
  // Apply changes
}
```

### Status Reporter

```typescript
import { StatusReporter, StatusLevel } from './execution';

const reporter = new StatusReporter();

reporter.report({
  level: StatusLevel.INFO,
  message: 'Operation started',
  details: 'Scanning workspace...',
});

reporter.reportProgress({
  percentage: 50,
  message: 'Processing...',
  estimatedTimeRemaining: 5000,
});

reporter.reportCompletion('Operation complete', 10000);
```

## Integration

The execution enhancements are integrated into `DevSyncCommands`:

- **Scan command**: Uses progress tracker and status reporter
- **Migration generation**: Uses progress tracker with preview support
- **Task queue**: Available for background operations
- **Status reporting**: All commands report status automatically

## Future Enhancements

- Progress persistence across extension restarts
- Task history and replay
- Parallel task execution
- Progress estimation based on historical data
- Custom progress UI components

