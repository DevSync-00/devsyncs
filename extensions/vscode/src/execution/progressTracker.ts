/**
 * Progress tracking for command execution.
 * 
 * Provides real-time progress updates, estimated completion time,
 * and detailed status messages.
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'vscode';

/**
 * Progress update event.
 */
export interface ProgressUpdate {
  /** Current progress percentage (0-100) */
  percentage: number;
  /** Current status message */
  message: string;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
  /** Current step number */
  step?: number;
  /** Total number of steps */
  totalSteps?: number;
}

/**
 * Progress tracker for command execution.
 */
export class ProgressTracker {
  private readonly onProgressUpdateEmitter = new EventEmitter<ProgressUpdate>();
  public readonly onProgressUpdate = this.onProgressUpdateEmitter.event;

  private startTime: number = 0;
  private currentStep: number = 0;
  private totalSteps: number = 0;
  private stepStartTimes: Map<number, number> = new Map();
  private stepDurations: Map<number, number> = new Map();

  /**
   * Starts tracking progress.
   */
  start(totalSteps: number = 1, initialMessage: string = 'Starting...'): void {
    this.startTime = Date.now();
    this.currentStep = 0;
    this.totalSteps = totalSteps;
    this.stepStartTimes.clear();
    this.stepDurations.clear();

    this.update(0, initialMessage);
  }

  /**
   * Updates progress.
   */
  update(percentage: number, message: string, step?: number): void {
    if (step !== undefined) {
      this.currentStep = step;
    }

    const now = Date.now();
    const elapsed = now - this.startTime;

    // Calculate estimated time remaining
    let estimatedTimeRemaining: number | undefined;
    if (percentage > 0 && percentage < 100) {
      const estimatedTotal = (elapsed / percentage) * 100;
      estimatedTimeRemaining = estimatedTotal - elapsed;
    }

    // Update step timing
    if (this.currentStep > 0 && !this.stepStartTimes.has(this.currentStep)) {
      this.stepStartTimes.set(this.currentStep, now);
    }

    this.onProgressUpdateEmitter.fire({
      percentage: Math.min(100, Math.max(0, percentage)),
      message,
      estimatedTimeRemaining,
      step: this.currentStep,
      totalSteps: this.totalSteps,
    });
  }

  /**
   * Advances to the next step.
   */
  nextStep(message: string): void {
    // Record duration of previous step
    if (this.currentStep > 0) {
      const stepStart = this.stepStartTimes.get(this.currentStep) || this.startTime;
      this.stepDurations.set(this.currentStep, Date.now() - stepStart);
    }

    this.currentStep++;
    const percentage = (this.currentStep / this.totalSteps) * 100;
    this.update(percentage, message, this.currentStep);
  }

  /**
   * Completes progress tracking.
   */
  complete(message: string = 'Complete'): void {
    this.update(100, message);
    this.onProgressUpdateEmitter.dispose();
  }

  /**
   * Formats estimated time remaining as human-readable string.
   */
  formatTimeRemaining(ms: number): string {
    if (ms < 1000) {
      return 'less than a second';
    }
    if (ms < 60000) {
      return `${Math.round(ms / 1000)} seconds`;
    }
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Gets average step duration for better estimation.
   */
  getAverageStepDuration(): number {
    if (this.stepDurations.size === 0) {
      return 0;
    }
    const durations = Array.from(this.stepDurations.values());
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }
}

