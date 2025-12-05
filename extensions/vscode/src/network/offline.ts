/**
 * Offline mode with sync system.
 * 
 * Queues requests when offline and syncs them when connection is restored.
 */

import { EventEmitter } from 'events';

/**
 * Queued request.
 */
export interface QueuedRequest {
  /** Request ID */
  id: string;
  /** Request method */
  method: string;
  /** Request URL */
  url: string;
  /** Request body */
  body?: any;
  /** Request headers */
  headers?: Record<string, string>;
  /** Timestamp */
  timestamp: number;
  /** Retry count */
  retryCount: number;
}

/**
 * Offline options.
 */
export interface OfflineOptions {
  /** Maximum queue size */
  maxQueueSize?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Maximum retries */
  maxRetries?: number;
  /** Storage key for persistence */
  storageKey?: string;
}

/**
 * Offline manager with sync.
 */
export class OfflineManager extends EventEmitter {
  private queue: QueuedRequest[] = [];
  private isOnline = navigator.onLine;
  private isSyncing = false;
  private options: Required<OfflineOptions>;
  private storage: Storage | null = null;

  constructor(
    private requestFn: (request: QueuedRequest) => Promise<any>,
    options: OfflineOptions = {}
  ) {
    super();
    this.options = {
      maxQueueSize: options.maxQueueSize ?? 100,
      retryDelay: options.retryDelay ?? 1000,
      maxRetries: options.maxRetries ?? 3,
      storageKey: options.storageKey ?? 'devsync-offline-queue',
    };

    // Try to get storage (localStorage in browser, or VS Code globalState)
    try {
      if (typeof localStorage !== 'undefined') {
        this.storage = localStorage;
      }
    } catch {
      // Storage not available
    }

    // Load queue from storage
    this.loadQueue();

    // Listen to online/offline events (browser only)
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    } else {
      // In Node.js/VS Code, assume online by default
      // Can be updated manually via setOnlineStatus()
      this.isOnline = true;
    }

    // Start sync if online
    if (this.isOnline) {
      this.sync();
    }
  }

  /**
   * Executes a request (queues if offline).
   */
  async execute<T>(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount'>): Promise<T> {
    const queuedRequest: QueuedRequest = {
      ...request,
      id: this.generateRequestId(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    if (this.isOnline) {
      try {
        const result = await this.requestFn(queuedRequest);
        return result as T;
      } catch (error) {
        // Queue on error if network-related
        if (this.isNetworkError(error)) {
          this.queueRequest(queuedRequest);
          throw new Error('Request failed and queued for retry');
        }
        throw error;
      }
    } else {
      // Queue if offline
      this.queueRequest(queuedRequest);
      throw new Error('Request queued (offline)');
    }
  }

  /**
   * Queues a request.
   */
  private queueRequest(request: QueuedRequest): void {
    if (this.queue.length >= this.options.maxQueueSize) {
      // Remove oldest request
      this.queue.shift();
    }

    this.queue.push(request);
    this.saveQueue();
    this.emit('queued', request);
  }

  /**
   * Syncs queued requests.
   */
  async sync(): Promise<void> {
    if (!this.isOnline || this.isSyncing || this.queue.length === 0) {
      return;
    }

    this.isSyncing = true;
    this.emit('syncing');

    const requests = [...this.queue];
    this.queue = [];

    const results: Array<{ request: QueuedRequest; success: boolean; error?: Error }> = [];

    for (const request of requests) {
      try {
        await this.requestFn(request);
        results.push({ request, success: true });
        this.emit('synced', request);
      } catch (error) {
        request.retryCount++;
        if (request.retryCount < this.options.maxRetries) {
          // Re-queue for retry
          this.queue.push(request);
          results.push({ request, success: false, error: error as Error });
        } else {
          // Max retries reached
          results.push({ request, success: false, error: error as Error });
          this.emit('syncFailed', request, error);
        }
      }
    }

    this.saveQueue();
    this.isSyncing = false;
    this.emit('syncComplete', results);
  }

  /**
   * Handles online event.
   */
  private handleOnline(): void {
    this.isOnline = true;
    this.emit('online');
    this.sync();
  }

  /**
   * Handles offline event.
   */
  private handleOffline(): void {
    this.isOnline = false;
    this.emit('offline');
  }

  /**
   * Checks if error is network-related.
   */
  private isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('network') ||
        error.message.includes('fetch') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      );
    }
    return false;
  }

  /**
   * Loads queue from storage.
   */
  private loadQueue(): void {
    if (!this.storage) {
      return;
    }

    try {
      const stored = this.storage.getItem(this.options.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load offline queue:', error);
    }
  }

  /**
   * Saves queue to storage.
   */
  private saveQueue(): void {
    if (!this.storage) {
      return;
    }

    try {
      this.storage.setItem(this.options.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.warn('Failed to save offline queue:', error);
    }
  }

  /**
   * Generates a unique request ID.
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gets queue size.
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clears queue.
   */
  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
    this.emit('queueCleared');
  }

  /**
   * Checks if online.
   */
  getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Checks if syncing.
   */
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Manually sets online status (for Node.js/VS Code environments).
   */
  setOnlineStatus(isOnline: boolean): void {
    if (this.isOnline !== isOnline) {
      this.isOnline = isOnline;
      if (isOnline) {
        this.handleOnline();
      } else {
        this.handleOffline();
      }
    }
  }
}

