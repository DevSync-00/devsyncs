/**
 * Migration repository implementation.
 * 
 * Provides data access for migrations using the repository pattern.
 */

import { IMigrationRepository } from '../interfaces';
import { IApiClient } from '../../interfaces';
import { Migration } from '../../api';
import { getMigrationsDir, getFilesInDir } from '../../utils/paths';
import { readJsonFile } from '../../utils/paths';
import * as vscode from 'vscode';

/**
 * Repository for migration data access.
 * 
 * Implements the repository pattern to abstract data persistence.
 * Uses file system for local storage and API client for remote data.
 */
export class MigrationRepository implements IMigrationRepository {
  /**
   * Creates a new migration repository.
   * 
   * @param apiClient - API client for remote data access
   */
  constructor(private readonly apiClient: IApiClient) {}

  /**
   * Saves a migration to local storage.
   * 
   * @param migration - The migration to save
   * @returns Promise that resolves when saved
   */
  async save(migration: Migration): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const { ensureMigrationsDir } = await import('../../utils/paths');
    const { writeFileSync } = await import('fs');
    const { join } = await import('path');
    
    const migrationsDir = ensureMigrationsDir(workspaceFolders[0]);
    const filePath = join(migrationsDir, migration.filename);
    writeFileSync(filePath, migration.content, 'utf-8');
  }

  /**
   * Finds a migration by ID.
   * 
   * @param id - The migration ID
   * @returns Promise resolving to the migration, or null if not found
   */
  async findById(id: string): Promise<Migration | null> {
    // Try local storage first
    const migrations = await this.findAll();
    return migrations.find((m) => m.id === id) || null;
  }

  /**
   * Finds migrations for a scan report.
   * 
   * @param scanReportId - The scan report ID
   * @returns Promise resolving to array of migrations
   */
  async findByScanReport(scanReportId: string): Promise<Migration[]> {
    return this.apiClient.getMigrations(scanReportId);
  }

  /**
   * Finds all migrations from local storage.
   * 
   * @param limit - Maximum number of migrations to retrieve
   * @returns Promise resolving to array of migrations
   */
  async findAll(limit?: number): Promise<Migration[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length > 0) {
      return [];
    }

    const migrationsDir = getMigrationsDir(workspaceFolders[0]);
    const files = getFilesInDir(migrationsDir, /\.sql$/);
    
    const migrations: Migration[] = [];
    for (const file of files.slice(0, limit)) {
      const { readFileSync } = await import('fs');
      const { basename } = await import('path');
      try {
        const content = readFileSync(file, 'utf-8');
        migrations.push({
          id: basename(file),
          filename: basename(file),
          content,
          format: 'sql',
          applied: false,
          created_at: new Date().toISOString(),
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return migrations;
  }
}

