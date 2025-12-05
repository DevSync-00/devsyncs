/**
 * Grouping mismatches by various criteria.
 * 
 * Provides functionality to group mismatches by severity, type, model, etc.
 */

import { Mismatch } from '../api';

/**
 * Group key for grouping operations.
 */
export type GroupKey = 'severity' | 'type' | 'model' | 'field';

/**
 * Grouped mismatches.
 */
export interface MismatchGroup {
  /** Group key value */
  key: string;
  /** Display label for the group */
  label: string;
  /** Mismatches in this group */
  mismatches: Mismatch[];
  /** Count of mismatches */
  count: number;
}

/**
 * Grouping manager for mismatches.
 */
export class MismatchGrouper {
  /**
   * Groups mismatches by severity.
   */
  static groupBySeverity(mismatches: Mismatch[]): MismatchGroup[] {
    const groups = new Map<string, Mismatch[]>();

    for (const mismatch of mismatches) {
      const severity = mismatch.severity || 'unknown';
      if (!groups.has(severity)) {
        groups.set(severity, []);
      }
      groups.get(severity)!.push(mismatch);
    }

    return Array.from(groups.entries()).map(([key, mismatches]) => ({
      key,
      label: this.formatSeverityLabel(key),
      mismatches,
      count: mismatches.length,
    })).sort((a, b) => {
      // Sort by severity priority: error > warning > info
      const priority = { error: 3, warning: 2, info: 1, unknown: 0 };
      return (priority[b.key as keyof typeof priority] || 0) - (priority[a.key as keyof typeof priority] || 0);
    });
  }

  /**
   * Groups mismatches by type.
   */
  static groupByType(mismatches: Mismatch[]): MismatchGroup[] {
    const groups = new Map<string, Mismatch[]>();

    for (const mismatch of mismatches) {
      const type = mismatch.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(mismatch);
    }

    return Array.from(groups.entries()).map(([key, mismatches]) => ({
      key,
      label: this.formatTypeLabel(key),
      mismatches,
      count: mismatches.length,
    })).sort((a, b) => b.count - a.count); // Sort by count descending
  }

  /**
   * Groups mismatches by model.
   */
  static groupByModel(mismatches: Mismatch[]): MismatchGroup[] {
    const groups = new Map<string, Mismatch[]>();

    for (const mismatch of mismatches) {
      const model = mismatch.model || 'Unknown';
      if (!groups.has(model)) {
        groups.set(model, []);
      }
      groups.get(model)!.push(mismatch);
    }

    return Array.from(groups.entries()).map(([key, mismatches]) => ({
      key,
      label: key,
      mismatches,
      count: mismatches.length,
    })).sort((a, b) => {
      // Sort by count descending, then alphabetically
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      return a.label.localeCompare(b.label);
    });
  }

  /**
   * Groups mismatches by field.
   */
  static groupByField(mismatches: Mismatch[]): MismatchGroup[] {
    const groups = new Map<string, Mismatch[]>();

    for (const mismatch of mismatches) {
      if ('field' in mismatch) {
        const field = mismatch.field || 'Unknown';
        const model = mismatch.model || 'Unknown';
        const groupKey = `${model}.${field}`;
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(mismatch);
      } else {
        // For mismatches without fields (e.g., missing_table), group by model
        const model = mismatch.model || 'Unknown';
        const groupKey = `${model}.No Field`;
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(mismatch);
      }
    }

    return Array.from(groups.entries()).map(([key, mismatches]) => ({
      key,
      label: key,
      mismatches,
      count: mismatches.length,
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Groups mismatches by the specified key.
   */
  static groupBy(mismatches: Mismatch[], key: GroupKey): MismatchGroup[] {
    switch (key) {
      case 'severity':
        return this.groupBySeverity(mismatches);
      case 'type':
        return this.groupByType(mismatches);
      case 'model':
        return this.groupByModel(mismatches);
      case 'field':
        return this.groupByField(mismatches);
      default:
        return [];
    }
  }

  /**
   * Formats severity label for display.
   */
  private static formatSeverityLabel(severity: string): string {
    const labels: Record<string, string> = {
      error: 'Errors',
      warning: 'Warnings',
      info: 'Info',
      unknown: 'Unknown',
    };
    return labels[severity] || severity.charAt(0).toUpperCase() + severity.slice(1);
  }

  /**
   * Formats type label for display.
   */
  private static formatTypeLabel(type: string): string {
    // Convert snake_case to Title Case
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

