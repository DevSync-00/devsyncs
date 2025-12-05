/**
 * Lazy loading system for components.
 * 
 * Provides lazy loading capabilities to defer component initialization until needed.
 */

/**
 * Lazy loader for components.
 */
export class LazyLoader {
  private static loaders: Map<string, () => Promise<any>> = new Map();
  private static cache: Map<string, any> = new Map();

  /**
   * Registers a lazy loader for a component.
   */
  static register<T>(name: string, loader: () => Promise<T>): void {
    this.loaders.set(name, loader);
  }

  /**
   * Loads a component lazily.
   */
  static async load<T>(name: string): Promise<T> {
    // Check cache first
    if (this.cache.has(name)) {
      return this.cache.get(name) as T;
    }

    // Load component
    const loader = this.loaders.get(name);
    if (!loader) {
      throw new Error(`Lazy loader not found for: ${name}`);
    }

    const component = await loader();
    this.cache.set(name, component);
    return component as T;
  }

  /**
   * Preloads a component in the background.
   */
  static preload(name: string): void {
    // Don't await - load in background
    this.load(name).catch((error) => {
      console.warn(`Failed to preload ${name}:`, error);
    });
  }

  /**
   * Preloads multiple components in the background.
   */
  static preloadMany(names: string[]): void {
    names.forEach((name) => this.preload(name));
  }

  /**
   * Clears the cache for a component.
   */
  static clearCache(name?: string): void {
    if (name) {
      this.cache.delete(name);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Checks if a component is loaded.
   */
  static isLoaded(name: string): boolean {
    return this.cache.has(name);
  }
}

/**
 * Creates a lazy loader function.
 */
export function createLazyLoader<T>(loader: () => Promise<T>): () => Promise<T> {
  let cached: T | null = null;
  let loading: Promise<T> | null = null;

  return async (): Promise<T> => {
    if (cached !== null) {
      return cached;
    }

    if (loading !== null) {
      return loading;
    }

    loading = loader().then((result) => {
      cached = result;
      loading = null;
      return result;
    });

    return loading;
  };
}

