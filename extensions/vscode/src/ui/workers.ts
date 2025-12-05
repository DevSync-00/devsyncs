/**
 * Web Workers for heavy computations.
 * 
 * Provides utilities to offload heavy computations to Web Workers
 * to keep the UI responsive.
 */

/**
 * Worker message.
 */
export interface WorkerMessage<T = any> {
  /** Message ID */
  id: string;
  /** Message type */
  type: string;
  /** Message data */
  data: T;
}

/**
 * Worker response.
 */
export interface WorkerResponse<T = any> {
  /** Message ID */
  id: string;
  /** Success status */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message */
  error?: string;
}

/**
 * Worker task.
 */
export interface WorkerTask<TInput = any, TOutput = any> {
  /** Task ID */
  id: string;
  /** Task input */
  input: TInput;
  /** Resolve function */
  resolve: (value: TOutput) => void;
  /** Reject function */
  reject: (error: Error) => void;
}

/**
 * Web Worker manager.
 */
export class WebWorkerManager {
  private worker: Worker | null = null;
  private tasks: Map<string, WorkerTask> = new Map();
  private taskIdCounter = 0;

  constructor(workerScript: string | URL) {
    this.worker = new Worker(workerScript);

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const task = this.tasks.get(response.id);

      if (task) {
        this.tasks.delete(response.id);

        if (response.success && response.data !== undefined) {
          task.resolve(response.data);
        } else {
          task.reject(new Error(response.error || 'Worker task failed'));
        }
      }
    };

    this.worker.onerror = (error) => {
      // Reject all pending tasks
      for (const task of this.tasks.values()) {
        task.reject(new Error(`Worker error: ${error.message}`));
      }
      this.tasks.clear();
    };
  }

  /**
   * Executes a task in the worker.
   */
  async execute<TInput = any, TOutput = any>(
    type: string,
    input: TInput
  ): Promise<TOutput> {
    return new Promise<TOutput>((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = `task-${++this.taskIdCounter}`;
      const task: WorkerTask<TInput, TOutput> = {
        id,
        input,
        resolve: resolve as (value: TOutput) => void,
        reject,
      };

      this.tasks.set(id, task);

      const message: WorkerMessage<TInput> = {
        id,
        type,
        data: input,
      };

      this.worker.postMessage(message);
    });
  }

  /**
   * Terminates the worker.
   */
  terminate(): void {
    if (this.worker) {
      // Reject all pending tasks
      for (const task of this.tasks.values()) {
        task.reject(new Error('Worker terminated'));
      }
      this.tasks.clear();

      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Gets pending task count.
   */
  getPendingTaskCount(): number {
    return this.tasks.size;
  }
}

/**
 * Creates a worker script URL from code.
 */
export function createWorkerScript(script: string): string {
  const blob = new Blob([script], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
}

/**
 * Example worker script for data processing.
 */
export const DATA_PROCESSING_WORKER_SCRIPT = `
  self.onmessage = function(event) {
    const { id, type, data } = event.data;
    
    try {
      let result;
      
      switch (type) {
        case 'processData':
          // Process data here
          result = processData(data);
          break;
        case 'calculate':
          result = calculate(data);
          break;
        default:
          throw new Error(\`Unknown task type: \${type}\`);
      }
      
      self.postMessage({
        id,
        success: true,
        data: result
      });
    } catch (error) {
      self.postMessage({
        id,
        success: false,
        error: error.message
      });
    }
  };
  
  function processData(data) {
    // Heavy computation here
    return data;
  }
  
  function calculate(data) {
    // Heavy calculation here
    return data;
  }
`;

