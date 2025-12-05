/**
 * Export reports in multiple formats.
 * 
 * Provides functionality to export scan reports in JSON, CSV, and PDF formats.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ScanReport, Mismatch } from '../api';
import { getScanResultsPath } from '../utils/paths';

/**
 * Export format.
 */
export type ExportFormat = 'json' | 'csv' | 'markdown' | 'text';

/**
 * Export options.
 */
export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** File path (optional, will prompt if not provided) */
  filePath?: string;
  /** Include summary in export */
  includeSummary?: boolean;
  /** Include details in export */
  includeDetails?: boolean;
}

/**
 * Export manager for reports.
 */
export class ReportExporter {
  /**
   * Exports a scan report to the specified format.
   */
  static async export(
    report: ScanReport,
    options: ExportOptions
  ): Promise<string> {
    const { format, filePath, includeSummary = true, includeDetails = true } = options;

    let content: string;
    let extension: string;

    switch (format) {
      case 'json':
        content = this.exportAsJson(report, includeSummary, includeDetails);
        extension = 'json';
        break;
      case 'csv':
        content = this.exportAsCsv(report, includeSummary, includeDetails);
        extension = 'csv';
        break;
      case 'markdown':
        content = this.exportAsMarkdown(report, includeSummary, includeDetails);
        extension = 'md';
        break;
      case 'text':
        content = this.exportAsText(report, includeSummary, includeDetails);
        extension = 'txt';
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    // Get file path
    let finalPath = filePath;
    if (!finalPath) {
      const defaultFileName = `devsync-report-${new Date().toISOString().split('T')[0]}.${extension}`;
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(defaultFileName),
        filters: {
          [format.toUpperCase()]: [`.${extension}`],
        },
      });

      if (!uri) {
        throw new Error('Export cancelled by user');
      }

      finalPath = uri.fsPath;
    }

    // Write file
    fs.writeFileSync(finalPath, content, 'utf8');

    return finalPath;
  }

  /**
   * Exports report as JSON.
   */
  private static exportAsJson(
    report: ScanReport,
    includeSummary: boolean,
    includeDetails: boolean
  ): string {
    const exportData: any = {
      timestamp: new Date().toISOString(),
      scanId: report.id,
    };

    if (includeSummary) {
      exportData.summary = {
        totalMismatches: report.mismatches.length,
        bySeverity: this.getSeverityCounts(report.mismatches),
        byType: this.getTypeCounts(report.mismatches),
      };
    }

    if (includeDetails) {
      exportData.mismatches = report.mismatches;
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Exports report as CSV.
   */
  private static exportAsCsv(
    report: ScanReport,
    includeSummary: boolean,
    includeDetails: boolean
  ): string {
    const lines: string[] = [];

    if (includeSummary) {
      lines.push('Summary');
      lines.push(`Total Mismatches,${report.mismatches.length}`);
      lines.push('');
      lines.push('By Severity');
      const severityCounts = this.getSeverityCounts(report.mismatches);
      for (const [severity, count] of Object.entries(severityCounts)) {
        lines.push(`${severity},${count}`);
      }
      lines.push('');
      lines.push('By Type');
      const typeCounts = this.getTypeCounts(report.mismatches);
      for (const [type, count] of Object.entries(typeCounts)) {
        lines.push(`${type},${count}`);
      }
      lines.push('');
    }

    if (includeDetails) {
      lines.push('Details');
      lines.push('Model,Field,Type,Severity,Suggested Fix');
      for (const mismatch of report.mismatches) {
        const model = this.escapeCsv(mismatch.model || '');
        const field = this.escapeCsv('field' in mismatch ? (mismatch.field || '') : '');
        const type = this.escapeCsv(mismatch.type);
        const severity = this.escapeCsv(mismatch.severity || '');
        const suggestedFix = this.escapeCsv(mismatch.suggestedFix || '');
        lines.push(`${model},${field},${type},${severity},${suggestedFix}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Exports report as Markdown.
   */
  private static exportAsMarkdown(
    report: ScanReport,
    includeSummary: boolean,
    includeDetails: boolean
  ): string {
    const lines: string[] = [];

    lines.push('# DevSync Scan Report');
    lines.push('');
    lines.push(`**Scan ID:** ${report.id}`);
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push('');

    if (includeSummary) {
      lines.push('## Summary');
      lines.push('');
      lines.push(`**Total Mismatches:** ${report.mismatches.length}`);
      lines.push('');

      lines.push('### By Severity');
      lines.push('');
      const severityCounts = this.getSeverityCounts(report.mismatches);
      lines.push('| Severity | Count |');
      lines.push('|----------|-------|');
      for (const [severity, count] of Object.entries(severityCounts)) {
        lines.push(`| ${severity} | ${count} |`);
      }
      lines.push('');

      lines.push('### By Type');
      lines.push('');
      const typeCounts = this.getTypeCounts(report.mismatches);
      lines.push('| Type | Count |');
      lines.push('|------|-------|');
      for (const [type, count] of Object.entries(typeCounts)) {
        lines.push(`| ${type} | ${count} |`);
      }
      lines.push('');
    }

    if (includeDetails) {
      lines.push('## Mismatches');
      lines.push('');
      lines.push('| Model | Field | Type | Severity | Suggested Fix |');
      lines.push('|-------|-------|------|----------|---------------|');
      for (const mismatch of report.mismatches) {
        const model = mismatch.model || '';
        const field = 'field' in mismatch ? (mismatch.field || '') : '';
        const type = mismatch.type;
        const severity = mismatch.severity || '';
        const suggestedFix = (mismatch.suggestedFix || '').replace(/\|/g, '\\|');
        lines.push(`| ${model} | ${field} | ${type} | ${severity} | ${suggestedFix} |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Exports report as plain text.
   */
  private static exportAsText(
    report: ScanReport,
    includeSummary: boolean,
    includeDetails: boolean
  ): string {
    const lines: string[] = [];

    lines.push('DevSync Scan Report');
    lines.push('='.repeat(50));
    lines.push(`Scan ID: ${report.id}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    if (includeSummary) {
      lines.push('Summary');
      lines.push('-'.repeat(50));
      lines.push(`Total Mismatches: ${report.mismatches.length}`);
      lines.push('');

      lines.push('By Severity:');
      const severityCounts = this.getSeverityCounts(report.mismatches);
      for (const [severity, count] of Object.entries(severityCounts)) {
        lines.push(`  ${severity}: ${count}`);
      }
      lines.push('');

      lines.push('By Type:');
      const typeCounts = this.getTypeCounts(report.mismatches);
      for (const [type, count] of Object.entries(typeCounts)) {
        lines.push(`  ${type}: ${count}`);
      }
      lines.push('');
    }

    if (includeDetails) {
      lines.push('Mismatches');
      lines.push('-'.repeat(50));
      for (const mismatch of report.mismatches) {
        lines.push(`Model: ${mismatch.model || 'N/A'}`);
        if ('field' in mismatch) {
          lines.push(`Field: ${mismatch.field || 'N/A'}`);
        }
        lines.push(`Type: ${mismatch.type}`);
        lines.push(`Severity: ${mismatch.severity || 'N/A'}`);
        if (mismatch.suggestedFix) {
          lines.push(`Suggested Fix: ${mismatch.suggestedFix}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Gets severity counts.
   */
  private static getSeverityCounts(mismatches: Mismatch[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const mismatch of mismatches) {
      const severity = mismatch.severity || 'unknown';
      counts[severity] = (counts[severity] || 0) + 1;
    }
    return counts;
  }

  /**
   * Gets type counts.
   */
  private static getTypeCounts(mismatches: Mismatch[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const mismatch of mismatches) {
      counts[mismatch.type] = (counts[mismatch.type] || 0) + 1;
    }
    return counts;
  }

  /**
   * Escapes CSV value.
   */
  private static escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

