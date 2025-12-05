/**
 * Request queuing system.
 * 
 * Queues requests and processes them in order with rate limiting.
 */

import { EventEmitter } from 'events';

/**
 * Queued request.
 */
export interface QueuedRequestItem {
  /** Request ID */
  id: string;
  /** Request function */
  requestFn: () => Promise<any>;
  /** Priority (higher = more important) */
  priority?: number;
  /** Timestamp */
  timestamp: number;
  /** Resolve function */
  resolve: (value: any) => void;
  /** Reject function */
  reject: (error: Error) => void;
}

/**
 * Queue options.
 */
export interface QueueOptions {
  /** Maximum concurrent requests */
  maxConcurrent?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Rate limit (requests per second) */
  rateLimit?: number;
}

/**
 * Request queue manager.
 */
export class RequestQueue extends EventEmitter {
  private queue: QueuedRequestItem[] = [];
  private processing: Set<string> = new Set();
  private options: Required<QueueOptions>;
  private rateLimiter: RateLimiter;

  constructor(options: QueueOptions = {}) {
    super();
    this.options = {
      maxConcurrent: options.maxConcurrent ?? 5,
      timeout: options.timeout ?? 30000,
      rateLimit: options.rateLimit ?? 10,
    };
    this.rateLimiter = new RateLimiter(this.options.rateLimit);
  }

  /**
   * Adds a request to the queue.
   */
  async enqueue<T>(
    requestFn: () => Promise<T>,
    priority = 0
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = this.generateRequestId();
      const item: QueuedRequestItem = {
        id,
        requestFn,
        priority,
        timestamp: Date.now(),
        resolve: resolve as (value: T) => void,
        reject,
      };

      // Insert based on priority
      const insertIndex = this.queue.findIndex((q) => (q.priority || 0) < priority);
      if (insertIndex === -1) {
        this.queue.push(item);
      } else {
        this.queue.splice(insertIndex, 0, item);
      }

      this.emit('enqueued', item);
      this.process();
    });
  }

  /**
   * Processes the queue.
   */
  private async process(): Promise<void> {
    // Check if we can process more
    if (this.processing.size >= this.options.maxConcurrent) {
      return;
    }

    // Get next item
    const item = this.queue.shift();
    if (!item) {
      return;
    }

    // Wait for rate limit
    await this.rateLimiter.wait();

    // Process request
    this.processing.add(item.id);
    this.emit('processing', item);

    const timeoutId = setTimeout(() => {
      this.processing.delete(item.id);
      item.reject(new Error('Request timeout'));
      this.process();
    }, this.options.timeout);

    try {
      const result = await item.requestFn();
      clearTimeout(timeoutId);
      this.processing.delete(item.id);
      item.resolve(result);
      this.emit('completed', item);
    } catch (error) {
      clearTimeout(timeoutId);
      this.processing.delete(item.id);
      item.reject(error instanceof Error ? error : new Error(String(error)));
      this.emit('failed', item, error);
    } finally {
      // Process next item
      this.process();
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
   * Gets processing count.
   */
  getProcessingCount(): number {
    return this.processing.size;
  }

  /**
   * Clears the queue.
   */
  clear(): void {
    this.queue.forEach((item) => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    this.emit('cleared');
  }
}

/**
 * Rate limiter.
 */
class RateLimiter {
  private requests: number[] = [];
  private rateLimit: number;

  constructor(rateLimit: number) {
    this.rateLimit = rateLimit;
  }

  /**
   * Waits if rate limit is exceeded.
   */
  async wait(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 1000; // 1 second window

    // Remove old requests
    this.requests = this.requests.filter((time) => time > windowStart);

    // Check if we need to wait
    if (this.requests.length >= this.rateLimit) {
      const oldestRequest = this.requests[0];
      const waitTime = 1000 - (now - oldestRequest);
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    // Record this request
    this.requests.push(Date.now());
  }
}

