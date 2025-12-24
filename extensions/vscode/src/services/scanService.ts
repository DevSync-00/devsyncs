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
import { detectProjectInfo, matchProject } from '../utils/project-detector';

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
   * - Project ID (optional - will try to auto-detect if missing)
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
    // Project ID is optional - we'll try to auto-detect it
    // Only require it if we can't auto-detect (handled in executeScan)

    if (missingFields.length > 0) {
      return { valid: false, missingFields };
    }

    return { valid: true };
  }

  /**
   * Executes a scan operation.
   * 
   * Performs the actual scan via the API client and returns the result.
   * Auto-detects project if projectId is not configured.
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

      const config = this.configManager.getAll();
      
      // Auto-detect project if projectId is not set
      let projectId = config.projectId;
      
      if (!projectId && config.apiUrl && config.apiKey) {
        try {
          // Detect project info from workspace
          const projectInfo = detectProjectInfo(workspacePath);
          
          // Try to list projects and match (with increased timeout)
          // This can take time if there are many projects or slow network
          const existingProjects = await Promise.race([
            this.apiClient.listProjects(),
            new Promise<Array<{ id: string; name: string; slug?: string; schemaType?: string; schema_type?: string }>>((_, reject) => 
              setTimeout(() => reject(new Error('Project detection timed out. Please set devsync.projectId manually.')), 60000)
            )
          ]);
          const matches = matchProject(projectInfo, existingProjects);
          
          if (matches.length > 0 && matches[0].score >= 50) {
            // Found a good match - use it
            projectId = matches[0].project.id;
            
            // Update config with detected project ID (optional - for future use)
            // For now, we'll use it for this scan only
          } else {
            // No matching project found
            return {
              success: false,
              error: `No matching project found in DevSync. Please save your project to DevSync first.\n\n` +
                     `Detected project: ${projectInfo.name}${projectInfo.schemaType ? ` (${projectInfo.schemaType})` : ''}\n` +
                     `Go to the DevSync dashboard to create a project, or set devsync.projectId in your settings.`,
              report: {} as ScanReport,
            };
          }
        } catch (error) {
          // Check if it's an authentication error
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isAuthError = errorMessage.includes('Unauthorized') || 
                             errorMessage.includes('401') ||
                             errorMessage.includes('authentication') ||
                             errorMessage.includes('not authenticated') ||
                             errorMessage.includes('API key may be missing');
          
          if (isAuthError) {
            return {
              success: false,
              error: `Authentication failed. Please sign in to DevSync first.\n\n` +
                     `Use the command palette (Ctrl+Shift+P) and run "DevSync: Sign In" or configure devsync.apiKey in your settings.\n\n` +
                     `If you're using the CLI, run "devsync login" and the extension will use those credentials.`,
              report: {} as ScanReport,
            };
          }
          
          // Check if it's a network error
          const isNetworkError = errorMessage.includes('fetch failed') ||
                                errorMessage.includes('ECONNREFUSED') ||
                                errorMessage.includes('network') ||
                                errorMessage.includes('timeout');
          
          if (isNetworkError) {
            return {
              success: false,
              error: `Network error while trying to auto-detect project. Please check your connection and devsync.apiUrl setting.\n\n` +
                     `Original error: ${errorMessage}`,
              report: {} as ScanReport,
            };
          }
          
          // If auto-detection fails for other reasons, return helpful error
          return {
            success: false,
            error: `Failed to auto-detect project. Please set devsync.projectId in your settings.\n\n` +
                   `Original error: ${errorMessage}`,
            report: {} as ScanReport,
          };
        }
      }
      
      if (!projectId) {
        return {
          success: false,
          error: `Project ID is required. Please set devsync.projectId in your settings, or save your project to DevSync first.`,
          report: {} as ScanReport,
        };
      }

      // Update API client with detected project ID if needed
      const apiClient = this.apiClient as any;
      if (apiClient.setProjectId && apiClient.getProjectId() !== projectId) {
        apiClient.setProjectId(projectId);
      }

      // Execute scan via API
      let report: ScanReport;
      try {
        report = await this.apiClient.scan(workspacePath, databaseConnection);
      } catch (error) {
        // Catch and handle authentication errors from scan
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('401') || errorMessage.includes('API key')) {
          return {
            success: false,
            error: `Authentication failed during scan. Please sign in to DevSync first.\n\n` +
                   `Use the command palette (Ctrl+Shift+P) and run "DevSync: Sign In" or configure devsync.apiKey in your settings.\n\n` +
                   `If you're using the CLI, run "devsync login" and the extension will use those credentials.`,
            report: {} as ScanReport,
          };
        }
        // Re-throw other errors
        throw error;
      }

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

