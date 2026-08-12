import { spawn } from 'node:child_process';

const ANSI_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const MAX_OUTPUT_CHARS = 100_000;

export interface CliResult {
  command: string;
  output: string;
}

export async function runDevSync(args: string[], cwd: string): Promise<CliResult> {
  const cliPath = process.env.DEVSYNC_CLI_PATH?.trim();
  const executable = cliPath ? process.execPath : (process.env.DEVSYNC_CLI_COMMAND?.trim() || 'devsync');
  const commandArgs = cliPath ? [cliPath, ...args] : args;

  return new Promise((resolve, reject) => {
    const child = spawn(executable, commandArgs, {
      cwd,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
      shell: process.platform === 'win32' && !cliPath,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', (error) => reject(new Error(`Could not start DevSync CLI: ${error.message}`)));
    child.on('close', (code) => {
      const output = stripAnsi([stdout.trim(), stderr.trim()].filter(Boolean).join('\n'));
      const command = `devsync ${args.join(' ')}`;
      if (code !== 0) {
        reject(new Error(output || `${command} exited with code ${code ?? 'unknown'}`));
        return;
      }
      resolve({ command, output: truncate(output) || 'Command completed successfully.' });
    });
  });
}

function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
}

function truncate(value: string): string {
  if (value.length <= MAX_OUTPUT_CHARS) return value;
  return `${value.slice(0, MAX_OUTPUT_CHARS)}\n\n[Output truncated by DevSync MCP]`;
}
