/**
 * Manages sidebar state persistence (expand/collapse memory).
 */

import * as vscode from 'vscode';

/**
 * Manages sidebar state persistence.
 */
export class SidebarStateManager {
  private static readonly STATE_KEY = 'devsync.sidebar.state';
  private expandedSections: Set<string> = new Set();

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
  }

  /**
   * Saves state to storage.
   */
  private saveState(): void {
    const array = Array.from(this.expandedSections);
    this.context.workspaceState.update(SidebarStateManager.STATE_KEY, array);
  }

  /**
   * Resets state to defaults.
   */
  reset(): void {
    this.expandedSections = new Set(['commands']);
    this.saveState();
  }
}

