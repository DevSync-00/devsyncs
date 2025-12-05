/**
 * Virtual scrolling for large lists.
 * 
 * Renders only visible items to improve performance with large datasets.
 */

/**
 * Virtual scroll item.
 */
export interface VirtualScrollItem {
  /** Item index */
  index: number;
  /** Item data */
  data: any;
}

/**
 * Virtual scroll configuration.
 */
export interface VirtualScrollConfig {
  /** Item height in pixels */
  itemHeight: number;
  /** Container height in pixels */
  containerHeight: number;
  /** Number of items to render outside viewport (buffer) */
  overscan?: number;
  /** Total number of items */
  totalItems: number;
}

/**
 * Virtual scroll result.
 */
export interface VirtualScrollResult {
  /** Visible items */
  visibleItems: VirtualScrollItem[];
  /** Start index of visible range */
  startIndex: number;
  /** End index of visible range */
  endIndex: number;
  /** Total height of all items */
  totalHeight: number;
  /** Offset for visible items */
  offsetY: number;
}

/**
 * Calculates visible items for virtual scrolling.
 * 
 * @param scrollTop - Scroll position
 * @param config - Virtual scroll configuration
 * @returns Virtual scroll result
 * 
 * @example
 * ```typescript
 * const result = calculateVisibleItems(0, {
 *   itemHeight: 50,
 *   containerHeight: 500,
 *   totalItems: 1000,
 *   overscan: 5
 * });
 * 
 * // Renders only items 0-15 (visible + overscan)
 * // Instead of all 1000 items
 * ```
 */
export function calculateVisibleItems(
  scrollTop: number,
  config: VirtualScrollConfig
): VirtualScrollResult {
  const {
    itemHeight,
    containerHeight,
    overscan = 5,
    totalItems,
  } = config;

  const totalHeight = totalItems * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    totalItems - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // Generate visible items
  const visibleItems: VirtualScrollItem[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push({
      index: i,
      data: null, // To be filled by caller
    });
  }

  const offsetY = startIndex * itemHeight;

  return {
    visibleItems,
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
  };
}

/**
 * Virtual scroll manager.
 */
export class VirtualScrollManager {
  private config: VirtualScrollConfig;
  private scrollTop = 0;
  private items: any[] = [];

  constructor(config: VirtualScrollConfig) {
    this.config = config;
  }

  /**
   * Updates scroll position.
   */
  setScrollTop(scrollTop: number): void {
    this.scrollTop = scrollTop;
  }

  /**
   * Updates items.
   */
  setItems(items: any[]): void {
    this.items = items;
  }

  /**
   * Updates configuration.
   */
  updateConfig(config: Partial<VirtualScrollConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets visible items.
   */
  getVisibleItems(): VirtualScrollResult {
    const result = calculateVisibleItems(this.scrollTop, this.config);
    
    // Fill in item data
    result.visibleItems.forEach((item) => {
      item.data = this.items[item.index];
    });

    return result;
  }

  /**
   * Gets total height.
   */
  getTotalHeight(): number {
    return this.config.totalItems * this.config.itemHeight;
  }
}

