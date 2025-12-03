/**
 * Utility functions for command registration and management
 */

import * as vscode from 'vscode';

/**
 * Command registration helper
 */
export interface CommandRegistration {
  command: string;
  callback: (...args: any[]) => any;
  thisArg?: any;
}

/**
 * Register multiple commands at once
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  registrations: CommandRegistration[]
): vscode.Disposable[] {
  return registrations.map((reg) => {
    const disposable = vscode.commands.registerCommand(reg.command, reg.callback, reg.thisArg);
    context.subscriptions.push(disposable);
    return disposable;
  });
}

/**
 * Create a command registration object
 */
export function createCommand(
  command: string,
  callback: (...args: any[]) => any,
  thisArg?: any
): CommandRegistration {
  return { command, callback, thisArg };
}

/**
 * Register a command with error handling
 */
export function registerCommandWithErrorHandling(
  context: vscode.ExtensionContext,
  command: string,
  callback: (...args: any[]) => Promise<any> | any,
  thisArg?: any
): vscode.Disposable {
  const wrappedCallback = async (...args: any[]) => {
    try {
      return await callback.apply(thisArg, args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Command ${command} failed: ${message}`);
      console.error(`Command ${command} error:`, error);
    }
  };

  const disposable = vscode.commands.registerCommand(command, wrappedCallback);
  context.subscriptions.push(disposable);
  return disposable;
}

