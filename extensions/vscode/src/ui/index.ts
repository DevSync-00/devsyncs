/**
 * UI responsiveness optimization module.
 * 
 * Provides comprehensive UI responsiveness improvements including:
 * - Debouncing for user input
 * - Throttling for updates
 * - Virtual scrolling for large lists
 * - Web Workers for heavy computations
 * - React rendering optimizations
 * - Memoization for expensive calculations
 */

export {
  debounce,
  debounceCancellable,
  DebouncedFunction,
  CancellableDebouncedFunction,
} from './debounce';

export {
  throttle,
  throttleCancellable,
  ThrottledFunction,
  CancellableThrottledFunction,
  ThrottleOptions,
} from './throttle';

export {
  calculateVisibleItems,
  VirtualScrollManager,
  VirtualScrollItem,
  VirtualScrollConfig,
  VirtualScrollResult,
} from './virtualScroll';

export {
  WebWorkerManager,
  WorkerMessage,
  WorkerResponse,
  WorkerTask,
  createWorkerScript,
  DATA_PROCESSING_WORKER_SCRIPT,
} from './workers';

export {
  memoize,
  weakMemoize,
  memoizeWithEquality,
  MemoizeOptions,
} from './memoization';

export {
  shallowEqual,
  memoShallow,
  useDebounce,
  useThrottle,
  useMemoizedCallback,
  useMemoizedValue,
  useVirtualScroll,
} from './reactOptimization';

// Re-export UI services from their original locations
export { NotificationService } from './notifications';
export { StatusBarService } from './statusBar';
export { EditorService } from './editor';
export { SchemaStatusBarManager } from './schemaStatusBar';
