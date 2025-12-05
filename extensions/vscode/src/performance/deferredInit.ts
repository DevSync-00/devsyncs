/**
 * Deferred initialization system.
 * 
 * Provides capabilities to defer non-critical initialization until after startup.
 */

import * as vscode from 'vscode';

/**
 * Initialization priority.
 */
export enum InitPriority {
  /** Critical - must be initialized immediately */
  CRITICAL = 0,
  /** High - should be initialized soon after startup */
  HIGH = 1,
  /** Normal - can be initialized when idle */
  NORMAL = 2,
  /** Low - can be deferred until needed */
  LOW = 3,
}

/**
 * Initialization task.
 */
export interface InitTask {
  /** Task name */
  name: string;
  /** Task priority */
  priority: InitPriority;
  /** Task function */
  task: () => Promise<void> | void;
  /** Whether task has been executed */
  executed?: boolean;
}

/**
 * Deferred initialization manager.
 */
export class DeferredInitManager {
  private static tasks: InitTask[] = [];
  private static executing = false;
  private static idleTimeout: NodeJS.Timeout | null = null;

  /**
   * Registers a deferred initialization task.
   */
  static register(task: InitTask): void {
    this.tasks.push(task);
    this.tasks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Executes all tasks of a given priority or higher.
   */
  static async executeUpTo(priority: InitPriority): Promise<void> {
    const tasksToExecute = this.tasks.filter(
      (task) => !task.executed && task.priority <= priority
    );

    for (const task of tasksToExecute) {
      try {
        await task.task();
        task.executed = true;
      } catch (error) {
        console.error(`Failed to execute initialization task ${task.name}:`, error);
      }
    }
  }

  /**
   * Executes all deferred tasks.
   */
  static async executeAll(): Promise<void> {
    await this.executeUpTo(InitPriority.LOW);
  }

  /**
   * Executes critical tasks immediately.
   */
  static async executeCritical(): Promise<void> {
    await this.executeUpTo(InitPriority.CRITICAL);
  }

  /**
   * Executes high priority tasks.
   */
  static async executeHigh(): Promise<void> {
    await this.executeUpTo(InitPriority.HIGH);
  }

  /**
   * Executes normal priority tasks when idle.
   */
  static scheduleIdleExecution(context: vscode.ExtensionContext): void {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }

    // Execute normal priority tasks after a delay
    this.idleTimeout = setTimeout(() => {
      this.executeUpTo(InitPriority.NORMAL).catch((error) => {
        console.error('Failed to execute idle initialization tasks:', error);
      });
    }, 2000); // 2 seconds after startup

    context.subscriptions.push({
      dispose: () => {
        if (this.idleTimeout) {
          clearTimeout(this.idleTimeout);
        }
      },
    });
  }

  /**
   * Gets execution status.
   */
  static getStatus(): {
    total: number;
    executed: number;
    pending: number;
    byPriority: Record<InitPriority, number>;
  } {
    const byPriority: Record<InitPriority, number> = {
      [InitPriority.CRITICAL]: 0,
      [InitPriority.HIGH]: 0,
      [InitPriority.NORMAL]: 0,
      [InitPriority.LOW]: 0,
    };

    this.tasks.forEach((task) => {
      if (!task.executed) {
        byPriority[task.priority]++;
      }
    });

    return {
      total: this.tasks.length,
      executed: this.tasks.filter((t) => t.executed).length,
      pending: this.tasks.filter((t) => !t.executed).length,
      byPriority,
    };
  }
}

