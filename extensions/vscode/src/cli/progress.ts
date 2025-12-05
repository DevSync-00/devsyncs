/**
 * Progress tracking for CLI commands.
 * 
 * Provides comprehensive progress tracking with callbacks and UI updates.
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';

/**
 * Progress callback.
 */
export type ProgressCallback = (progress: ProgressUpdate) => void;

/**
 * Progress update.
 */
export interface ProgressUpdate {
  /** Current step */
  step: string;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current item */
  current?: number;
  /** Total items */
  total?: number;
  /** Estimated time remaining (seconds) */
  estimatedTimeRemaining?: number;
  /** Status message */
  message?: string;
}

/**
 * Progress tracker for CLI commands.
 */
export class CliProgressTracker extends EventEmitter {
  private progressBar: vscode.Progress<{ message?: string; increment?: number }> | null = null;
  private currentProgress: ProgressUpdate | null = null;
  private startTime: Date | null = null;
  private callbacks: ProgressCallback[] = [];

  /**
   * Starts progress tracking.
   */
  start(
    location: vscode.ProgressLocation,
    title: string,
    cancellable = false
  ): void {
    vscode.window.withProgress(
      {
        location,
        title,
        cancellable,
      },
      async (progress, token) => {
        this.progressBar = progress;
        this.startTime = new Date();

        token.onCancellationRequested(() => {
          this.emit('cancelled');
        });

        // Wait for completion
        return new Promise<void>((resolve) => {
          this.once('complete', () => {
            resolve();
          });
        });
      }
    );
  }

  /**
   * Updates progress.
   */
  update(update: ProgressUpdate): void {
    this.currentProgress = update;

    // Update progress bar
    if (this.progressBar) {
      this.progressBar.report({
        message: update.message || update.step,
        increment: update.percentage - (this.currentProgress?.percentage || 0),
      });
    }

    // Calculate estimated time remaining
    if (this.startTime && update.current && update.total) {
      const elapsed = (Date.now() - this.startTime.getTime()) / 1000;
      const rate = update.current / elapsed;
      const remaining = (update.total - update.current) / rate;
      update.estimatedTimeRemaining = Math.round(remaining);
    }

    // Emit progress event
    this.emit('progress', update);

    // Call registered callbacks
    this.callbacks.forEach((callback) => {
      try {
        callback(update);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    });
  }

  /**
   * Completes progress tracking.
   */
  complete(): void {
    if (this.progressBar && this.currentProgress) {
      this.progressBar.report({ increment: 100 - this.currentProgress.percentage });
    }
    this.emit('complete');
    this.progressBar = null;
    this.currentProgress = null;
    this.startTime = null;
  }

  /**
   * Registers a progress callback.
   */
  onProgress(callback: ProgressCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Removes a progress callback.
   */
  removeProgressCallback(callback: ProgressCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }
}

