/**
 * Background processing for CLI commands.
 * 
 * Provides capabilities to run CLI commands in the background without blocking the UI.
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';

/**
 * Background task status.
 */
export enum BackgroundTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Background task.
 */
export interface BackgroundTask {
  /** Task ID */
  id: string;
  /** Task name */
  name: string;
  /** Task status */
  status: BackgroundTaskStatus;
  /** Start time */
  startTime?: Date;
  /** End time */
  endTime?: Date;
  /** Progress percentage */
  progress?: number;
  /** Output so far */
  output?: string;
  /** Error message */
  error?: string;
}

/**
 * Background processor.
 */
export class BackgroundProcessor extends EventEmitter {
  private tasks: Map<string, BackgroundTask> = new Map();
  private maxConcurrentTasks = 3;

  /**
   * Executes a task in the background.
   */
  async executeBackground<T>(
    id: string,
    name: string,
    task: () => Promise<T>
  ): Promise<T> {
    const backgroundTask: BackgroundTask = {
      id,
      name,
      status: BackgroundTaskStatus.PENDING,
    };

    this.tasks.set(id, backgroundTask);

    try {
      backgroundTask.status = BackgroundTaskStatus.RUNNING;
      backgroundTask.startTime = new Date();
      this.emit('taskStarted', backgroundTask);

      const result = await task();

      backgroundTask.status = BackgroundTaskStatus.COMPLETED;
      backgroundTask.endTime = new Date();
      backgroundTask.progress = 100;
      this.emit('taskCompleted', backgroundTask);

      return result;
    } catch (error) {
      backgroundTask.status = BackgroundTaskStatus.FAILED;
      backgroundTask.endTime = new Date();
      backgroundTask.error = error instanceof Error ? error.message : String(error);
      this.emit('taskFailed', backgroundTask);
      throw error;
    } finally {
      this.tasks.set(id, backgroundTask);
    }
  }

  /**
   * Cancels a background task.
   */
  cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (task && task.status === BackgroundTaskStatus.RUNNING) {
      task.status = BackgroundTaskStatus.CANCELLED;
      task.endTime = new Date();
      this.emit('taskCancelled', task);
      return true;
    }
    return false;
  }

  /**
   * Gets task status.
   */
  getTaskStatus(id: string): BackgroundTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Gets all tasks.
   */
  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Gets running tasks.
   */
  getRunningTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values()).filter(
      (task) => task.status === BackgroundTaskStatus.RUNNING
    );
  }

  /**
   * Clears completed tasks.
   */
  clearCompleted(): void {
    for (const [id, task] of this.tasks.entries()) {
      if (
        task.status === BackgroundTaskStatus.COMPLETED ||
        task.status === BackgroundTaskStatus.FAILED ||
        task.status === BackgroundTaskStatus.CANCELLED
      ) {
        this.tasks.delete(id);
      }
    }
  }
}

