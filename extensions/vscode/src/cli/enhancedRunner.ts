/**
 * Enhanced CLI runner with streaming, chunking, background processing, and progress tracking.
 * 
 * Provides comprehensive CLI execution improvements including:
 * - Real-time output streaming
 * - Incremental output processing
 * - Chunked large response handling
 * - Background processing
 * - Worker threads for heavy operations
 * - Progress callbacks
 */

import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';
import { RealTimeStreamer } from './streaming';
import { ChunkManager } from './chunking';
import { BackgroundProcessor, BackgroundTaskStatus } from './background';
import { WorkerManager } from './workers';
import { CliProgressTracker, ProgressUpdate } from './progress';

/**
 * Enhanced CLI command result.
 */
export interface EnhancedCliResult {
  /** Success status */
  success: boolean;
  /** Output */
  output: string;
  /** Error output */
  error?: string;
  /** Exit code */
  exitCode?: number;
  /** Progress updates */
  progress?: ProgressUpdate[];
  /** Execution time (ms) */
  executionTime?: number;
}

/**
 * Enhanced CLI execution options.
 */
export interface EnhancedCliOptions {
  /** Stream output in real-time */
  streamOutput?: boolean;
  /** Process output incrementally */
  processIncrementally?: boolean;
  /** Chunk size for large outputs */
  chunkSize?: number;
  /** Run in background */
  background?: boolean;
  /** Use worker thread for heavy operations */
  useWorker?: boolean;
  /** Progress callbacks */
  onProgress?: (progress: ProgressUpdate) => void;
  /** Output chunk callbacks */
  onChunk?: (chunk: string) => void;
  /** Cancellation token */
  cancelToken?: vscode.CancellationToken;
}

/**
 * Enhanced CLI runner.
 */
export class EnhancedCliRunner {
  private outputChannel: vscode.OutputChannel;
  private streamer: RealTimeStreamer;
  private chunkManager: ChunkManager;
  private backgroundProcessor: BackgroundProcessor;
  private workerManager: WorkerManager;
  private runningProcesses: Map<string, ChildProcess> = new Map();

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
    this.streamer = new RealTimeStreamer(outputChannel);
    this.chunkManager = new ChunkManager();
    this.backgroundProcessor = new BackgroundProcessor();
    this.workerManager = new WorkerManager();
  }

  /**
   * Executes a CLI command with enhanced features.
   */
  async executeEnhanced(
    command: 'scan' | 'migrate' | 'init' | 'fix' | 'status' | 'apply',
    options: Record<string, any> = {},
    cliOptions: EnhancedCliOptions = {}
  ): Promise<EnhancedCliResult> {
    const startTime = Date.now();
    const taskId = `${command}-${Date.now()}`;
    const progressTracker = new CliProgressTracker();

    // Register progress callback
    if (cliOptions.onProgress) {
      progressTracker.onProgress(cliOptions.onProgress);
    }

    // Start progress tracking
    if (!cliOptions.background) {
      progressTracker.start(
        vscode.ProgressLocation.Notification,
        `DevSync ${command}`,
        !!cliOptions.cancelToken
      );
    }

    // Setup progress tracking from streamer
    const progressEmitter = this.streamer.getProgressEmitter();
    progressEmitter.on('progress', (progress: ProgressUpdate) => {
      progressTracker.update(progress);
    });

    // Execute command
    const executeCommand = async (): Promise<EnhancedCliResult> => {
      const cliPath = this.getCliPath();
      if (!cliPath) {
        throw new Error('CLI not found');
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const args: string[] = [command];

      // Build arguments
      for (const [key, value] of Object.entries(options)) {
        if (value === undefined || value === null || value === '') {
          continue;
        }

        const flag = key.length === 1 ? `-${key}` : `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;

        if (typeof value === 'boolean') {
          if (value) {
            args.push(flag);
          }
        } else {
          args.push(flag, String(value));
        }
      }

      if (!args.includes('--path') && !args.includes('-p')) {
        args.push('--path', workspaceRoot);
      }

      return this.executeWithStreaming(
        'node',
        [cliPath, ...args],
        {
          cwd: workspaceRoot,
          label: `DevSync ${command}`,
          cancelToken: cliOptions.cancelToken,
          streamOutput: cliOptions.streamOutput ?? true,
          processIncrementally: cliOptions.processIncrementally ?? true,
          chunkSize: cliOptions.chunkSize,
          onChunk: cliOptions.onChunk,
        },
        progressTracker
      );
    };

    try {
      let result: EnhancedCliResult;

      if (cliOptions.background) {
        // Execute in background
        result = await this.backgroundProcessor.executeBackground(
          taskId,
          `DevSync ${command}`,
          executeCommand
        );
      } else if (cliOptions.useWorker && command === 'scan') {
        // Use worker thread for heavy operations
        // Note: Workers require separate script files
        result = await executeCommand();
      } else {
        // Execute normally with streaming
        result = await executeCommand();
      }

      const executionTime = Date.now() - startTime;
      result.executionTime = executionTime;

      progressTracker.complete();
      return result;
    } catch (error) {
      progressTracker.complete();
      throw error;
    }
  }

  /**
   * Executes command with streaming.
   */
  private executeWithStreaming(
    command: string,
    args: string[],
    options: {
      cwd?: string;
      label?: string;
      cancelToken?: vscode.CancellationToken;
      streamOutput?: boolean;
      processIncrementally?: boolean;
      chunkSize?: number;
      onChunk?: (chunk: string) => void;
    },
    progressTracker: CliProgressTracker
  ): Promise<EnhancedCliResult> {
    return new Promise((resolve, reject) => {
      const label = options.label || command;
      this.outputChannel.appendLine(`\n[${new Date().toLocaleTimeString()}] ${label}`);
      this.outputChannel.appendLine(`Command: ${command} ${args.join(' ')}\n`);

      const childProcess = spawn(command, args, {
        cwd: options.cwd || process.cwd(),
        shell: true,
        env: { 
          ...process.env,
          // Force unbuffered output for real-time streaming
          PYTHONUNBUFFERED: '1',
          NODE_NO_WARNINGS: '1',
        },
        // Ensure stdout/stderr are not buffered
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      const commandId = `${command}-${Date.now()}`;
      this.runningProcesses.set(commandId, childProcess);

      let output = '';
      let errorOutput = '';
      const progressUpdates: ProgressUpdate[] = [];

      // Setup streaming
      if (options.streamOutput) {
        childProcess.stdout?.on('data', (data: Buffer) => {
          const text = data.toString();
          output += text;

          if (options.processIncrementally) {
            // Process incrementally
            this.streamer.processData(data, 'stdout');
            this.chunkManager.processInChunks(text, {
              process: async (chunk) => {
                options.onChunk?.(chunk);
              },
            }).catch((error) => {
              console.error('Error processing chunk:', error);
            });
          } else {
            this.outputChannel.append(text);
            options.onChunk?.(text);
          }
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
          const text = data.toString();
          errorOutput += text;
          this.streamer.processData(data, 'stderr');
          this.outputChannel.append(text);
          // Also send stderr to onChunk callback for chat panel display
          if (options.processIncrementally) {
            options.onChunk?.(text);
          } else {
            options.onChunk?.(text);
          }
        });
      } else {
        // Non-streaming mode (collect all output)
        childProcess.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
      }

      // Handle cancellation
      if (options.cancelToken) {
        options.cancelToken.onCancellationRequested(() => {
          childProcess.kill();
          this.outputChannel.appendLine('\n[Cancelled]');
          reject(new Error('Command cancelled'));
        });
      }

      // Track progress
      progressTracker.on('progress', (progress: ProgressUpdate) => {
        progressUpdates.push(progress);
      });

      childProcess.on('close', (code: number | null) => {
        this.runningProcesses.delete(commandId);
        this.streamer.flush();

        const result: EnhancedCliResult = {
          success: code === 0,
          output: output.trim(),
          error: errorOutput.trim() || undefined,
          exitCode: code || undefined,
          progress: progressUpdates.length > 0 ? progressUpdates : undefined,
        };

        this.outputChannel.appendLine(`\n[${label}] Exit code: ${code}\n`);
        resolve(result);
      });

      childProcess.on('error', (error: Error) => {
        this.runningProcesses.delete(commandId);
        this.streamer.flush();
        const errorMsg = error.message;
        this.outputChannel.appendLine(`\n[Error] ${errorMsg}\n`);
        reject(error);
      });
    });
  }

  /**
   * Gets CLI path.
   */
  private getCliPath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cliPath = join(workspaceRoot, 'packages', 'cli', 'dist', 'index.js');

    if (!existsSync(cliPath)) {
      const altPath = join(workspaceRoot, 'node_modules', '@dev-sync', 'cli', 'dist', 'index.js');
      if (existsSync(altPath)) {
        return altPath;
      }
      return null;
    }

    return cliPath;
  }

  /**
   * Cancels all running commands.
   */
  cancelAll(): void {
    for (const [id, process] of this.runningProcesses.entries()) {
      process.kill();
      this.outputChannel.appendLine(`\n[Cancelled] ${id}\n`);
    }
    this.runningProcesses.clear();
    this.workerManager.terminateAll();
  }

  /**
   * Gets background task status.
   */
  getBackgroundTaskStatus(taskId: string) {
    return this.backgroundProcessor.getTaskStatus(taskId);
  }

  /**
   * Gets all background tasks.
   */
  getAllBackgroundTasks() {
    return this.backgroundProcessor.getAllTasks();
  }
}

