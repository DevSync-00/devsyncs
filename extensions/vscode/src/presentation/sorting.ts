/**
 * Sorting mismatches by various criteria.
 * 
 * Provides functionality to sort mismatches by various fields and directions.
 */

import { Mismatch } from '../api';

/**
 * Sort field.
 */
export type SortField = 'model' | 'field' | 'type' | 'severity' | 'message' | 'count';

/**
 * Sort direction.
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort configuration.
 */
export interface SortConfig {
  /** Field to sort by */
  field: SortField;
  /** Sort direction */
  direction: SortDirection;
}

/**
 * Sort manager for mismatches.
 */
export class MismatchSorter {
  /**
   * Sorts mismatches based on configuration.
   */
  static sort(mismatches: Mismatch[], config: SortConfig): Mismatch[] {
    const sorted = [...mismatches];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (config.field) {
        case 'model':
          comparison = (a.model || '').localeCompare(b.model || '');
          break;
        case 'field':
          const aField = 'field' in a ? (a.field || '') : '';
          const bField = 'field' in b ? (b.field || '') : '';
          comparison = aField.localeCompare(bField);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'severity':
          // Severity has priority: error > warning > info
          const severityPriority = { error: 3, warning: 2, info: 1, unknown: 0 };
          const aPriority = severityPriority[a.severity as keyof typeof severityPriority] || 0;
          const bPriority = severityPriority[b.severity as keyof typeof severityPriority] || 0;
          comparison = aPriority - bPriority;
          break;
        case 'message':
          const aFix = a.suggestedFix || '';
          const bFix = b.suggestedFix || '';
          comparison = aFix.localeCompare(bFix);
          break;
        case 'count':
          // For count, we'd need to group first, but for individual mismatches, use severity as proxy
          const countPriority = { error: 3, warning: 2, info: 1, unknown: 0 };
          const aCountPriority = countPriority[a.severity as keyof typeof countPriority] || 0;
          const bCountPriority = countPriority[b.severity as keyof typeof countPriority] || 0;
          comparison = aCountPriority - bCountPriority;
          break;
        default:
          comparison = 0;
      }

      // Apply direction
      if (config.direction === 'desc') {
        comparison = -comparison;
      }

      return comparison;
    });

    return sorted;
  }

  /**
   * Sorts by multiple fields (primary, secondary, etc.).
   */
  static sortByMultiple(mismatches: Mismatch[], configs: SortConfig[]): Mismatch[] {
    if (configs.length === 0) {
      return mismatches;
    }

    const sorted = [...mismatches];

    sorted.sort((a, b) => {
      for (const config of configs) {
        let comparison = 0;

        switch (config.field) {
          case 'model':
            comparison = (a.model || '').localeCompare(b.model || '');
            break;
          case 'field':
            const aField = 'field' in a ? (a.field || '') : '';
            const bField = 'field' in b ? (b.field || '') : '';
            comparison = aField.localeCompare(bField);
            break;
          case 'type':
            comparison = a.type.localeCompare(b.type);
            break;
          case 'severity':
            const severityPriority = { error: 3, warning: 2, info: 1, unknown: 0 };
            const aPriority = severityPriority[a.severity as keyof typeof severityPriority] || 0;
            const bPriority = severityPriority[b.severity as keyof typeof severityPriority] || 0;
            comparison = aPriority - bPriority;
            break;
          case 'message':
            const aFix = a.suggestedFix || '';
            const bFix = b.suggestedFix || '';
            comparison = aFix.localeCompare(bFix);
            break;
          default:
            comparison = 0;
        }

        // Apply direction
        if (config.direction === 'desc') {
          comparison = -comparison;
        }

        // If comparison is non-zero, return it (this field determines the sort)
        if (comparison !== 0) {
          return comparison;
        }
        // Otherwise, continue to next field
      }

      return 0;
    });

    return sorted;
  }

  /**
   * Gets default sort configuration.
   */
  static getDefaultSort(): SortConfig {
    return {
      field: 'severity',
      direction: 'desc',
    };
  }
}

