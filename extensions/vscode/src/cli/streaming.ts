/**
 * Real-time output streaming for CLI commands.
 * 
 * Provides capabilities to stream CLI output in real-time and process it incrementally.
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';

/**
 * Output chunk.
 */
export interface OutputChunk {
  /** Chunk data */
  data: string;
  /** Chunk type */
  type: 'stdout' | 'stderr';
  /** Timestamp */
  timestamp: Date;
}

/**
 * Progress information.
 */
export interface ProgressInfo {
  /** Current step */
  step?: string;
  /** Progress percentage (0-100) */
  percentage?: number;
  /** Current item being processed */
  current?: number;
  /** Total items */
  total?: number;
  /** Estimated time remaining (seconds) */
  estimatedTimeRemaining?: number;
}

/**
 * Output stream processor.
 */
export class OutputStreamProcessor extends EventEmitter {
  private buffer: string = '';
  private bufferSize: number;
  private chunkSize: number;

  constructor(bufferSize = 8192, chunkSize = 1024) {
    super();
    this.bufferSize = bufferSize;
    this.chunkSize = chunkSize;
  }

  /**
   * Processes incoming data chunk.
   */
  processChunk(data: Buffer, type: 'stdout' | 'stderr'): void {
    const text = data.toString();
    this.buffer += text;

    // Emit chunk if buffer is large enough
    if (this.buffer.length >= this.chunkSize) {
      this.emitChunk();
    }

    // Try to extract progress information
    this.extractProgress(text);
  }

  /**
   * Emits buffered chunk.
   */
  private emitChunk(): void {
    if (this.buffer.length === 0) {
      return;
    }

    const chunk: OutputChunk = {
      data: this.buffer.substring(0, this.chunkSize),
      type: 'stdout',
      timestamp: new Date(),
    };

    this.emit('chunk', chunk);
    this.buffer = this.buffer.substring(this.chunkSize);
  }

  /**
   * Flushes remaining buffer.
   */
  flush(): void {
    if (this.buffer.length > 0) {
      const chunk: OutputChunk = {
        data: this.buffer,
        type: 'stdout',
        timestamp: new Date(),
      };

      this.emit('chunk', chunk);
      this.buffer = '';
    }
  }

  /**
   * Extracts progress information from output.
   */
  private extractProgress(text: string): void {
    // Look for common progress patterns
    const patterns = [
      /(\d+)%\s*\[([^\]]+)\]/g, // "50% [████████████████████░░░░░░░░]"
      /(\d+)\/(\d+)\s*items?/gi, // "5/10 items"
      /Processing\s+(\d+)\s+of\s+(\d+)/gi, // "Processing 5 of 10"
      /Step\s+(\d+)\s+of\s+(\d+)/gi, // "Step 1 of 5"
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) {
        const progress: ProgressInfo = {};

        if (match[1] && match[2]) {
          const current = parseInt(match[1], 10);
          const total = parseInt(match[2], 10);
          if (!isNaN(current) && !isNaN(total) && total > 0) {
            progress.current = current;
            progress.total = total;
            progress.percentage = Math.round((current / total) * 100);
          }
        }

        if (progress.percentage !== undefined) {
          this.emit('progress', progress);
        }
      }
    }
  }
}

/**
 * Real-time output streamer.
 */
export class RealTimeStreamer {
  private processor: OutputStreamProcessor;
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.processor = new OutputStreamProcessor();

    // Forward chunks to output channel
    this.processor.on('chunk', (chunk: OutputChunk) => {
      this.outputChannel.append(chunk.data);
    });

    // Forward progress updates
    this.processor.on('progress', (progress: ProgressInfo) => {
      this.emitProgress(progress);
    });
  }

  /**
   * Processes data chunk.
   */
  processData(data: Buffer, type: 'stdout' | 'stderr'): void {
    this.processor.processChunk(data, type);
  }

  /**
   * Flushes remaining data.
   */
  flush(): void {
    this.processor.flush();
  }

  /**
   * Emits progress update.
   */
  private emitProgress(progress: ProgressInfo): void {
    // Update status bar or show progress notification
    if (progress.percentage !== undefined) {
      vscode.window.setStatusBarMessage(
        `DevSync: ${progress.step || 'Processing'} ${progress.percentage}%`,
        2000
      );
    }
  }

  /**
   * Gets progress event emitter.
   */
  getProgressEmitter(): EventEmitter {
    return this.processor;
  }
}

