/**
 * Background refresh system.
 * 
 * Provides capabilities to refresh data in the background without blocking the UI.
 */

import { EventEmitter } from 'events';

/**
 * Refresh options.
 */
export interface RefreshOptions {
  /** Refresh interval in milliseconds */
  interval?: number;
  /** Whether to refresh immediately */
  immediate?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Background refresh manager.
 */
export class BackgroundRefreshManager<T> extends EventEmitter {
  private refreshFn: () => Promise<T>;
  private options: Required<RefreshOptions>;
  private intervalId: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private retryCount = 0;
  private lastRefreshTime: number | null = null;
  private lastData: T | null = null;

  constructor(refreshFn: () => Promise<T>, options: RefreshOptions = {}) {
    super();
    this.refreshFn = refreshFn;
    this.options = {
      interval: options.interval ?? 60000, // 1 minute default
      immediate: options.immediate ?? false,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
    };
  }

  /**
   * Starts background refresh.
   */
  start(): void {
    if (this.intervalId) {
      return; // Already started
    }

    if (this.options.immediate) {
      this.refresh();
    }

    this.intervalId = setInterval(() => {
      this.refresh();
    }, this.options.interval);
  }

  /**
   * Stops background refresh.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Refreshes data.
   */
  async refresh(): Promise<T | null> {
    if (this.isRefreshing) {
      return this.lastData;
    }

    this.isRefreshing = true;
    this.emit('refreshing');

    try {
      const data = await this.refreshFn();
      this.lastData = data;
      this.lastRefreshTime = Date.now();
      this.retryCount = 0;
      this.emit('refreshed', data);
      return data;
    } catch (error) {
      this.retryCount++;
      if (this.retryCount <= this.options.maxRetries) {
        this.emit('retry', this.retryCount, error);
        await new Promise((resolve) => setTimeout(resolve, this.options.retryDelay));
        return this.refresh();
      } else {
        this.emit('error', error);
        throw error;
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Gets last refresh time.
   */
  getLastRefreshTime(): number | null {
    return this.lastRefreshTime;
  }

  /**
   * Gets last data.
   */
  getLastData(): T | null {
    return this.lastData;
  }

  /**
   * Checks if currently refreshing.
   */
  isCurrentlyRefreshing(): boolean {
    return this.isRefreshing;
  }

  /**
   * Updates refresh interval.
   */
  setInterval(interval: number): void {
    this.options.interval = interval;
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }
}

