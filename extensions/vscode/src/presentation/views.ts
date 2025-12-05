/**
 * Customizable views for data presentation.
 * 
 * Provides functionality to create and manage custom views of mismatches.
 */

import { Mismatch } from '../api';
import { FilterCriteria } from './filtering';
import { SortConfig } from './sorting';
import { GroupKey } from './grouping';

/**
 * View configuration.
 */
export interface ViewConfig {
  /** View name */
  name: string;
  /** View description */
  description?: string;
  /** Filter criteria */
  filters: FilterCriteria;
  /** Sort configuration */
  sort: SortConfig;
  /** Group by key */
  groupBy?: GroupKey;
  /** Whether to show only grouped items */
  showGroupedOnly?: boolean;
}

/**
 * View manager for customizable views.
 */
export class ViewManager {
  private views: Map<string, ViewConfig> = new Map();

  /**
   * Creates a new view.
   */
  createView(id: string, config: ViewConfig): void {
    this.views.set(id, config);
  }

  /**
   * Gets a view by ID.
   */
  getView(id: string): ViewConfig | undefined {
    return this.views.get(id);
  }

  /**
   * Gets all views.
   */
  getAllViews(): ViewConfig[] {
    return Array.from(this.views.values());
  }

  /**
   * Updates a view.
   */
  updateView(id: string, updates: Partial<ViewConfig>): void {
    const existing = this.views.get(id);
    if (existing) {
      this.views.set(id, { ...existing, ...updates });
    }
  }

  /**
   * Deletes a view.
   */
  deleteView(id: string): boolean {
    return this.views.delete(id);
  }

  /**
   * Applies a view to mismatches.
   */
  applyView(mismatches: Mismatch[], viewId: string): Mismatch[] {
    const view = this.views.get(viewId);
    if (!view) {
      return mismatches;
    }

    // Import here to avoid circular dependencies
    const filtering = require('./filtering');
    const sorting = require('./sorting');

    // Apply filters
    let filtered = filtering.MismatchFilter.filter(mismatches, view.filters);

    // Apply sorting
    filtered = sorting.MismatchSorter.sort(filtered, view.sort);

    return filtered;
  }

  /**
   * Gets default views.
   */
  static getDefaultViews(): ViewConfig[] {
    return [
      {
        name: 'All Mismatches',
        description: 'Show all mismatches',
        filters: {},
        sort: { field: 'severity', direction: 'desc' },
      },
      {
        name: 'Errors Only',
        description: 'Show only error severity mismatches',
        filters: { severity: 'error' },
        sort: { field: 'severity', direction: 'desc' },
      },
      {
        name: 'Warnings Only',
        description: 'Show only warning severity mismatches',
        filters: { severity: 'warning' },
        sort: { field: 'severity', direction: 'desc' },
      },
      {
        name: 'Grouped by Severity',
        description: 'Group mismatches by severity',
        filters: {},
        sort: { field: 'severity', direction: 'desc' },
        groupBy: 'severity',
      },
      {
        name: 'Grouped by Type',
        description: 'Group mismatches by type',
        filters: {},
        sort: { field: 'type', direction: 'asc' },
        groupBy: 'type',
      },
      {
        name: 'Grouped by Model',
        description: 'Group mismatches by model',
        filters: {},
        sort: { field: 'model', direction: 'asc' },
        groupBy: 'model',
      },
    ];
  }
}

