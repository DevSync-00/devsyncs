import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

export interface CliCommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
}

export interface CliRunHooks {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  onClose?: (code: number | null) => void;
}

import { ICliRunner } from './interfaces';
import { EnhancedCliRunner, EnhancedCliOptions } from './cli/enhancedRunner';
import { ProgressUpdate } from './cli/progress';

export class CliRunner implements ICliRunner {
  private enhancedRunner?: EnhancedCliRunner;
  private outputChannel: vscode.OutputChannel;
  private runningProcesses: Map<string, ChildProcess> = new Map();

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Get the path to the CLI executable
   */
  private getCliPath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cliPath = join(workspaceRoot, 'packages', 'cli', 'dist', 'index.js');
    
    // Check if CLI is built
    if (!existsSync(cliPath)) {
      // Try alternative path (if CLI is installed globally or in node_modules)
      const altPath = join(workspaceRoot, 'node_modules', '@dev-sync', 'cli', 'dist', 'index.js');
      if (existsSync(altPath)) {
        return altPath;
      }
      const npmPrefix = process.env.APPDATA;
      if (npmPrefix) {
        const globalPath = join(npmPrefix, 'npm', 'node_modules', '@dev-sync', 'cli', 'dist', 'index.js');
        if (existsSync(globalPath)) {
          return globalPath;
        }
      }
      return null;
    }

    return cliPath;
  }

  /**
   * Check if CLI is available and built
   */
  async checkCliAvailable(): Promise<boolean> {
    const cliPath = this.getCliPath();
    if (!cliPath) {
      return false;
    }
    return existsSync(cliPath);
  }

  /**
   * Build the CLI if needed
   */
  async buildCli(): Promise<CliCommandResult> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {
        success: false,
        output: '',
        error: 'No workspace folder open'
      };
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const cliDir = join(workspaceRoot, 'packages', 'cli');

    return this.executeCommand('npm', ['run', 'build'], {
      cwd: cliDir,
      label: 'Building CLI'
    });
  }

  /**
   * Gets the enhanced runner instance.
   */
  private getEnhancedRunner(): EnhancedCliRunner {
    if (!this.enhancedRunner) {
      this.enhancedRunner = new EnhancedCliRunner(this.outputChannel);
    }
    return this.enhancedRunner;
  }

  /**
   * Execute a CLI command
   */
  async executeCliCommand(
    command: 'scan' | 'migrate' | 'init' | 'fix' | 'status' | 'apply',
    options: Record<string, any> = {},
    cancelToken?: vscode.CancellationToken,
    hooks?: CliRunHooks
  ): Promise<CliCommandResult> {
    // Use enhanced runner for better performance
    const enhancedOptions: EnhancedCliOptions = {
      streamOutput: true,
      processIncrementally: true,
      cancelToken,
      onProgress: (progress: ProgressUpdate) => {
        // Convert progress to hooks if needed
      },
      onChunk: (chunk: string) => {
        // Stream both stdout and stderr to hooks for real-time display
        hooks?.onStdout?.(chunk);
      },
    };

    try {
      const result = await this.getEnhancedRunner().executeEnhanced(
        command,
        options,
        enhancedOptions
      );

      return {
        success: result.success,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
      };
    } catch (error) {
      // Fallback to original implementation if enhanced fails
      return this.executeCommandFallback(command, options, cancelToken, hooks);
    }
  }

  /**
   * Fallback to original command execution.
   */
  private async executeCommandFallback(
    command: 'scan' | 'migrate' | 'init' | 'fix' | 'status' | 'apply',
    options: Record<string, any> = {},
    cancelToken?: vscode.CancellationToken,
    hooks?: CliRunHooks
  ): Promise<CliCommandResult> {
    const cliPath = this.getCliPath();
    if (!cliPath) {
      // Try to build CLI first
      const buildResult = await this.buildCli();
      if (!buildResult.success) {
        return {
          success: false,
          output: '',
          error: 'CLI not found. Please build the CLI first: npm run build in packages/cli'
        };
      }
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {
        success: false,
        output: '',
        error: 'No workspace folder open'
      };
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const args: string[] = [command];

    // Add options as CLI arguments
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

    // Set default path to workspace root
    if (!args.includes('--path') && !args.includes('-p')) {
      args.push('--path', workspaceRoot);
    }

    return this.executeCommand('node', [cliPath!, ...args], {
      cwd: workspaceRoot,
      label: `DevSync ${command}`,
      cancelToken,
      hooks
    });
  }

  /**
   * Execute a generic command
   */
  private executeCommand(
    command: string,
    args: string[],
    options: {
      cwd?: string;
      label?: string;
      cancelToken?: vscode.CancellationToken;
      hooks?: CliRunHooks;
    } = {}
  ): Promise<CliCommandResult> {
    return new Promise((resolve) => {
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

      childProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        this.outputChannel.append(text);
        options.hooks?.onStdout?.(text);
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        errorOutput += text;
        this.outputChannel.append(text);
        options.hooks?.onStderr?.(text);
      });

      if (options.cancelToken) {
        options.cancelToken.onCancellationRequested(() => {
          childProcess.kill();
          this.outputChannel.appendLine('\n[Cancelled]');
        });
      }

      childProcess.on('close', (code: number | null) => {
        this.runningProcesses.delete(commandId);
        
        const result: CliCommandResult = {
          success: code === 0,
          output: output.trim(),
          error: errorOutput.trim() || undefined,
          exitCode: code || undefined
        };

        this.outputChannel.appendLine(`\n[${label}] Exit code: ${code}\n`);
        options.hooks?.onClose?.(code);
        resolve(result);
      });

      childProcess.on('error', (error: Error) => {
        this.runningProcesses.delete(commandId);
        const errorMsg = error.message;
        this.outputChannel.appendLine(`\n[Error] ${errorMsg}\n`);
        resolve({
          success: false,
          output: output.trim(),
          error: errorMsg
        });
      });
    });
  }

  /**
   * Cancel a running command
   */
  cancelAll(): void {
    for (const [id, process] of this.runningProcesses.entries()) {
      process.kill();
      this.outputChannel.appendLine(`\n[Cancelled] ${id}\n`);
    }
    this.runningProcesses.clear();
  }

  /**
   * Show output channel
   */
  showOutput(): void {
    this.outputChannel.show(true);
  }
}

