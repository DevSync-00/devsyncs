/**
 * Network optimization module.
 * 
 * Provides comprehensive network optimizations including:
 * - Request batching
 * - Request deduplication
 * - Offline mode with sync
 * - Request queuing
 * - Retry with exponential backoff
 * - Connection pooling
 */

export {
  RequestBatcher,
  BatchedRequest,
  BatchOptions,
} from './batching';

export {
  RequestDeduplication,
  DeduplicationOptions,
  DeduplicationKeyGenerator,
} from './deduplication';

export {
  OfflineManager,
  OfflineOptions,
  QueuedRequest,
} from './offline';

export {
  RequestQueue,
  QueueOptions,
  QueuedRequestItem,
} from './queue';

export {
  RetryManager,
  RetryOptions,
} from './retry';

export {
  ConnectionPool,
  PoolOptions,
} from './pooling';

export {
  OptimizedHttpClient,
  OptimizedClientOptions,
} from './optimizedClient';

