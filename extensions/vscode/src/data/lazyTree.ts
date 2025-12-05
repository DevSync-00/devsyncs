/**
 * Lazy loading for tree nodes.
 * 
 * Provides capabilities to load tree nodes on demand instead of loading all at once.
 */

import * as vscode from 'vscode';

/**
 * Tree node data.
 */
export interface TreeNodeData {
  /** Node ID */
  id: string;
  /** Node label */
  label: string;
  /** Node description */
  description?: string;
  /** Node icon */
  icon?: string;
  /** Node tooltip */
  tooltip?: string;
  /** Node context value */
  contextValue?: string;
  /** Node command */
  command?: vscode.Command;
  /** Whether node has children */
  hasChildren: boolean;
  /** Children count (if known) */
  childrenCount?: number;
  /** Node data */
  data?: any;
}

/**
 * Lazy tree node loader.
 */
export interface LazyTreeNodeLoader {
  (parentId?: string): Promise<TreeNodeData[]>;
}

/**
 * Lazy tree node manager.
 */
export class LazyTreeNodeManager {
  private loader: LazyTreeNodeLoader;
  private loadedNodes: Map<string, TreeNodeData[]> = new Map();
  private loadingNodes: Set<string> = new Set();
  private nodeMetadata: Map<string, TreeNodeData> = new Map();

  constructor(loader: LazyTreeNodeLoader) {
    this.loader = loader;
  }

  /**
   * Loads children for a node.
   */
  async loadChildren(parentId?: string): Promise<TreeNodeData[]> {
    const key = parentId || 'root';

    // Return cached if available
    if (this.loadedNodes.has(key)) {
      return this.loadedNodes.get(key)!;
    }

    // Wait if already loading
    if (this.loadingNodes.has(key)) {
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.loadingNodes.has(key)) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 50);
      });
      return this.loadedNodes.get(key) || [];
    }

    // Load children
    this.loadingNodes.add(key);
    try {
      const children = await this.loader(parentId);
      this.loadedNodes.set(key, children);
      
      // Store metadata for each child
      children.forEach((child) => {
        this.nodeMetadata.set(child.id, child);
      });

      return children;
    } finally {
      this.loadingNodes.delete(key);
    }
  }

  /**
   * Preloads children for a node.
   */
  async preloadChildren(parentId?: string): Promise<void> {
    const key = parentId || 'root';
    if (!this.loadedNodes.has(key) && !this.loadingNodes.has(key)) {
      await this.loadChildren(parentId);
    }
  }

  /**
   * Gets node metadata.
   */
  getNodeMetadata(nodeId: string): TreeNodeData | undefined {
    return this.nodeMetadata.get(nodeId);
  }

  /**
   * Invalidates cache for a node.
   */
  invalidateNode(parentId?: string): void {
    const key = parentId || 'root';
    this.loadedNodes.delete(key);
  }

  /**
   * Clears all caches.
   */
  clearCache(): void {
    this.loadedNodes.clear();
    this.nodeMetadata.clear();
  }

  /**
   * Checks if node is loaded.
   */
  isNodeLoaded(parentId?: string): boolean {
    const key = parentId || 'root';
    return this.loadedNodes.has(key);
  }

  /**
   * Checks if node is loading.
   */
  isNodeLoading(parentId?: string): boolean {
    const key = parentId || 'root';
    return this.loadingNodes.has(key);
  }
}

