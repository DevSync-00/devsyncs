/**
 * Summary dashboard for scan results.
 * 
 * Provides a comprehensive summary view of scan results with statistics and visualizations.
 */

import { ScanReport, Mismatch } from '../api';

/**
 * Dashboard statistics.
 */
export interface DashboardStats {
  /** Total number of mismatches */
  totalMismatches: number;
  /** Counts by severity */
  bySeverity: {
    error: number;
    warning: number;
    info: number;
  };
  /** Counts by type */
  byType: Record<string, number>;
  /** Counts by model */
  byModel: Record<string, number>;
  /** Most common mismatch types */
  topTypes: Array<{ type: string; count: number }>;
  /** Models with most mismatches */
  topModels: Array<{ model: string; count: number }>;
}

/**
 * Dashboard manager.
 */
export class DashboardManager {
  /**
   * Generates dashboard statistics from a scan report.
   */
  static generateStats(report: ScanReport): DashboardStats {
    const mismatches = report.mismatches || [];

    const stats: DashboardStats = {
      totalMismatches: mismatches.length,
      bySeverity: {
        error: 0,
        warning: 0,
        info: 0,
      },
      byType: {},
      byModel: {},
      topTypes: [],
      topModels: [],
    };

    // Count by severity
    for (const mismatch of mismatches) {
      const severity = mismatch.severity;
      if (severity === 'error' || severity === 'warning' || severity === 'info') {
        stats.bySeverity[severity]++;
      }
    }

    // Count by type
    for (const mismatch of mismatches) {
      const type = mismatch.type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }

    // Count by model
    for (const mismatch of mismatches) {
      const model = mismatch.model || 'Unknown';
      stats.byModel[model] = (stats.byModel[model] || 0) + 1;
    }

    // Get top types
    stats.topTypes = Object.entries(stats.byType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get top models
    stats.topModels = Object.entries(stats.byModel)
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  /**
   * Formats dashboard stats as a summary string.
   */
  static formatSummary(stats: DashboardStats): string {
    const lines: string[] = [];

    lines.push(`Total Mismatches: ${stats.totalMismatches}`);
    lines.push('');
    lines.push('By Severity:');
    lines.push(`  Errors: ${stats.bySeverity.error}`);
    lines.push(`  Warnings: ${stats.bySeverity.warning}`);
    lines.push(`  Info: ${stats.bySeverity.info}`);
    lines.push('');

    if (stats.topTypes.length > 0) {
      lines.push('Top Mismatch Types:');
      for (const { type, count } of stats.topTypes.slice(0, 5)) {
        lines.push(`  ${type}: ${count}`);
      }
      lines.push('');
    }

    if (stats.topModels.length > 0) {
      lines.push('Top Models:');
      for (const { model, count } of stats.topModels.slice(0, 5)) {
        lines.push(`  ${model}: ${count}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Gets health score (0-100) based on mismatches.
   */
  static getHealthScore(stats: DashboardStats): number {
    if (stats.totalMismatches === 0) {
      return 100;
    }

    // Calculate score based on severity
    // Errors reduce score more than warnings
    const errorWeight = 10;
    const warningWeight = 5;
    const infoWeight = 1;

    const totalWeight = stats.bySeverity.error * errorWeight +
                        stats.bySeverity.warning * warningWeight +
                        stats.bySeverity.info * infoWeight;

    // Normalize to 0-100 scale (assuming max 100 mismatches for full scale)
    const maxWeight = 100 * errorWeight;
    const score = Math.max(0, 100 - (totalWeight / maxWeight) * 100);

    return Math.round(score);
  }
}

