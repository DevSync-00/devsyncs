/**
 * Progressive enhancement system.
 * 
 * Provides capabilities to load features progressively as they are needed.
 */

import * as vscode from 'vscode';

/**
 * Feature loader.
 */
export interface FeatureLoader {
  /** Feature name */
  name: string;
  /** Load function */
  load: () => Promise<any>;
  /** Whether feature is loaded */
  loaded?: boolean;
  /** Activation conditions */
  activateOn?: string[];
}

/**
 * Progressive enhancement manager.
 */
export class ProgressiveEnhancement {
  private static features: Map<string, FeatureLoader> = new Map();
  private static loadedFeatures: Set<string> = new Set();

  /**
   * Registers a feature loader.
   */
  static register(loader: FeatureLoader): void {
    this.features.set(loader.name, loader);
  }

  /**
   * Loads a feature when needed.
   */
  static async loadFeature(name: string): Promise<void> {
    if (this.loadedFeatures.has(name)) {
      return;
    }

    const loader = this.features.get(name);
    if (!loader) {
      throw new Error(`Feature loader not found: ${name}`);
    }

    try {
      await loader.load();
      loader.loaded = true;
      this.loadedFeatures.add(name);
    } catch (error) {
      console.error(`Failed to load feature ${name}:`, error);
      throw error;
    }
  }

  /**
   * Checks if a feature is loaded.
   */
  static isLoaded(name: string): boolean {
    return this.loadedFeatures.has(name);
  }

  /**
   * Sets up activation listeners for features.
   */
  static setupActivationListeners(context: vscode.ExtensionContext): void {
    this.features.forEach((loader) => {
      if (loader.activateOn) {
        loader.activateOn.forEach((event) => {
          switch (event) {
            case 'onCommand':
              // Commands are handled separately
              break;
            case 'onView':
              // Views are handled separately
              break;
            case 'onLanguage':
              // Languages are handled separately
              break;
          }
        });
      }
    });
  }

  /**
   * Preloads features in the background.
   */
  static preloadFeatures(names: string[]): void {
    names.forEach((name) => {
      this.loadFeature(name).catch((error) => {
        console.warn(`Failed to preload feature ${name}:`, error);
      });
    });
  }

  /**
   * Gets loaded features.
   */
  static getLoadedFeatures(): string[] {
    return Array.from(this.loadedFeatures);
  }

  /**
   * Gets all registered features.
   */
  static getRegisteredFeatures(): string[] {
    return Array.from(this.features.keys());
  }
}

