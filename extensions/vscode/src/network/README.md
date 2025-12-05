# Network Optimizations

This module provides comprehensive network optimizations for the DevSync VS Code extension, addressing section 3 "Network Optimization" from the Performance Optimizations roadmap.

## Features

### 1. Request Batching

Combine multiple requests into a single batch:

```typescript
import { RequestBatcher } from './network';

const batcher = new RequestBatcher(async (requests) => {
  // Execute batch requests
  const results = new Map();
  for (const request of requests) {
    const result = await fetch(request.url, {
      method: request.method,
      body: JSON.stringify(request.body),
    });
    results.set(request.id, await result.json());
  }
  return results;
});

// Add requests to batch
const result1 = await batcher.addRequest({
  method: 'GET',
  url: '/api/scans',
});

const result2 = await batcher.addRequest({
  method: 'GET',
  url: '/api/migrations',
});

// Batch is automatically sent after maxBatchSize or maxWaitTime
```

### 2. Request Deduplication

Prevent duplicate requests:

```typescript
import { RequestDeduplication } from './network';

const deduplication = new RequestDeduplication();

// First request executes
const promise1 = deduplication.execute('GET', '/api/scans', fetchScans);

// Second request with same URL reuses first request
const promise2 = deduplication.execute('GET', '/api/scans', fetchScans);

// Both promises resolve to the same result
```

### 3. Offline Mode with Sync

Queue requests when offline and sync when online:

```typescript
import { OfflineManager } from './network';

const offlineManager = new OfflineManager(async (request) => {
  return fetch(request.url, {
    method: request.method,
    body: JSON.stringify(request.body),
  });
});

// Request is queued if offline
try {
  const result = await offlineManager.execute({
    method: 'POST',
    url: '/api/scans',
    body: scanData,
  });
} catch (error) {
  // Request queued for sync when online
}

// Listen to sync events
offlineManager.on('synced', (request) => {
  console.log('Request synced:', request);
});

// Manually sync
await offlineManager.sync();
```

### 4. Request Queuing

Queue requests and process them in order:

```typescript
import { RequestQueue } from './network';

const queue = new RequestQueue({
  maxConcurrent: 5,
  rateLimit: 10, // 10 requests per second
});

// Add requests to queue
const result1 = await queue.enqueue(() => fetch('/api/scans'));
const result2 = await queue.enqueue(() => fetch('/api/migrations'), 10); // Higher priority

// Queue processes requests in order with rate limiting
```

### 5. Retry with Exponential Backoff

Retry failed requests with exponential backoff:

```typescript
import { RetryManager } from './network';

const retryManager = new RetryManager({
  maxRetries: 3,
  initialDelay: 1000,
  multiplier: 2,
});

// Execute with automatic retry
const result = await retryManager.execute(async () => {
  return fetch('/api/scans');
});
```

### 6. Connection Pooling

Reuse HTTP connections:

```typescript
import { ConnectionPool } from './network';

const pool = new ConnectionPool({
  maxSize: 10,
  idleTimeout: 60000,
});

// Get connection from pool
const connection = pool.getConnection('https://api.example.com');

// Connection is reused for subsequent requests to same origin
```

### 7. Optimized HTTP Client

All optimizations combined:

```typescript
import { OptimizedHttpClient } from './network';

const client = new OptimizedHttpClient({
  baseUrl: 'https://api.example.com',
  defaultHeaders: {
    'Authorization': 'Bearer token',
  },
  batch: {
    maxBatchSize: 10,
    maxWaitTime: 50,
  },
  deduplication: {
    ttl: 5000,
  },
  queue: {
    maxConcurrent: 5,
    rateLimit: 10,
  },
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
  },
});

// Use optimized client
const result = await client.request('/api/scans', {
  method: 'GET',
});

// Use batched requests
const batchedResult = await client.batchedRequest('/api/scans', {
  method: 'GET',
});
```

## Usage Examples

### Batch Multiple Requests

```typescript
import { RequestBatcher } from './network';

const batcher = new RequestBatcher(batchHandler);

// Batch multiple requests
const [scans, migrations, projects] = await Promise.all([
  batcher.addRequest({ method: 'GET', url: '/api/scans' }),
  batcher.addRequest({ method: 'GET', url: '/api/migrations' }),
  batcher.addRequest({ method: 'GET', url: '/api/projects' }),
]);
```

### Deduplicate Concurrent Requests

```typescript
import { RequestDeduplication } from './network';

const deduplication = new RequestDeduplication();

// Multiple components request same data
const promises = [
  deduplication.execute('GET', '/api/scans', fetchScans),
  deduplication.execute('GET', '/api/scans', fetchScans),
  deduplication.execute('GET', '/api/scans', fetchScans),
];

// Only one request is made, all promises resolve to same result
const results = await Promise.all(promises);
```

### Offline Support

```typescript
import { OfflineManager } from './network';

const offlineManager = new OfflineManager(requestHandler);

// Request works online or offline
try {
  const result = await offlineManager.execute({
    method: 'POST',
    url: '/api/scans',
    body: scanData,
  });
} catch (error) {
  if (error.message.includes('queued')) {
    // Request queued, will sync when online
  }
}

// Listen to sync events
offlineManager.on('syncComplete', (results) => {
  console.log(`Synced ${results.length} requests`);
});
```

## Performance Benefits

- **Reduced Network Overhead**: Batching combines multiple requests
- **Faster Response**: Deduplication avoids duplicate requests
- **Offline Support**: Queue requests when offline, sync when online
- **Better Throughput**: Queuing processes requests efficiently
- **Higher Reliability**: Retry with exponential backoff handles transient failures
- **Improved Performance**: Connection pooling reuses connections

## Integration

These utilities can be integrated into:

- **API Client**: Use `OptimizedHttpClient` for all API requests
- **Chat API**: Batch chat requests, deduplicate queries
- **Scan Service**: Queue scan requests, retry on failure
- **Migration Service**: Batch migration requests, offline support
- **All Network Calls**: Replace direct fetch with optimized client

