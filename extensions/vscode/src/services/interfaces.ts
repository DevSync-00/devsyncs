/**
 * Service layer interfaces for business logic.
 * 
 * These interfaces define the contracts for business logic services,
 * separating them from UI concerns and data access.
 */

import { ScanReport, Migration, Mismatch } from '../api';

/**
 * Result of a scan operation.
 */
export interface ScanResult {
  /** The scan report generated */
  report: ScanReport;
  /** Whether the scan was successful */
  success: boolean;
  /** Error message if scan failed */
  error?: string;
}

/**
 * Result of a migration generation operation.
 */
export interface MigrationResult {
  /** The generated migration */
  migration: Migration;
  /** Whether generation was successful */
  success: boolean;
  /** Error message if generation failed */
  error?: string;
}

/**
 * Service for scan operations.
 * 
 * Handles the business logic for scanning schemas, including validation,
 * execution, and result processing. Does not include UI concerns.
 * 
 * @example
 * ```typescript
 * const scanService = container.getScanService();
 * const result = await scanService.executeScan(workspacePath, dbConnection);
 * if (result.success) {
 *   console.log(`Found ${result.report.mismatches.length} mismatches`);
 * }
 * ```
 */
export interface IScanService {
  /**
   * Validates that scan can be executed.
   * 
   * @param workspacePath - Path to the workspace
   * @returns Validation result with missing fields if invalid
   */
  validateScan(workspacePath: string): { valid: boolean; missingFields?: string[] };

  /**
   * Executes a scan operation.
   * 
   * @param workspacePath - Path to the workspace to scan
   * @param databaseConnection - Optional database connection string
   * @returns Promise resolving to scan result
   * @throws {Error} If scan execution fails
   */
  executeScan(workspacePath: string, databaseConnection?: string): Promise<ScanResult>;

  /**
   * Gets the latest scan report.
   * 
   * @returns Promise resolving to the latest scan report, or null if none exists
   */
  getLatestScanReport(): Promise<ScanReport | null>;

  /**
   * Gets scan reports with optional limit.
   * 
   * @param limit - Maximum number of reports to retrieve
   * @returns Promise resolving to array of scan reports
   */
  getScanReports(limit?: number): Promise<ScanReport[]>;

  /**
   * Gets the dashboard URL for the current configuration.
   * 
   * @returns The dashboard URL, or empty string if not configured
   */
  getDashboardUrl(): string;
}

/**
 * Service for migration operations.
 * 
 * Handles the business logic for generating migrations from scan reports.
 * Does not include UI concerns.
 * 
 * @example
 * ```typescript
 * const migrationService = container.getMigrationService();
 * const result = await migrationService.generateMigration(scanReportId);
 * if (result.success) {
 *   console.log(`Migration generated: ${result.migration.filename}`);
 * }
 * ```
 */
export interface IMigrationService {
  /**
   * Validates that migration can be generated.
   * 
   * @param scanReportId - ID of the scan report to use
   * @returns Validation result
   */
  validateMigration(scanReportId: string): Promise<{ valid: boolean; error?: string }>;

  /**
   * Generates a migration from a scan report.
   * 
   * @param scanReportId - ID of the scan report to use
   * @param format - Migration format (default: 'sql')
   * @returns Promise resolving to migration result
   * @throws {Error} If migration generation fails
   */
  generateMigration(scanReportId: string, format?: string): Promise<MigrationResult>;

  /**
   * Gets migrations for a scan report.
   * 
   * @param scanReportId - Optional scan report ID to filter migrations
   * @returns Promise resolving to array of migrations
   */
  getMigrations(scanReportId?: string): Promise<Migration[]>;
}

/**
 * Service for report operations.
 * 
 * Handles business logic for retrieving and processing scan reports.
 * 
 * @example
 * ```typescript
 * const reportService = container.getReportService();
 * const report = await reportService.getLatestReport();
 * const summary = reportService.getSummary(report);
 * ```
 */
export interface IReportService {
  /**
   * Gets the latest scan report.
   * 
   * @returns Promise resolving to the latest report, or null if none exists
   */
  getLatestReport(): Promise<ScanReport | null>;

  /**
   * Gets a summary of a scan report.
   * 
   * @param report - The scan report to summarize
   * @returns Summary object with counts and statistics
   */
  getSummary(report: ScanReport): {
    totalMismatches: number;
    errors: number;
    warnings: number;
    info: number;
    byType: Record<string, number>;
  };

  /**
   * Filters mismatches by criteria.
   * 
   * @param mismatches - Array of mismatches to filter
   * @param criteria - Filter criteria
   * @returns Filtered array of mismatches
   */
  filterMismatches(
    mismatches: Mismatch[],
    criteria: {
      severity?: 'error' | 'warning' | 'info';
      type?: string;
      model?: string;
    }
  ): Mismatch[];
}

/**
 * Repository interface for scan report data access.
 * 
 * Provides a clean abstraction for data persistence and retrieval,
 * following the repository pattern.
 * 
 * @example
 * ```typescript
 * const scanRepository = container.getScanRepository();
 * await scanRepository.save(scanReport);
 * const report = await scanRepository.findById(reportId);
 * ```
 */
export interface IScanRepository {
  /**
   * Saves a scan report.
   * 
   * @param report - The scan report to save
   * @returns Promise that resolves when saved
   */
  save(report: ScanReport): Promise<void>;

  /**
   * Finds a scan report by ID.
   * 
   * @param id - The scan report ID
   * @returns Promise resolving to the report, or null if not found
   */
  findById(id: string): Promise<ScanReport | null>;

  /**
   * Finds the latest scan report.
   * 
   * @returns Promise resolving to the latest report, or null if none exists
   */
  findLatest(): Promise<ScanReport | null>;

  /**
   * Finds scan reports with optional limit.
   * 
   * @param limit - Maximum number of reports to retrieve
   * @returns Promise resolving to array of reports
   */
  findAll(limit?: number): Promise<ScanReport[]>;

  /**
   * Deletes a scan report.
   * 
   * @param id - The scan report ID to delete
   * @returns Promise that resolves when deleted
   */
  delete(id: string): Promise<void>;
}

/**
 * Repository interface for migration data access.
 * 
 * @example
 * ```typescript
 * const migrationRepository = container.getMigrationRepository();
 * await migrationRepository.save(migration);
 * const migrations = await migrationRepository.findByScanReport(scanReportId);
 * ```
 */
export interface IMigrationRepository {
  /**
   * Saves a migration.
   * 
   * @param migration - The migration to save
   * @returns Promise that resolves when saved
   */
  save(migration: Migration): Promise<void>;

  /**
   * Finds a migration by ID.
   * 
   * @param id - The migration ID
   * @returns Promise resolving to the migration, or null if not found
   */
  findById(id: string): Promise<Migration | null>;

  /**
   * Finds migrations for a scan report.
   * 
   * @param scanReportId - The scan report ID
   * @returns Promise resolving to array of migrations
   */
  findByScanReport(scanReportId: string): Promise<Migration[]>;

  /**
   * Finds all migrations.
   * 
   * @param limit - Maximum number of migrations to retrieve
   * @returns Promise resolving to array of migrations
   */
  findAll(limit?: number): Promise<Migration[]>;
}

