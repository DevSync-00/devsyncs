/**
 * Advanced scanning features.
 * 
 * Implements:
 * - Incremental scanning (only changed files)
 * - Watch mode (auto-scan on file changes)
 * - Scheduled scans
 * - Scan profiles (different configs)
 * - Custom scan rules
 * - Scan comparison (before/after)
 * - Scan history timeline
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseSchema } from '../schema/types';
import { DatabaseParserRegistry, getDefaultParserRegistry } from '../database/parsers';
import { DatabaseConnection } from '../database/types';

/**
 * Scan profile configuration.
 */
export interface ScanProfile {
  /**
   * Profile name.
   */
  name: string;
  
  /**
   * Database connection configuration.
   */
  database: DatabaseConnection;
  
  /**
   * Schema files to scan.
   */
  schemaFiles: string[];
  
  /**
   * Scan options.
   */
  options?: ScanOptions;
  
  /**
   * Custom scan rules.
   */
  rules?: ScanRule[];
}

/**
 * Scan options.
 */
export interface ScanOptions {
  /**
   * Include warnings in results.
   */
  includeWarnings?: boolean;
  
  /**
   * Strict mode (fail on any mismatch).
   */
  strictMode?: boolean;
  
  /**
   * Timeout in milliseconds.
   */
  timeout?: number;
  
  /**
   * Scan only changed files (incremental).
   */
  incremental?: boolean;
  
  /**
   * Watch for file changes.
   */
  watch?: boolean;
  
  /**
   * Schedule for automatic scans.
   */
  schedule?: ScanSchedule;
}

/**
 * Scan schedule.
 */
export interface ScanSchedule {
  /**
   * Cron expression or interval.
   */
  expression: string;
  
  /**
   * Timezone.
   */
  timezone?: string;
}

/**
 * Custom scan rule.
 */
export interface ScanRule {
  /**
   * Rule name.
   */
  name: string;
  
  /**
   * Rule type.
   */
  type: 'ignore' | 'warning' | 'error' | 'custom';
  
  /**
   * Rule pattern (regex or glob).
   */
  pattern: string;
  
  /**
   * Rule description.
   */
  description?: string;
}

/**
 * Scan result with metadata.
 */
export interface AdvancedScanResult {
  /**
   * Scan ID.
   */
  scanId: string;
  
  /**
   * Profile used.
   */
  profile: string;
  
  /**
   * Database schema.
   */
  databaseSchema: DatabaseSchema;
  
  /**
   * Code schema (from Prisma files).
   */
  codeSchema?: DatabaseSchema;
  
  /**
   * Detected mismatches.
   */
  mismatches: any[];
  
  /**
   * Scan timestamp.
   */
  timestamp: Date;
  
  /**
   * Scan duration in milliseconds.
   */
  duration: number;
  
  /**
   * Files scanned.
   */
  filesScanned: string[];
  
  /**
   * Previous scan ID (for comparison).
   */
  previousScanId?: string;
}

/**
 * Advanced scanner with all advanced features.
 */
export class AdvancedScanner {
  private parserRegistry: DatabaseParserRegistry;
  private fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
  private scheduledScans: Map<string, NodeJS.Timeout> = new Map();
  private scanHistory: AdvancedScanResult[] = [];
  
  constructor(parserRegistry?: DatabaseParserRegistry) {
    this.parserRegistry = parserRegistry || getDefaultParserRegistry();
  }
  
  /**
   * Perform incremental scan (only changed files).
   */
  async incrementalScan(
    profile: ScanProfile,
    previousScanId?: string
  ): Promise<AdvancedScanResult> {
    const previousScan = previousScanId
      ? this.scanHistory.find(s => s.scanId === previousScanId)
      : undefined;
    
    const changedFiles = previousScan
      ? await this.getChangedFiles(profile.schemaFiles, previousScan.timestamp)
      : profile.schemaFiles;
    
    return this.performScan(profile, {
      ...profile.options,
      files: changedFiles,
    });
  }
  
  /**
   * Start watch mode (auto-scan on file changes).
   */
  startWatchMode(profile: ScanProfile, onScanComplete: (result: AdvancedScanResult) => void): void {
    // Stop existing watcher for this profile
    this.stopWatchMode(profile.name);
    
    // Create file watcher
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        vscode.workspace.workspaceFolders![0],
        `**/{${profile.schemaFiles.join(',')}}`
      )
    );
    
    let debounceTimer: NodeJS.Timeout;
    watcher.onDidChange(async (uri) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const result = await this.performScan(profile, {
          ...profile.options,
          files: [uri.fsPath],
        });
        onScanComplete(result);
      }, 1000); // Debounce 1 second
    });
    
    this.fileWatchers.set(profile.name, watcher);
  }
  
  /**
   * Stop watch mode.
   */
  stopWatchMode(profileName: string): void {
    const watcher = this.fileWatchers.get(profileName);
    if (watcher) {
      watcher.dispose();
      this.fileWatchers.delete(profileName);
    }
  }
  
  /**
   * Schedule automatic scans.
   */
  scheduleScan(profile: ScanProfile, schedule: ScanSchedule, onScanComplete: (result: AdvancedScanResult) => void): void {
    // Stop existing schedule
    this.unscheduleScan(profile.name);
    
    // Parse cron expression and schedule
    const interval = this.parseSchedule(schedule.expression);
    const timer = setInterval(async () => {
      const result = await this.performScan(profile);
      onScanComplete(result);
    }, interval);
    
    this.scheduledScans.set(profile.name, timer);
  }
  
  /**
   * Unschedule automatic scans.
   */
  unscheduleScan(profileName: string): void {
    const timer = this.scheduledScans.get(profileName);
    if (timer) {
      clearInterval(timer);
      this.scheduledScans.delete(profileName);
    }
  }
  
  /**
   * Compare two scans.
   */
  compareScans(scanId1: string, scanId2: string): ScanComparison {
    const scan1 = this.scanHistory.find(s => s.scanId === scanId1);
    const scan2 = this.scanHistory.find(s => s.scanId === scanId2);
    
    if (!scan1 || !scan2) {
      throw new Error('Scan not found');
    }
    
    return {
      added: this.findAddedMismatches(scan1, scan2),
      removed: this.findRemovedMismatches(scan1, scan2),
      changed: this.findChangedMismatches(scan1, scan2),
      unchanged: this.findUnchangedMismatches(scan1, scan2),
    };
  }
  
  /**
   * Get scan history timeline.
   */
  getScanHistory(profileName?: string, limit?: number): AdvancedScanResult[] {
    let history = this.scanHistory;
    
    if (profileName) {
      history = history.filter(s => s.profile === profileName);
    }
    
    history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (limit) {
      history = history.slice(0, limit);
    }
    
    return history;
  }
  
  /**
   * Perform scan with options.
   */
  private async performScan(
    profile: ScanProfile,
    options?: Partial<ScanOptions> & { files?: string[] }
  ): Promise<AdvancedScanResult> {
    const startTime = Date.now();
    const scanId = this.generateScanId();
    const filesToScan = options?.files || profile.schemaFiles;
    
    // Parse database schema
    const parser = this.parserRegistry.getParser(profile.database.type);
    const databaseSchema = await parser.parseFromConnection(profile.database);
    
    // Parse code schema (from Prisma files)
    const codeSchema = await this.parseCodeSchema(filesToScan);
    
    // Compare schemas
    const mismatches = await this.compareSchemas(databaseSchema, codeSchema, profile.rules);
    
    const duration = Date.now() - startTime;
    
    const result: AdvancedScanResult = {
      scanId,
      profile: profile.name,
      databaseSchema,
      codeSchema,
      mismatches,
      timestamp: new Date(),
      duration,
      filesScanned: filesToScan,
      previousScanId: this.scanHistory.length > 0
        ? this.scanHistory[this.scanHistory.length - 1].scanId
        : undefined,
    };
    
    // Store in history
    this.scanHistory.push(result);
    
    // Limit history size
    if (this.scanHistory.length > 100) {
      this.scanHistory.shift();
    }
    
    return result;
  }
  
  /**
   * Get changed files since timestamp.
   */
  private async getChangedFiles(files: string[], since: Date): Promise<string[]> {
    const changed: string[] = [];
    
    for (const file of files) {
      try {
        const stats = await fs.promises.stat(file);
        if (stats.mtime > since) {
          changed.push(file);
        }
      } catch (error) {
        // File might not exist, skip
      }
    }
    
    return changed;
  }
  
  /**
   * Parse code schema from Prisma files.
   */
  private async parseCodeSchema(files: string[]): Promise<DatabaseSchema | undefined> {
    // TODO: Implement Prisma schema parsing
    // This would parse Prisma schema files and convert to DatabaseSchema format
    return undefined;
  }
  
  /**
   * Compare database and code schemas.
   */
  private async compareSchemas(
    databaseSchema: DatabaseSchema,
    codeSchema: DatabaseSchema | undefined,
    rules?: ScanRule[]
  ): Promise<any[]> {
    // TODO: Implement schema comparison
    // This would compare the two schemas and detect mismatches
    return [];
  }
  
  /**
   * Find added mismatches between scans.
   */
  private findAddedMismatches(scan1: AdvancedScanResult, scan2: AdvancedScanResult): any[] {
    const scan1Ids = new Set(scan1.mismatches.map(m => this.getMismatchId(m)));
    return scan2.mismatches.filter(m => !scan1Ids.has(this.getMismatchId(m)));
  }
  
  /**
   * Find removed mismatches between scans.
   */
  private findRemovedMismatches(scan1: AdvancedScanResult, scan2: AdvancedScanResult): any[] {
    const scan2Ids = new Set(scan2.mismatches.map(m => this.getMismatchId(m)));
    return scan1.mismatches.filter(m => !scan2Ids.has(this.getMismatchId(m)));
  }
  
  /**
   * Find changed mismatches between scans.
   */
  private findChangedMismatches(scan1: AdvancedScanResult, scan2: AdvancedScanResult): any[] {
    // TODO: Implement change detection
    return [];
  }
  
  /**
   * Find unchanged mismatches between scans.
   */
  private findUnchangedMismatches(scan1: AdvancedScanResult, scan2: AdvancedScanResult): any[] {
    const scan1Ids = new Set(scan1.mismatches.map(m => this.getMismatchId(m)));
    return scan2.mismatches.filter(m => scan1Ids.has(this.getMismatchId(m)));
  }
  
  /**
   * Get mismatch ID for comparison.
   */
  private getMismatchId(mismatch: any): string {
    return `${mismatch.type}:${mismatch.model}:${mismatch.field || ''}`;
  }
  
  /**
   * Parse schedule expression to interval.
   */
  private parseSchedule(expression: string): number {
    // Simple parsing - in production, use a cron library
    if (expression.startsWith('every ')) {
      const match = expression.match(/every (\d+) (second|minute|hour|day)s?/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        const multipliers: Record<string, number> = {
          second: 1000,
          minute: 60 * 1000,
          hour: 60 * 60 * 1000,
          day: 24 * 60 * 60 * 1000,
        };
        return value * (multipliers[unit] || 1000);
      }
    }
    
    // Default: 1 hour
    return 60 * 60 * 1000;
  }
  
  /**
   * Generate unique scan ID.
   */
  private generateScanId(): string {
    return `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Dispose resources.
   */
  dispose(): void {
    // Stop all watchers
    for (const watcher of this.fileWatchers.values()) {
      watcher.dispose();
    }
    this.fileWatchers.clear();
    
    // Stop all scheduled scans
    for (const timer of this.scheduledScans.values()) {
      clearInterval(timer);
    }
    this.scheduledScans.clear();
  }
}

/**
 * Scan comparison result.
 */
export interface ScanComparison {
  /**
   * Mismatches added since previous scan.
   */
  added: any[];
  
  /**
   * Mismatches removed since previous scan.
   */
  removed: any[];
  
  /**
   * Mismatches that changed.
   */
  changed: any[];
  
  /**
   * Mismatches that remained unchanged.
   */
  unchanged: any[];
}

