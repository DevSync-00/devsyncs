/**
 * Utility functions for file and directory path operations
 */

import { join } from 'path';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'fs';
import * as vscode from 'vscode';

/**
 * Get the .devsync directory path for a workspace folder
 */
export function getDevSyncDir(workspaceFolder: vscode.WorkspaceFolder): string {
  return join(workspaceFolder.uri.fsPath, '.devsync');
}

/**
 * Get the scan results file path
 */
export function getScanResultsPath(workspaceFolder: vscode.WorkspaceFolder): string {
  return join(getDevSyncDir(workspaceFolder), 'scan-results.json');
}

/**
 * Get the migrations directory path
 */
export function getMigrationsDir(workspaceFolder: vscode.WorkspaceFolder): string {
  return join(getDevSyncDir(workspaceFolder), 'migrations');
}

/**
 * Get the config file path
 */
export function getConfigPath(workspaceFolder: vscode.WorkspaceFolder): string {
  return join(getDevSyncDir(workspaceFolder), 'config.json');
}

/**
 * Ensure the .devsync directory exists
 */
export function ensureDevSyncDir(workspaceFolder: vscode.WorkspaceFolder): string {
  const devSyncDir = getDevSyncDir(workspaceFolder);
  if (!existsSync(devSyncDir)) {
    mkdirSync(devSyncDir, { recursive: true });
  }
  return devSyncDir;
}

/**
 * Ensure the migrations directory exists
 */
export function ensureMigrationsDir(workspaceFolder: vscode.WorkspaceFolder): string {
  const migrationsDir = getMigrationsDir(workspaceFolder);
  if (!existsSync(migrationsDir)) {
    mkdirSync(migrationsDir, { recursive: true });
  }
  return migrationsDir;
}

/**
 * Read JSON file safely
 */
export function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Failed to read JSON file ${filePath}:`, error);
    return null;
  }
}

/**
 * Write JSON file safely
 */
export function writeJsonFile<T>(filePath: string, data: T): boolean {
  try {
    const dir = join(filePath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Failed to write JSON file ${filePath}:`, error);
    return false;
  }
}

/**
 * Get all files in a directory matching a pattern
 */
export function getFilesInDir(dirPath: string, pattern?: RegExp): string[] {
  try {
    if (!existsSync(dirPath)) {
      return [];
    }
    const files = readdirSync(dirPath);
    if (pattern) {
      return files.filter((f) => pattern.test(f)).map((f) => join(dirPath, f));
    }
    return files.map((f) => join(dirPath, f));
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}:`, error);
    return [];
  }
}

/**
 * Get the first workspace folder or throw an error
 */
export function getWorkspaceFolder(): vscode.WorkspaceFolder {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder open');
  }
  return workspaceFolders[0];
}

