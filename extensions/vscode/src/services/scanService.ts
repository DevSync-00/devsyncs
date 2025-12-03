/**
 * Scan service implementation.
 * 
 * Handles business logic for scan operations, including validation,
 * execution, and result processing. Separated from UI concerns.
 */

import { IScanService, ScanResult } from './interfaces';
import { IApiClient } from '../interfaces';
import { IConfigurationManager } from '../interfaces';
import { ScanReport } from '../api';

/**
 * Service for scan operations.
 * 
 * Implements business logic for scanning schemas without UI dependencies.
 */
export class ScanService implements IScanService {
  /**
   * Creates a new scan service.
   * 
   * @param apiClient - API client for scan operations
   * @param configManager - Configuration manager for validation
   */
  constructor(
    public readonly apiClient: IApiClient,
    private readonly configManager: IConfigurationManager
  ) {}

  /**
   * Validates that scan can be executed.
   * 
   * Checks that required configuration is present:
   * - API URL
   * - API Key
   * - Project ID
   * 
   * @param workspacePath - Path to the workspace
   * @returns Validation result with missing fields if invalid
   */
  validateScan(workspacePath: string): { valid: boolean; missingFields?: string[] } {
    if (!workspacePath) {
      return { valid: false, missingFields: ['workspacePath'] };
    }

    const missingFields: string[] = [];
    const config = this.configManager.getAll();

    if (!config.apiUrl) {
      missingFields.push('devsync.apiUrl');
    }
    if (!config.apiKey) {
      missingFields.push('devsync.apiKey');
    }
    if (!config.projectId) {
      missingFields.push('devsync.projectId');
    }

    if (missingFields.length > 0) {
      return { valid: false, missingFields };
    }

    return { valid: true };
  }

  /**
   * Executes a scan operation.
   * 
   * Performs the actual scan via the API client and returns the result.
   * Does not handle UI feedback or state updates - those are handled
   * by the command layer.
   * 
   * @param workspacePath - Path to the workspace to scan
   * @param databaseConnection - Optional database connection string
   * @returns Promise resolving to scan result
   * @throws {Error} If scan execution fails
   * 
   * @example
   * ```typescript
   * const result = await scanService.executeScan(
   *   '/path/to/workspace',
   *   'postgresql://user:pass@localhost:5432/db'
   * );
   * if (result.success) {
   *   console.log(`Found ${result.report.mismatches.length} mismatches`);
   * }
   * ```
   */
  async executeScan(workspacePath: string, databaseConnection?: string): Promise<ScanResult> {
    try {
      // Validate before executing
      const validation = this.validateScan(workspacePath);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid configuration: missing ${validation.missingFields?.join(', ')}`,
          report: {} as ScanReport,
        };
      }

      // Execute scan via API
      const report = await this.apiClient.scan(workspacePath, databaseConnection);

      return {
        success: true,
        report,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        report: {} as ScanReport,
      };
    }
  }

  /**
   * Gets the latest scan report.
   * 
   * @returns Promise resolving to the latest scan report, or null if none exists
   */
  async getLatestScanReport(): Promise<ScanReport | null> {
    return this.apiClient.getLatestScanReport();
  }

  /**
   * Gets scan reports with optional limit.
   * 
   * @param limit - Maximum number of reports to retrieve
   * @returns Promise resolving to array of scan reports
   */
  async getScanReports(limit?: number): Promise<ScanReport[]> {
    return this.apiClient.getScanReports(limit);
  }

  /**
   * Gets the dashboard URL for the current configuration.
   * 
   * @returns The dashboard URL, or empty string if not configured
   */
  getDashboardUrl(): string {
    return this.apiClient.getDashboardUrl();
  }
}

