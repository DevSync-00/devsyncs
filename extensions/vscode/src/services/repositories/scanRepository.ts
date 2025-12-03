/**
 * Scan repository implementation.
 * 
 * Provides data access for scan reports using the repository pattern.
 * This abstracts the data persistence layer from business logic.
 */

import { IScanRepository } from '../interfaces';
import { IApiClient } from '../../interfaces';
import { ScanReport } from '../../api';
import { writeJsonFile, readJsonFile } from '../../utils/paths';
import * as vscode from 'vscode';

/**
 * Repository for scan report data access.
 * 
 * Implements the repository pattern to abstract data persistence.
 * Currently uses API client for remote data and file system for local caching.
 */
export class ScanRepository implements IScanRepository {
  /**
   * Creates a new scan repository.
   * 
   * @param apiClient - API client for remote data access
   */
  constructor(private readonly apiClient: IApiClient) {}

  /**
   * Saves a scan report to local storage.
   * 
   * @param report - The scan report to save
   * @returns Promise that resolves when saved
   */
  async save(report: ScanReport): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const { getScanResultsPath } = await import('../../utils/paths');
    const path = getScanResultsPath(workspaceFolders[0]);
    writeJsonFile(path, report);
  }

  /**
   * Finds a scan report by ID.
   * 
   * First checks local storage, then falls back to API.
   * 
   * @param id - The scan report ID
   * @returns Promise resolving to the report, or null if not found
   */
  async findById(id: string): Promise<ScanReport | null> {
    // Try local storage first
    const localReport = await this.findLatest();
    if (localReport && localReport.id === id) {
      return localReport;
    }

    // Fall back to API
    const reports = await this.apiClient.getScanReports();
    return reports.find((r) => r.id === id) || null;
  }

  /**
   * Finds the latest scan report.
   * 
   * First checks local storage, then falls back to API.
   * 
   * @returns Promise resolving to the latest report, or null if none exists
   */
  async findLatest(): Promise<ScanReport | null> {
    // Try local storage first
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const { getScanResultsPath } = await import('../../utils/paths');
      const path = getScanResultsPath(workspaceFolders[0]);
      const localReport = readJsonFile<ScanReport>(path);
      if (localReport) {
        return localReport;
      }
    }

    // Fall back to API
    return this.apiClient.getLatestScanReport();
  }

  /**
   * Finds scan reports with optional limit.
   * 
   * @param limit - Maximum number of reports to retrieve
   * @returns Promise resolving to array of reports
   */
  async findAll(limit?: number): Promise<ScanReport[]> {
    return this.apiClient.getScanReports(limit);
  }

  /**
   * Deletes a scan report from local storage.
   * 
   * @param id - The scan report ID to delete
   * @returns Promise that resolves when deleted
   */
  async delete(id: string): Promise<void> {
    // For now, we only delete from local storage
    // In the future, this could also delete from API
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const { getScanResultsPath } = await import('../../utils/paths');
    const { existsSync, unlinkSync } = await import('fs');
    const path = getScanResultsPath(workspaceFolders[0]);
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }
}

