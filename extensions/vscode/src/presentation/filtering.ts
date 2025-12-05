/**
 * Filtering mismatches by various criteria.
 * 
 * Provides functionality to filter mismatches by model, field, type, severity, etc.
 */

import { Mismatch } from '../api';

/**
 * Filter criteria.
 */
export interface FilterCriteria {
  /** Filter by model name */
  model?: string;
  /** Filter by field name */
  field?: string;
  /** Filter by mismatch type */
  type?: string;
  /** Filter by severity */
  severity?: 'error' | 'warning' | 'info';
  /** Text search in mismatch messages */
  searchText?: string;
}

/**
 * Filter manager for mismatches.
 */
export class MismatchFilter {
  /**
   * Filters mismatches based on criteria.
   */
  static filter(mismatches: Mismatch[], criteria: FilterCriteria): Mismatch[] {
    return mismatches.filter((mismatch) => {
      // Filter by model
      if (criteria.model && mismatch.model !== criteria.model) {
        return false;
      }

      // Filter by field (only for mismatches that have a field)
      if (criteria.field && 'field' in mismatch && mismatch.field !== criteria.field) {
        return false;
      }

      // Filter by type
      if (criteria.type && mismatch.type !== criteria.type) {
        return false;
      }

      // Filter by severity
      if (criteria.severity && mismatch.severity !== criteria.severity) {
        return false;
      }

      // Filter by search text
      if (criteria.searchText) {
        const searchLower = criteria.searchText.toLowerCase();
        const modelMatch = mismatch.model?.toLowerCase().includes(searchLower);
        const fieldMatch = 'field' in mismatch && mismatch.field?.toLowerCase().includes(searchLower);
        const typeMatch = mismatch.type.toLowerCase().includes(searchLower);
        const suggestedFixMatch = mismatch.suggestedFix?.toLowerCase().includes(searchLower);

        if (!modelMatch && !fieldMatch && !typeMatch && !suggestedFixMatch) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Gets unique values for a field.
   */
  static getUniqueValues(mismatches: Mismatch[], field: 'model' | 'field' | 'type' | 'severity'): string[] {
    const values = new Set<string>();

    for (const mismatch of mismatches) {
      let value: string | undefined;
      
      switch (field) {
        case 'model':
          value = mismatch.model;
          break;
        case 'field':
          value = 'field' in mismatch ? mismatch.field : undefined;
          break;
        case 'type':
          value = mismatch.type;
          break;
        case 'severity':
          value = mismatch.severity;
          break;
      }

      if (value) {
        values.add(value);
      }
    }

    return Array.from(values).sort();
  }

  /**
   * Gets filter statistics.
   */
  static getFilterStats(mismatches: Mismatch[]): {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    byModel: Record<string, number>;
  } {
    const stats = {
      total: mismatches.length,
      bySeverity: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      byModel: {} as Record<string, number>,
    };

    for (const mismatch of mismatches) {
      // Count by severity
      const severity = mismatch.severity || 'unknown';
      stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;

      // Count by type
      const type = mismatch.type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Count by model
      const model = mismatch.model || 'Unknown';
      stats.byModel[model] = (stats.byModel[model] || 0) + 1;
    }

    return stats;
  }
}

