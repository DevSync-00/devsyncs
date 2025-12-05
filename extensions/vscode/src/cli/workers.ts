/**
 * Worker threads for heavy CLI operations.
 * 
 * Provides capabilities to offload heavy operations to worker threads.
 */

import { Worker } from 'worker_threads';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Worker task.
 */
export interface WorkerTask<T> {
  /** Task ID */
  id: string;
  /** Task data */
  data: T;
}

/**
 * Worker result.
 */
export interface WorkerResult<T> {
  /** Task ID */
  id: string;
  /** Result data */
  result?: T;
  /** Error */
  error?: Error;
}

/**
 * Worker manager for heavy operations.
 */
export class WorkerManager {
  private workers: Map<string, Worker> = new Map();
  private maxWorkers = 2; // Limit concurrent workers

  /**
   * Executes a task in a worker thread.
   */
  async executeInWorker<TInput, TOutput>(
    taskId: string,
    workerScript: string,
    data: TInput
  ): Promise<TOutput> {
    return new Promise<TOutput>((resolve, reject) => {
      // Check worker limit
      if (this.workers.size >= this.maxWorkers) {
        reject(new Error('Maximum number of workers reached'));
        return;
      }

      const worker = new Worker(workerScript, {
        workerData: { id: taskId, data },
      });

      this.workers.set(taskId, worker);

      worker.on('message', (result: WorkerResult<TOutput>) => {
        if (result.id === taskId) {
          if (result.error) {
            reject(new Error(result.error.message));
          } else {
            resolve(result.result as TOutput);
          }
          this.cleanupWorker(taskId);
        }
      });

      worker.on('error', (error) => {
        this.cleanupWorker(taskId);
        reject(error);
      });

      worker.on('exit', (code) => {
        this.cleanupWorker(taskId);
        if (code !== 0) {
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Cancels a worker task.
   */
  cancelWorker(taskId: string): boolean {
    const worker = this.workers.get(taskId);
    if (worker) {
      worker.terminate();
      this.cleanupWorker(taskId);
      return true;
    }
    return false;
  }

  /**
   * Cleans up a worker.
   */
  private cleanupWorker(taskId: string): void {
    const worker = this.workers.get(taskId);
    if (worker) {
      worker.terminate();
      this.workers.delete(taskId);
    }
  }

  /**
   * Terminates all workers.
   */
  terminateAll(): void {
    for (const [id, worker] of this.workers.entries()) {
      worker.terminate();
    }
    this.workers.clear();
  }

  /**
   * Gets active worker count.
   */
  getActiveWorkerCount(): number {
    return this.workers.size;
  }
}

/**
 * Creates a worker script path.
 */
export function getWorkerScriptPath(scriptName: string): string {
  // In VS Code extension, workers should be in the out directory
  return path.join(__dirname, '..', 'workers', `${scriptName}.js`);
}

