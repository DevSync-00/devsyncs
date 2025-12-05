/**
 * Chunking system for large CLI responses.
 * 
 * Provides capabilities to handle large outputs by chunking and processing incrementally.
 */

/**
 * Chunk processor.
 */
export interface ChunkProcessor<T> {
  /** Process a chunk */
  process(chunk: T): void | Promise<void>;
  /** Called when all chunks are processed */
  complete?(): void | Promise<void>;
  /** Called on error */
  error?(error: Error): void | Promise<void>;
}

/**
 * Chunk manager for large responses.
 */
export class ChunkManager {
  private chunkSize: number;
  private buffer: string = '';

  constructor(chunkSize = 1024 * 64) { // 64KB chunks
    this.chunkSize = chunkSize;
  }

  /**
   * Processes data in chunks.
   */
  async processInChunks<T>(
    data: string,
    processor: ChunkProcessor<string>
  ): Promise<void> {
    this.buffer += data;

    while (this.buffer.length >= this.chunkSize) {
      const chunk = this.buffer.substring(0, this.chunkSize);
      this.buffer = this.buffer.substring(this.chunkSize);

      try {
        await processor.process(chunk);
      } catch (error) {
        await processor.error?.(error as Error);
        throw error;
      }
    }
  }

  /**
   * Flushes remaining buffer.
   */
  async flush<T>(processor: ChunkProcessor<string>): Promise<void> {
    if (this.buffer.length > 0) {
      try {
        await processor.process(this.buffer);
        this.buffer = '';
        await processor.complete?.();
      } catch (error) {
        await processor.error?.(error as Error);
        throw error;
      }
    } else {
      await processor.complete?.();
    }
  }

  /**
   * Splits data into chunks.
   */
  static splitIntoChunks(data: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.substring(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Processes chunks with a delay to avoid blocking.
   */
  static async processChunksWithDelay<T>(
    chunks: T[],
    processor: (chunk: T) => void | Promise<void>,
    delayMs = 10
  ): Promise<void> {
    for (const chunk of chunks) {
      await processor(chunk);
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}

