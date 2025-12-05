/**
 * Performance optimization module.
 * 
 * Provides comprehensive performance optimizations including:
 * - Lazy loading of components
 * - Deferred initialization
 * - Background loading of data
 * - Progressive enhancement
 * - Caching frequently accessed data
 */

export { LazyLoader, createLazyLoader } from './lazyLoader';
export { DeferredInitManager, InitPriority, InitTask } from './deferredInit';
export { BackgroundLoader } from './backgroundLoader';
export { CacheManager, CacheOptions } from './cache';
export { ProgressiveEnhancement, FeatureLoader } from './progressive';
export { StartupOptimizer } from './startupOptimizer';

