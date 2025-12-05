/**
 * Background loading system.
 * 
 * Provides capabilities to load data in the background without blocking the main thread.
 */

/**
 * Background loader for data.
 */
export class BackgroundLoader {
  private static loaders: Map<string, () => Promise<any>> = new Map();
  private static cache: Map<string, any> = new Map();
  private static loading: Map<string, Promise<any>> = new Map();

  /**
   * Registers a background loader.
   */
  static register<T>(name: string, loader: () => Promise<T>): void {
    this.loaders.set(name, loader);
  }

  /**
   * Loads data in the background.
   */
  static async load<T>(name: string, useCache = true): Promise<T> {
    // Check cache first
    if (useCache && this.cache.has(name)) {
      return this.cache.get(name) as T;
    }

    // Check if already loading
    if (this.loading.has(name)) {
      return this.loading.get(name) as Promise<T>;
    }

    // Start loading
    const loader = this.loaders.get(name);
    if (!loader) {
      throw new Error(`Background loader not found for: ${name}`);
    }

    const promise = loader()
      .then((result) => {
        if (useCache) {
          this.cache.set(name, result);
        }
        this.loading.delete(name);
        return result;
      })
      .catch((error) => {
        this.loading.delete(name);
        throw error;
      });

    this.loading.set(name, promise);
    return promise as Promise<T>;
  }

  /**
   * Starts loading data in the background (fire and forget).
   */
  static startLoading(name: string): void {
    this.load(name).catch((error) => {
      console.warn(`Background loading failed for ${name}:`, error);
    });
  }

  /**
   * Starts loading multiple items in the background.
   */
  static startLoadingMany(names: string[]): void {
    names.forEach((name) => this.startLoading(name));
  }

  /**
   * Preloads data (waits for completion).
   */
  static async preload<T>(name: string): Promise<T> {
    return this.load<T>(name);
  }

  /**
   * Preloads multiple items.
   */
  static async preloadMany<T>(names: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    await Promise.all(
      names.map(async (name) => {
        try {
          const result = await this.load<T>(name);
          results.set(name, result);
        } catch (error) {
          console.warn(`Failed to preload ${name}:`, error);
        }
      })
    );
    return results;
  }

  /**
   * Clears cache.
   */
  static clearCache(name?: string): void {
    if (name) {
      this.cache.delete(name);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Checks if data is loaded.
   */
  static isLoaded(name: string): boolean {
    return this.cache.has(name);
  }

  /**
   * Checks if data is currently loading.
   */
  static isLoading(name: string): boolean {
    return this.loading.has(name);
  }
}

