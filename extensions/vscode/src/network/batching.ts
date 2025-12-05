/**
 * Request batching system.
 * 
 * Combines multiple API requests into a single batch request to reduce network overhead.
 */

/**
 * Batched request.
 */
export interface BatchedRequest<T = any> {
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
  /** Resolve function */
  resolve: (value: T) => void;
  /** Reject function */
  reject: (error: Error) => void;
}

/**
 * Batch options.
 */
export interface BatchOptions {
  /** Maximum batch size */
  maxBatchSize?: number;
  /** Maximum wait time in milliseconds before sending batch */
  maxWaitTime?: number;
  /** Batch endpoint URL */
  batchEndpoint?: string;
}

/**
 * Request batcher.
 */
export class RequestBatcher {
  private queue: BatchedRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private options: Required<BatchOptions>;

  constructor(
    private batchFn: (requests: BatchedRequest[]) => Promise<Map<string, any>>,
    options: BatchOptions = {}
  ) {
    this.options = {
      maxBatchSize: options.maxBatchSize ?? 10,
      maxWaitTime: options.maxWaitTime ?? 50,
      batchEndpoint: options.batchEndpoint ?? '/api/batch',
    };
  }

  /**
   * Adds a request to the batch queue.
   */
  async addRequest<T>(request: Omit<BatchedRequest<T>, 'resolve' | 'reject' | 'id'>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = this.generateRequestId();
      const batchedRequest: BatchedRequest<T> = {
        ...request,
        id,
        resolve: resolve as (value: T) => void,
        reject,
      };

      this.queue.push(batchedRequest);

      // Send batch if queue is full
      if (this.queue.length >= this.options.maxBatchSize) {
        this.flush();
      } else {
        // Schedule batch send
        this.scheduleBatch();
      }
    });
  }

  /**
   * Schedules batch send.
   */
  private scheduleBatch(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.flush();
    }, this.options.maxWaitTime);
  }

  /**
   * Flushes the batch queue.
   */
  async flush(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.options.maxBatchSize);
    
    try {
      const results = await this.batchFn(batch);
      
      // Resolve/reject each request
      batch.forEach((request) => {
        const result = results.get(request.id);
        if (result instanceof Error) {
          request.reject(result);
        } else {
          request.resolve(result);
        }
      });
    } catch (error) {
      // Reject all requests on batch failure
      batch.forEach((request) => {
        request.reject(error instanceof Error ? error : new Error(String(error)));
      });
    }

    // Process remaining requests
    if (this.queue.length > 0) {
      this.scheduleBatch();
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
   * Clears the queue.
   */
  clear(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.queue.forEach((request) => {
      request.reject(new Error('Batch queue cleared'));
    });
    this.queue = [];
  }
}

