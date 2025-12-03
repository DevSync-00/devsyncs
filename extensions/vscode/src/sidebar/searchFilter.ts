/**
 * Search and filter functionality for sidebar tree items.
 */

import { EnhancedTreeItem } from './treeItem';

/**
 * Filters tree items based on search query.
 */
export class SidebarSearchFilter {
  /**
   * Filters tree items based on search query.
   */
  filter(items: EnhancedTreeItem[], query: string): EnhancedTreeItem[] {
    if (!query || query.trim().length === 0) {
      return items;
    }

    const normalizedQuery = query.toLowerCase().trim();
    const filtered: EnhancedTreeItem[] = [];

    for (const item of items) {
      if (this.matches(item, normalizedQuery)) {
        filtered.push(item);
      }
    }

    return filtered;
  }

  /**
   * Checks if an item matches the search query.
   */
  private matches(item: EnhancedTreeItem, query: string): boolean {
    // Match label
    if (item.label.toLowerCase().includes(query)) {
      return true;
    }

    // Match description
    const description = item.description;
    if (description && typeof description === 'string' && description.toLowerCase().includes(query)) {
      return true;
    }

    // Match tooltip
    const tooltip = item.tooltip;
    if (tooltip && typeof tooltip === 'string' && tooltip.toLowerCase().includes(query)) {
      return true;
    }

    // Match mismatch details
    if (item.mismatch) {
      const mismatch = item.mismatch;
      
      // Match model name
      if (mismatch.model.toLowerCase().includes(query)) {
        return true;
      }

      // Match field name
      if ('field' in mismatch && mismatch.field && mismatch.field.toLowerCase().includes(query)) {
        return true;
      }

      // Match type
      if (mismatch.type.toLowerCase().includes(query)) {
        return true;
      }

      // Match severity
      if (mismatch.severity && mismatch.severity.toLowerCase().includes(query)) {
        return true;
      }
    }

    // Match context value
    if (item.contextValue && item.contextValue.toLowerCase().includes(query)) {
      return true;
    }

    return false;
  }

  /**
   * Highlights matching text in a string.
   */
  highlight(text: string, query: string): string {
    if (!query || query.length === 0) {
      return text;
    }

    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return text.replace(regex, '**$1**');
  }

  /**
   * Escapes special regex characters.
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

