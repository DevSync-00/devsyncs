/**
 * Background task queue for command execution.
 * 
 * Manages queued tasks, allows pause/resume, and provides
 * execution status tracking.
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'vscode';
import { ProgressTracker, ProgressUpdate } from './progressTracker';

/**
 * Task status.
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Task definition.
 */
export interface Task {
  id: string;
  name: string;
  description?: string;
  execute: (progress: ProgressTracker, cancellationToken: vscode.CancellationToken) => Promise<void>;
  priority?: number;
  estimatedDuration?: number;
}

/**
 * Task execution result.
 */
export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  error?: Error;
  duration: number;
}

/**
 * Task queue events.
 */
export interface TaskQueueEvents {
  taskStarted: { taskId: string; task: Task };
  taskCompleted: TaskResult;
  taskFailed: TaskResult;
  taskPaused: { taskId: string };
  taskResumed: { taskId: string };
  queueEmpty: void;
}

/**
 * Background task queue manager.
 */
export class TaskQueue {
  private queue: Task[] = [];
  private runningTask: { task: Task; tracker: ProgressTracker; cancellationToken: vscode.CancellationTokenSource } | null = null;
  private taskResults: Map<string, TaskResult> = new Map();
  private isPaused = false;

  private readonly onTaskStartedEmitter = new EventEmitter<{ taskId: string; task: Task }>();
  public readonly onTaskStarted = this.onTaskStartedEmitter.event;

  private readonly onTaskCompletedEmitter = new EventEmitter<TaskResult>();
  public readonly onTaskCompleted = this.onTaskCompletedEmitter.event;

  private readonly onTaskFailedEmitter = new EventEmitter<TaskResult>();
  public readonly onTaskFailed = this.onTaskFailedEmitter.event;

  private readonly onTaskPausedEmitter = new EventEmitter<{ taskId: string }>();
  public readonly onTaskPaused = this.onTaskPausedEmitter.event;

  private readonly onTaskResumedEmitter = new EventEmitter<{ taskId: string }>();
  public readonly onTaskResumed = this.onTaskResumedEmitter.event;

  private readonly onQueueEmptyEmitter = new EventEmitter<void>();
  public readonly onQueueEmpty = this.onQueueEmptyEmitter.event;

  /**
   * Adds a task to the queue.
   */
  enqueue(task: Task): void {
    // Insert based on priority (higher priority first)
    const priority = task.priority || 0;
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if ((this.queue[i].priority || 0) < priority) {
        insertIndex = i;
        break;
      }
    }
    this.queue.splice(insertIndex, 0, task);

    // Start processing if not already running
    if (!this.runningTask && !this.isPaused) {
      this.processNext();
    }
  }

  /**
   * Processes the next task in the queue.
   */
  private async processNext(): Promise<void> {
    if (this.isPaused || this.queue.length === 0) {
      if (this.queue.length === 0 && !this.runningTask) {
        this.onQueueEmptyEmitter.fire();
      }
      return;
    }

    const task = this.queue.shift()!;
    const cancellationToken = new vscode.CancellationTokenSource();
    const tracker = new ProgressTracker();

    this.runningTask = { task, tracker, cancellationToken };

    this.onTaskStartedEmitter.fire({ taskId: task.id, task });

    const startTime = Date.now();

    try {
      await task.execute(tracker, cancellationToken.token);
      
      const duration = Date.now() - startTime;
      const result: TaskResult = {
        taskId: task.id,
        status: TaskStatus.COMPLETED,
        duration,
      };
      
      this.taskResults.set(task.id, result);
      this.onTaskCompletedEmitter.fire(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: TaskResult = {
        taskId: task.id,
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
      };
      
      this.taskResults.set(task.id, result);
      this.onTaskFailedEmitter.fire(result);
    } finally {
      this.runningTask = null;
      tracker.complete();
      
      // Process next task
      this.processNext();
    }
  }

  /**
   * Pauses the queue.
   */
  pause(): void {
    if (this.isPaused) {
      return;
    }

    this.isPaused = true;

    if (this.runningTask) {
      this.runningTask.cancellationToken.cancel();
      this.onTaskPausedEmitter.fire({ taskId: this.runningTask.task.id });
    }
  }

  /**
   * Resumes the queue.
   */
  resume(): void {
    if (!this.isPaused) {
      return;
    }

    this.isPaused = false;

    if (this.runningTask) {
      this.onTaskResumedEmitter.fire({ taskId: this.runningTask.task.id });
    } else {
      this.processNext();
    }
  }

  /**
   * Cancels a specific task.
   */
  cancelTask(taskId: string): boolean {
    if (this.runningTask && this.runningTask.task.id === taskId) {
      this.runningTask.cancellationToken.cancel();
      const result: TaskResult = {
        taskId,
        status: TaskStatus.CANCELLED,
        duration: 0,
      };
      this.taskResults.set(taskId, result);
      this.runningTask = null;
      this.processNext();
      return true;
    }

    // Remove from queue if not running
    const index = this.queue.findIndex(t => t.id === taskId);
    if (index >= 0) {
      this.queue.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Gets the current running task.
   */
  getRunningTask(): Task | null {
    return this.runningTask?.task || null;
  }

  /**
   * Gets queue length.
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Gets task result.
   */
  getTaskResult(taskId: string): TaskResult | undefined {
    return this.taskResults.get(taskId);
  }

  /**
   * Clears the queue.
   */
  clear(): void {
    this.queue = [];
    if (this.runningTask) {
      this.runningTask.cancellationToken.cancel();
      this.runningTask = null;
    }
  }

  /**
   * Gets queue status.
   */
  getStatus(): {
    isPaused: boolean;
    queueLength: number;
    runningTask: Task | null;
  } {
    return {
      isPaused: this.isPaused,
      queueLength: this.queue.length,
      runningTask: this.getRunningTask(),
    };
  }
}

