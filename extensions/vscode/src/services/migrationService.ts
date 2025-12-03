/**
 * Migration service implementation.
 * 
 * Handles business logic for migration generation without UI concerns.
 */

import { IMigrationService, MigrationResult } from './interfaces';
import { IApiClient } from '../interfaces';
import { Migration } from '../api';

/**
 * Service for migration operations.
 * 
 * Implements business logic for generating migrations from scan reports.
 */
export class MigrationService implements IMigrationService {
  /**
   * Creates a new migration service.
   * 
   * @param apiClient - API client for migration operations
   */
  constructor(private readonly apiClient: IApiClient) {}

  /**
   * Validates that migration can be generated.
   * 
   * Checks that a scan report exists and has mismatches.
   * 
   * @param scanReportId - ID of the scan report to use
   * @returns Validation result
   */
  async validateMigration(scanReportId: string): Promise<{ valid: boolean; error?: string }> {
    if (!scanReportId) {
      return { valid: false, error: 'Scan report ID is required' };
    }

    const scanReport = await this.apiClient.getLatestScanReport();
    if (!scanReport) {
      return { valid: false, error: 'No scan report found. Run a scan first.' };
    }

    if (!scanReport.mismatches || scanReport.mismatches.length === 0) {
      return { valid: false, error: 'No mismatches found. Everything is in sync!' };
    }

    return { valid: true };
  }

  /**
   * Generates a migration from a scan report.
   * 
   * @param scanReportId - ID of the scan report to use
   * @param format - Migration format (default: 'sql')
   * @returns Promise resolving to migration result
   * @throws {Error} If migration generation fails
   * 
   * @example
   * ```typescript
   * const result = await migrationService.generateMigration('scan-123', 'sql');
   * if (result.success) {
   *   console.log(`Migration: ${result.migration.filename}`);
   *   console.log(`Content: ${result.migration.content}`);
   * }
   * ```
   */
  async generateMigration(scanReportId: string, format: string = 'sql'): Promise<MigrationResult> {
    try {
      // Validate before generating
      const validation = await this.validateMigration(scanReportId);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          migration: {} as Migration,
        };
      }

      // Generate migration via API
      const migration = await this.apiClient.generateMigration(scanReportId, format);

      return {
        success: true,
        migration,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        migration: {} as Migration,
      };
    }
  }

  /**
   * Gets migrations for a scan report.
   * 
   * @param scanReportId - Optional scan report ID to filter migrations
   * @returns Promise resolving to array of migrations
   */
  async getMigrations(scanReportId?: string): Promise<Migration[]> {
    return this.apiClient.getMigrations(scanReportId);
  }
}

