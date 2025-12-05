/**
 * Startup performance optimizer.
 * 
 * Coordinates all startup optimizations including lazy loading, deferred initialization,
 * background loading, progressive enhancement, and caching.
 */

import * as vscode from 'vscode';
import { LazyLoader } from './lazyLoader';
import { DeferredInitManager, InitPriority } from './deferredInit';
import { BackgroundLoader } from './backgroundLoader';
import { CacheManager } from './cache';
import { ProgressiveEnhancement } from './progressive';

/**
 * Startup optimizer.
 */
export class StartupOptimizer {
  /**
   * Initializes the startup optimizer.
   */
  static initialize(context: vscode.ExtensionContext): void {
    // Initialize caches
    CacheManager.createCache('config', { ttl: 10 * 60 * 1000, maxSize: 50 });
    CacheManager.createCache('scanResults', { ttl: 5 * 60 * 1000, maxSize: 20 });
    CacheManager.createCache('migrations', { ttl: 10 * 60 * 1000, maxSize: 50 });

    // Schedule deferred initialization
    DeferredInitManager.scheduleIdleExecution(context);

    // Cleanup on deactivation
    context.subscriptions.push({
      dispose: () => {
        CacheManager.dispose();
      },
    });
  }

  /**
   * Registers a lazy component.
   */
  static registerLazyComponent<T>(name: string, loader: () => Promise<T>): void {
    LazyLoader.register(name, loader);
  }

  /**
   * Registers a deferred initialization task.
   */
  static registerDeferredTask(
    name: string,
    priority: InitPriority,
    task: () => Promise<void> | void
  ): void {
    DeferredInitManager.register({ name, priority, task });
  }

  /**
   * Registers a background loader.
   */
  static registerBackgroundLoader<T>(name: string, loader: () => Promise<T>): void {
    BackgroundLoader.register(name, loader);
  }

  /**
   * Registers a progressive feature.
   */
  static registerFeature(loader: {
    name: string;
    load: () => Promise<any>;
    activateOn?: string[];
  }): void {
    ProgressiveEnhancement.register(loader);
  }

  /**
   * Executes critical initialization tasks.
   */
  static async executeCritical(): Promise<void> {
    await DeferredInitManager.executeCritical();
  }

  /**
   * Executes high priority initialization tasks.
   */
  static async executeHigh(): Promise<void> {
    await DeferredInitManager.executeHigh();
  }

  /**
   * Executes all deferred tasks.
   */
  static async executeAll(): Promise<void> {
    await DeferredInitManager.executeAll();
  }

  /**
   * Preloads components in the background.
   */
  static preloadComponents(names: string[]): void {
    LazyLoader.preloadMany(names);
  }

  /**
   * Starts background loading.
   */
  static startBackgroundLoading(names: string[]): void {
    BackgroundLoader.startLoadingMany(names);
  }

  /**
   * Gets cache manager.
   */
  static getCache(): typeof CacheManager {
    return CacheManager;
  }

  /**
   * Gets lazy loader.
   */
  static getLazyLoader(): typeof LazyLoader {
    return LazyLoader;
  }

  /**
   * Gets background loader.
   */
  static getBackgroundLoader(): typeof BackgroundLoader {
    return BackgroundLoader;
  }

  /**
   * Gets progressive enhancement.
   */
  static getProgressiveEnhancement(): typeof ProgressiveEnhancement {
    return ProgressiveEnhancement;
  }

  /**
   * Gets initialization status.
   */
  static getStatus() {
    return {
      deferred: DeferredInitManager.getStatus(),
      loadedFeatures: ProgressiveEnhancement.getLoadedFeatures(),
      registeredFeatures: ProgressiveEnhancement.getRegisteredFeatures(),
    };
  }
}

