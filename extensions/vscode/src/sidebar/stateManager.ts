/**
 * Manages sidebar state persistence (expand/collapse memory).
 */

import * as vscode from 'vscode';

/**
 * Manages sidebar state persistence.
 */
export class SidebarStateManager {
  private static readonly STATE_KEY = 'devsync.sidebar.state';
  private static readonly FILTER_KEY = 'devsync.sidebar.filterPreset';
  private static readonly SEARCH_KEY = 'devsync.sidebar.searchQuery';
  private expandedSections: Set<string> = new Set();
  private filterPreset: 'all' | 'errors' | 'warnings' | 'info' = 'all';
  private lastSearch: string = '';

  constructor(private context: vscode.ExtensionContext) {
    this.loadState();
  }

  /**
   * Checks if a section is expanded.
   */
  isExpanded(sectionId: string): boolean {
    return this.expandedSections.has(sectionId);
  }

  /**
   * Sets expansion state for a section.
   */
  setExpanded(sectionId: string, expanded: boolean): void {
    if (expanded) {
      this.expandedSections.add(sectionId);
    } else {
      this.expandedSections.delete(sectionId);
    }
    this.saveState();
  }

  /**
   * Toggles expansion state.
   */
  toggleExpanded(sectionId: string): void {
    this.setExpanded(sectionId, !this.isExpanded(sectionId));
  }

  /**
   * Loads state from storage.
   */
  private loadState(): void {
    const stored = this.context.workspaceState.get<string[]>(SidebarStateManager.STATE_KEY);
    if (stored) {
      this.expandedSections = new Set(stored);
    } else {
      // Default expanded sections
      this.expandedSections = new Set(['commands']);
    }

    const storedFilter = this.context.workspaceState.get<string>(SidebarStateManager.FILTER_KEY);
    if (storedFilter === 'errors' || storedFilter === 'warnings' || storedFilter === 'info' || storedFilter === 'all') {
      this.filterPreset = storedFilter;
    }

    const storedSearch = this.context.workspaceState.get<string>(SidebarStateManager.SEARCH_KEY);
    if (storedSearch) {
      this.lastSearch = storedSearch;
    }
  }

  /**
   * Saves state to storage.
   */
  private saveState(): void {
    const array = Array.from(this.expandedSections);
    this.context.workspaceState.update(SidebarStateManager.STATE_KEY, array);
    this.context.workspaceState.update(SidebarStateManager.FILTER_KEY, this.filterPreset);
    this.context.workspaceState.update(SidebarStateManager.SEARCH_KEY, this.lastSearch);
  }

  /**
   * Resets state to defaults.
   */
  reset(): void {
    this.expandedSections = new Set(['commands']);
    this.filterPreset = 'all';
    this.lastSearch = '';
    this.saveState();
  }

  getFilterPreset(): 'all' | 'errors' | 'warnings' | 'info' {
    return this.filterPreset;
  }

  setFilterPreset(preset: 'all' | 'errors' | 'warnings' | 'info'): void {
    this.filterPreset = preset;
    this.saveState();
  }

  getLastSearch(): string {
    return this.lastSearch;
  }

  setLastSearch(query: string): void {
    this.lastSearch = query;
    this.saveState();
  }
}

