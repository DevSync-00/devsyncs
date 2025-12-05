/**
 * Trend analysis over time.
 * 
 * Provides functionality to analyze trends in scan results over time.
 */

import { ScanReport } from '../api';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Trend data point.
 */
export interface TrendDataPoint {
  /** Timestamp */
  timestamp: Date;
  /** Total mismatches */
  totalMismatches: number;
  /** Counts by severity */
  bySeverity: {
    error: number;
    warning: number;
    info: number;
  };
  /** Scan ID */
  scanId: string;
}

/**
 * Trend analysis result.
 */
export interface TrendAnalysis {
  /** Data points */
  dataPoints: TrendDataPoint[];
  /** Trend direction */
  direction: 'improving' | 'worsening' | 'stable';
  /** Change percentage */
  changePercentage: number;
  /** Average mismatches */
  averageMismatches: number;
  /** Peak mismatches */
  peakMismatches: number;
  /** Recent trend (last N scans) */
  recentTrend: 'improving' | 'worsening' | 'stable';
}

/**
 * Trend analyzer.
 */
export class TrendAnalyzer {
  /**
   * Analyzes trends from multiple scan reports.
   */
  static analyze(reports: ScanReport[]): TrendAnalysis {
    if (reports.length === 0) {
      return {
        dataPoints: [],
        direction: 'stable',
        changePercentage: 0,
        averageMismatches: 0,
        peakMismatches: 0,
        recentTrend: 'stable',
      };
    }

    // Sort reports by timestamp (assuming they have timestamps)
    const sortedReports = [...reports].sort((a, b) => {
      // Use scan ID as proxy for timestamp if timestamp not available
      return a.id.localeCompare(b.id);
    });

    // Generate data points
    const dataPoints: TrendDataPoint[] = sortedReports.map((report) => {
      const mismatches = report.mismatches || [];
      const bySeverity = {
        error: 0,
        warning: 0,
        info: 0,
      };

      for (const mismatch of mismatches) {
        const severity = mismatch.severity;
        if (severity === 'error' || severity === 'warning' || severity === 'info') {
          bySeverity[severity]++;
        }
      }

      return {
        timestamp: new Date(), // Would use actual timestamp from report if available
        totalMismatches: mismatches.length,
        bySeverity,
        scanId: report.id,
      };
    });

    // Calculate trend direction
    const first = dataPoints[0];
    const last = dataPoints[dataPoints.length - 1];
    const change = last.totalMismatches - first.totalMismatches;
    const changePercentage = first.totalMismatches > 0
      ? (change / first.totalMismatches) * 100
      : 0;

    let direction: 'improving' | 'worsening' | 'stable';
    if (changePercentage < -5) {
      direction = 'improving';
    } else if (changePercentage > 5) {
      direction = 'worsening';
    } else {
      direction = 'stable';
    }

    // Calculate average
    const averageMismatches = dataPoints.reduce((sum, point) => sum + point.totalMismatches, 0) / dataPoints.length;

    // Find peak
    const peakMismatches = Math.max(...dataPoints.map((point) => point.totalMismatches));

    // Calculate recent trend (last 3 scans)
    const recentScans = dataPoints.slice(-3);
    let recentTrend: 'improving' | 'worsening' | 'stable';
    if (recentScans.length >= 2) {
      const recentChange = recentScans[recentScans.length - 1].totalMismatches - recentScans[0].totalMismatches;
      if (recentChange < -2) {
        recentTrend = 'improving';
      } else if (recentChange > 2) {
        recentTrend = 'worsening';
      } else {
        recentTrend = 'stable';
      }
    } else {
      recentTrend = 'stable';
    }

    return {
      dataPoints,
      direction,
      changePercentage: Math.round(changePercentage * 100) / 100,
      averageMismatches: Math.round(averageMismatches * 100) / 100,
      peakMismatches,
      recentTrend,
    };
  }

  /**
   * Loads historical scan reports from disk.
   */
  static loadHistoricalReports(workspacePath: string, maxReports: number = 10): ScanReport[] {
    // Construct scan results path manually since we only have a string path
    const scanResultsPath = path.join(workspacePath, '.devsync', 'scan-results');
    const reports: ScanReport[] = [];

    if (!fs.existsSync(scanResultsPath)) {
      return reports;
    }

    try {
      const files = fs.readdirSync(scanResultsPath)
        .filter((file) => file.endsWith('.json'))
        .sort()
        .slice(-maxReports);

      for (const file of files) {
        const filePath = path.join(scanResultsPath, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const report = JSON.parse(content) as ScanReport;
          reports.push(report);
        } catch (error) {
          // Skip invalid files
          console.error(`Failed to load report from ${filePath}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to read scan results directory:`, error);
    }

    return reports;
  }

  /**
   * Formats trend analysis as a summary string.
   */
  static formatTrendSummary(analysis: TrendAnalysis): string {
    const lines: string[] = [];

    lines.push('Trend Analysis');
    lines.push('='.repeat(50));
    lines.push(`Total Scans Analyzed: ${analysis.dataPoints.length}`);
    lines.push(`Average Mismatches: ${analysis.averageMismatches.toFixed(1)}`);
    lines.push(`Peak Mismatches: ${analysis.peakMismatches}`);
    lines.push('');

    if (analysis.dataPoints.length >= 2) {
      lines.push(`Overall Trend: ${analysis.direction.toUpperCase()}`);
      lines.push(`Change: ${analysis.changePercentage > 0 ? '+' : ''}${analysis.changePercentage.toFixed(1)}%`);
      lines.push(`Recent Trend: ${analysis.recentTrend.toUpperCase()}`);
    }

    return lines.join('\n');
  }
}

