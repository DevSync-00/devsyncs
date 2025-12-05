/**
 * Optimized HTTP client with batching, deduplication, queuing, retry, and pooling.
 * 
 * Provides comprehensive network optimizations including:
 * - Request batching
 * - Request deduplication
 * - Offline mode with sync
 * - Request queuing
 * - Retry with exponential backoff
 * - Connection pooling
 */

import { RequestBatcher, BatchOptions } from './batching';
import { RequestDeduplication, DeduplicationOptions } from './deduplication';
import { OfflineManager, OfflineOptions } from './offline';
import { RequestQueue, QueueOptions } from './queue';
import { RetryManager, RetryOptions } from './retry';
import { ConnectionPool, PoolOptions } from './pooling';
import { requestJson, HttpRequestError, JsonRequestInit } from '../lib/http';

/**
 * Optimized client options.
 */
export interface OptimizedClientOptions {
  /** Batch options */
  batch?: BatchOptions;
  /** Deduplication options */
  deduplication?: DeduplicationOptions;
  /** Offline options */
  offline?: OfflineOptions;
  /** Queue options */
  queue?: QueueOptions;
  /** Retry options */
  retry?: RetryOptions;
  /** Pool options */
  pool?: PoolOptions;
  /** Base URL */
  baseUrl?: string;
  /** Default headers */
  defaultHeaders?: Record<string, string>;
}

/**
 * Optimized HTTP client.
 */
export class OptimizedHttpClient {
  private batcher: RequestBatcher;
  private deduplication: RequestDeduplication;
  private offlineManager: OfflineManager;
  private queue: RequestQueue;
  private retryManager: RetryManager;
  private pool: ConnectionPool;
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(options: OptimizedClientOptions = {}) {
    this.baseUrl = options.baseUrl || '';
    this.defaultHeaders = options.defaultHeaders || {};

    // Initialize components
    this.deduplication = new RequestDeduplication(options.deduplication);
    this.queue = new RequestQueue(options.queue);
    this.retryManager = new RetryManager(options.retry);
    this.pool = new ConnectionPool(options.pool);

    // Initialize batcher
    this.batcher = new RequestBatcher(
      async (requests) => {
        // Execute batch requests
        const results = new Map();
        for (const request of requests) {
          try {
            const result = await this.executeRequest(request);
            results.set(request.id, result);
          } catch (error) {
            results.set(request.id, error instanceof Error ? error : new Error(String(error)));
          }
        }
        return results;
      },
      options.batch
    );

    // Initialize offline manager
    this.offlineManager = new OfflineManager(
      async (request) => {
        return this.executeRequest(request);
      },
      options.offline
    );
  }

  /**
   * Executes a request with all optimizations.
   */
  async request<T>(
    url: string,
    init: JsonRequestInit = {}
  ): Promise<T> {
    const fullUrl = this.buildUrl(url);
    const method = init.method || 'GET';

    // Use connection pool
    const pooledUrl = this.pool.getConnection(fullUrl);

    // Combine headers
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
    };
    
    // Convert Headers object to Record if needed
    if (init.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (typeof init.headers === 'object') {
        // Handle Record<string, string> or string[][]
        if (Array.isArray(init.headers)) {
          // Headers as array of tuples
          init.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          // Headers as object
          Object.assign(headers, init.headers);
        }
      }
    }

    // Execute with deduplication, queue, and retry
    return this.deduplication.execute(
      method,
      pooledUrl,
      () =>
        this.queue.enqueue(() =>
          this.retryManager.execute(() =>
            this.offlineManager.execute({
              method,
              url: pooledUrl,
              body: init.json,
              headers,
            })
          )
        ),
      init.json
    );
  }

  /**
   * Executes a batched request.
   */
  async batchedRequest<T>(
    url: string,
    init: JsonRequestInit = {}
  ): Promise<T> {
    const fullUrl = this.buildUrl(url);
    const method = init.method || 'GET';

    // Combine headers
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
    };
    
    // Convert Headers object to Record if needed
    if (init.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (typeof init.headers === 'object') {
        // Handle Record<string, string> or string[][]
        if (Array.isArray(init.headers)) {
          // Headers as array of tuples
          init.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          // Headers as object
          Object.assign(headers, init.headers);
        }
      }
    }

    return this.batcher.addRequest<T>({
      method,
      url: fullUrl,
      body: init.json,
      headers,
    });
  }

  /**
   * Executes a raw request (without optimizations).
   */
  private async executeRequest(request: {
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
  }): Promise<any> {
    const init: JsonRequestInit = {
      method: request.method as any,
      headers: request.headers,
      json: request.body,
    };

    return requestJson(request.url, init);
  }

  /**
   * Builds full URL.
   */
  private buildUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${this.baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
  }

  /**
   * Syncs offline queue.
   */
  async sync(): Promise<void> {
    return this.offlineManager.sync();
  }

  /**
   * Gets queue size.
   */
  getQueueSize(): number {
    return this.queue.getQueueSize() + this.offlineManager.getQueueSize();
  }

  /**
   * Flushes batcher.
   */
  async flush(): Promise<void> {
    return this.batcher.flush();
  }

  /**
   * Clears all queues.
   */
  clear(): void {
    this.batcher.clear();
    this.queue.clear();
    this.offlineManager.clearQueue();
    this.deduplication.clear();
  }

  /**
   * Disposes the client.
   */
  dispose(): void {
    this.clear();
    this.pool.dispose();
  }
}

