/**
 * Pagination system for large datasets.
 * 
 * Provides capabilities to paginate large datasets and load data incrementally.
 */

/**
 * Pagination options.
 */
export interface PaginationOptions {
  /** Page size (items per page) */
  pageSize: number;
  /** Initial page (0-indexed) */
  initialPage?: number;
  /** Total items (if known) */
  totalItems?: number;
}

/**
 * Pagination result.
 */
export interface PaginationResult<T> {
  /** Items for current page */
  items: T[];
  /** Current page (0-indexed) */
  currentPage: number;
  /** Total pages */
  totalPages: number;
  /** Total items */
  totalItems: number;
  /** Has next page */
  hasNext: boolean;
  /** Has previous page */
  hasPrevious: boolean;
  /** Page size */
  pageSize: number;
}

/**
 * Pagination manager.
 */
export class PaginationManager<T> {
  private items: T[] = [];
  private pageSize: number;
  private currentPage: number;
  private totalItems: number;

  constructor(options: PaginationOptions) {
    this.pageSize = options.pageSize;
    this.currentPage = options.initialPage || 0;
    this.totalItems = options.totalItems || 0;
  }

  /**
   * Sets items.
   */
  setItems(items: T[]): void {
    this.items = items;
    this.totalItems = items.length;
  }

  /**
   * Sets total items.
   */
  setTotalItems(total: number): void {
    this.totalItems = total;
  }

  /**
   * Gets current page.
   */
  getCurrentPage(): number {
    return this.currentPage;
  }

  /**
   * Gets page size.
   */
  getPageSize(): number {
    return this.pageSize;
  }

  /**
   * Gets total pages.
   */
  getTotalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize);
  }

  /**
   * Gets paginated result for current page.
   */
  getCurrentPageData(): PaginationResult<T> {
    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;
    const pageItems = this.items.slice(start, end);

    return {
      items: pageItems,
      currentPage: this.currentPage,
      totalPages: this.getTotalPages(),
      totalItems: this.totalItems,
      hasNext: this.currentPage < this.getTotalPages() - 1,
      hasPrevious: this.currentPage > 0,
      pageSize: this.pageSize,
    };
  }

  /**
   * Gets paginated result for specific page.
   */
  getPage(page: number): PaginationResult<T> {
    if (page < 0 || page >= this.getTotalPages()) {
      throw new Error(`Page ${page} is out of range`);
    }

    const start = page * this.pageSize;
    const end = start + this.pageSize;
    const pageItems = this.items.slice(start, end);

    return {
      items: pageItems,
      currentPage: page,
      totalPages: this.getTotalPages(),
      totalItems: this.totalItems,
      hasNext: page < this.getTotalPages() - 1,
      hasPrevious: page > 0,
      pageSize: this.pageSize,
    };
  }

  /**
   * Goes to next page.
   */
  nextPage(): PaginationResult<T> {
    if (this.currentPage < this.getTotalPages() - 1) {
      this.currentPage++;
    }
    return this.getCurrentPageData();
  }

  /**
   * Goes to previous page.
   */
  previousPage(): PaginationResult<T> {
    if (this.currentPage > 0) {
      this.currentPage--;
    }
    return this.getCurrentPageData();
  }

  /**
   * Goes to specific page.
   */
  goToPage(page: number): PaginationResult<T> {
    if (page < 0 || page >= this.getTotalPages()) {
      throw new Error(`Page ${page} is out of range`);
    }
    this.currentPage = page;
    return this.getCurrentPageData();
  }

  /**
   * Checks if has next page.
   */
  hasNext(): boolean {
    return this.currentPage < this.getTotalPages() - 1;
  }

  /**
   * Checks if has previous page.
   */
  hasPrevious(): boolean {
    return this.currentPage > 0;
  }
}

/**
 * Async pagination loader.
 */
export interface AsyncPaginationLoader<T> {
  (page: number, pageSize: number): Promise<{ items: T[]; total: number }>;
}

/**
 * Async pagination manager.
 */
export class AsyncPaginationManager<T> {
  private loader: AsyncPaginationLoader<T>;
  private pageSize: number;
  private currentPage: number;
  private totalItems: number = 0;
  private loadedPages: Map<number, T[]> = new Map();
  private loadingPages: Set<number> = new Set();

  constructor(loader: AsyncPaginationLoader<T>, options: PaginationOptions) {
    this.loader = loader;
    this.pageSize = options.pageSize;
    this.currentPage = options.initialPage || 0;
    this.totalItems = options.totalItems || 0;
  }

  /**
   * Loads a specific page.
   */
  async loadPage(page: number): Promise<PaginationResult<T>> {
    if (this.loadedPages.has(page)) {
      return this.getPageResult(page, this.loadedPages.get(page)!);
    }

    if (this.loadingPages.has(page)) {
      // Wait for ongoing load
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.loadingPages.has(page)) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 50);
      });
      return this.getPageResult(page, this.loadedPages.get(page)!);
    }

    this.loadingPages.add(page);
    try {
      const result = await this.loader(page, this.pageSize);
      this.loadedPages.set(page, result.items);
      this.totalItems = result.total;
      return this.getPageResult(page, result.items);
    } finally {
      this.loadingPages.delete(page);
    }
  }

  /**
   * Gets current page.
   */
  async getCurrentPage(): Promise<PaginationResult<T>> {
    return this.loadPage(this.currentPage);
  }

  /**
   * Goes to next page.
   */
  async nextPage(): Promise<PaginationResult<T>> {
    if (this.currentPage < this.getTotalPages() - 1) {
      this.currentPage++;
    }
    return this.getCurrentPage();
  }

  /**
   * Goes to previous page.
   */
  async previousPage(): Promise<PaginationResult<T>> {
    if (this.currentPage > 0) {
      this.currentPage--;
    }
    return this.getCurrentPage();
  }

  /**
   * Goes to specific page.
   */
  async goToPage(page: number): Promise<PaginationResult<T>> {
    if (page < 0) {
      page = 0;
    }
    const totalPages = this.getTotalPages();
    if (totalPages > 0 && page >= totalPages) {
      page = totalPages - 1;
    }
    this.currentPage = page;
    return this.getCurrentPage();
  }

  /**
   * Preloads adjacent pages.
   */
  async preloadAdjacentPages(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.hasNext()) {
      promises.push(this.loadPage(this.currentPage + 1).then(() => undefined));
    }

    if (this.hasPrevious()) {
      promises.push(this.loadPage(this.currentPage - 1).then(() => undefined));
    }

    await Promise.all(promises);
  }

  /**
   * Clears cache.
   */
  clearCache(): void {
    this.loadedPages.clear();
  }

  /**
   * Gets total pages.
   */
  getTotalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize);
  }

  /**
   * Checks if has next page.
   */
  hasNext(): boolean {
    return this.currentPage < this.getTotalPages() - 1;
  }

  /**
   * Checks if has previous page.
   */
  hasPrevious(): boolean {
    return this.currentPage > 0;
  }

  /**
   * Gets page result.
   */
  private getPageResult(page: number, items: T[]): PaginationResult<T> {
    return {
      items,
      currentPage: page,
      totalPages: this.getTotalPages(),
      totalItems: this.totalItems,
      hasNext: page < this.getTotalPages() - 1,
      hasPrevious: page > 0,
      pageSize: this.pageSize,
    };
  }
}

