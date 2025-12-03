/**
 * Report service implementation.
 * 
 * Handles business logic for retrieving and processing scan reports.
 */

import { IReportService } from './interfaces';
import { IApiClient } from '../interfaces';
import { ScanReport, Mismatch } from '../api';

/**
 * Service for report operations.
 * 
 * Provides business logic for working with scan reports, including
 * summarization and filtering.
 */
export class ReportService implements IReportService {
  /**
   * Creates a new report service.
   * 
   * @param apiClient - API client for retrieving reports
   */
  constructor(private readonly apiClient: IApiClient) {}

  /**
   * Gets the latest scan report.
   * 
   * @returns Promise resolving to the latest report, or null if none exists
   */
  async getLatestReport(): Promise<ScanReport | null> {
    return this.apiClient.getLatestScanReport();
  }

  /**
   * Gets a summary of a scan report.
   * 
   * Calculates statistics including:
   * - Total mismatches
   * - Counts by severity (error, warning, info)
   * - Counts by type
   * 
   * @param report - The scan report to summarize
   * @returns Summary object with counts and statistics
   * 
   * @example
   * ```typescript
   * const report = await reportService.getLatestReport();
   * if (report) {
   *   const summary = reportService.getSummary(report);
   *   console.log(`Total: ${summary.totalMismatches}`);
   *   console.log(`Errors: ${summary.errors}`);
   * }
   * ```
   */
  getSummary(report: ScanReport): {
    totalMismatches: number;
    errors: number;
    warnings: number;
    info: number;
    byType: Record<string, number>;
  } {
    const mismatches = report.mismatches || [];
    const summary = {
      totalMismatches: mismatches.length,
      errors: 0,
      warnings: 0,
      info: 0,
      byType: {} as Record<string, number>,
    };

    mismatches.forEach((mismatch) => {
      // Count by severity
      if (mismatch.severity === 'error') {
        summary.errors++;
      } else if (mismatch.severity === 'warning') {
        summary.warnings++;
      } else {
        summary.info++;
      }

      // Count by type
      const type = mismatch.type;
      summary.byType[type] = (summary.byType[type] || 0) + 1;
    });

    return summary;
  }

  /**
   * Filters mismatches by criteria.
   * 
   * @param mismatches - Array of mismatches to filter
   * @param criteria - Filter criteria
   * @returns Filtered array of mismatches
   * 
   * @example
   * ```typescript
   * const errors = reportService.filterMismatches(
   *   report.mismatches,
   *   { severity: 'error' }
   * );
   * const userModelMismatches = reportService.filterMismatches(
   *   report.mismatches,
   *   { model: 'User' }
   * );
   * ```
   */
  filterMismatches(
    mismatches: Mismatch[],
    criteria: {
      severity?: 'error' | 'warning' | 'info';
      type?: string;
      model?: string;
    }
  ): Mismatch[] {
    return mismatches.filter((mismatch) => {
      if (criteria.severity && mismatch.severity !== criteria.severity) {
        return false;
      }
      if (criteria.type && mismatch.type !== criteria.type) {
        return false;
      }
      if (criteria.model && mismatch.model !== criteria.model) {
        return false;
      }
      return true;
    });
  }
}

