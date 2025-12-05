# Enhanced CLI Execution

This module provides comprehensive CLI execution improvements for the DevSync VS Code extension, addressing section 2.1 "CLI Execution" from the Performance Optimizations roadmap.

## Features

### 1. Real-Time Output Streaming

Stream CLI output in real-time without blocking:

```typescript
import { EnhancedCliRunner } from './cli';

const runner = new EnhancedCliRunner(outputChannel);

const result = await runner.executeEnhanced('scan', {}, {
  streamOutput: true,
  onChunk: (chunk) => {
    // Process each chunk as it arrives
    console.log('Received chunk:', chunk);
  },
});
```

### 2. Incremental Output Processing

Process output incrementally as it arrives:

```typescript
const result = await runner.executeEnhanced('scan', {}, {
  processIncrementally: true,
  onChunk: async (chunk) => {
    // Parse and process chunk immediately
    await parseChunk(chunk);
  },
});
```

### 3. Chunked Large Response Handling

Handle large outputs by chunking:

```typescript
import { ChunkManager } from './cli';

const chunkManager = new ChunkManager(1024 * 64); // 64KB chunks

await chunkManager.processInChunks(largeOutput, {
  process: async (chunk) => {
    // Process each chunk
  },
  complete: async () => {
    // All chunks processed
  },
});
```

### 4. Background Processing

Run commands in the background:

```typescript
const result = await runner.executeEnhanced('scan', {}, {
  background: true,
});

// Check status
const status = runner.getBackgroundTaskStatus(result.taskId);
```

### 5. Worker Threads for Heavy Operations

Offload heavy operations to worker threads:

```typescript
import { WorkerManager } from './cli';

const workerManager = new WorkerManager();

const result = await workerManager.executeInWorker(
  'scan-task',
  workerScriptPath,
  scanData
);
```

### 6. Progress Callbacks

Track progress with callbacks:

```typescript
const result = await runner.executeEnhanced('scan', {}, {
  onProgress: (progress) => {
    console.log(`Progress: ${progress.percentage}%`);
    console.log(`Step: ${progress.step}`);
    console.log(`Estimated time: ${progress.estimatedTimeRemaining}s`);
  },
});
```

## Usage Example

```typescript
import { EnhancedCliRunner } from './cli';
import * as vscode from 'vscode';

const outputChannel = vscode.window.createOutputChannel('DevSync');
const runner = new EnhancedCliRunner(outputChannel);

// Execute scan with all enhancements
const result = await runner.executeEnhanced(
  'scan',
  { path: workspaceRoot },
  {
    streamOutput: true,
    processIncrementally: true,
    chunkSize: 1024 * 64,
    onProgress: (progress) => {
      vscode.window.setStatusBarMessage(
        `Scanning: ${progress.percentage}%`,
        2000
      );
    },
    onChunk: (chunk) => {
      // Process chunk
    },
  }
);

console.log(`Scan completed in ${result.executionTime}ms`);
console.log(`Progress updates: ${result.progress?.length || 0}`);
```

## Performance Benefits

- **Non-blocking**: Commands run without freezing the UI
- **Real-time feedback**: Users see output as it arrives
- **Memory efficient**: Large outputs are processed in chunks
- **Better UX**: Progress tracking provides clear feedback
- **Scalable**: Worker threads handle heavy operations
- **Responsive**: Background processing keeps UI responsive

## Integration

The enhanced CLI runner can be used as a drop-in replacement for the standard CLI runner:

```typescript
// Before
const result = await cliRunner.executeCliCommand('scan');

// After
const result = await enhancedRunner.executeEnhanced('scan', {}, {
  streamOutput: true,
  processIncrementally: true,
});
```

