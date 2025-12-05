# Data Loading Optimizations

This module provides comprehensive data loading improvements for the DevSync VS Code extension, addressing section 2.3 "Data Loading" from the Performance Optimizations roadmap.

## Features

### 1. Pagination

Load large datasets in pages:

```typescript
import { PaginationManager } from './data';

const pagination = new PaginationManager({
  pageSize: 20,
  initialPage: 0,
});

pagination.setItems(largeDataset);
const page1 = pagination.getCurrentPageData();
const page2 = pagination.nextPage();
```

### 2. Async Pagination

Load pages asynchronously:

```typescript
import { AsyncPaginationManager } from './data';

const asyncPagination = new AsyncPaginationManager(
  async (page, pageSize) => {
    const result = await fetchData(page, pageSize);
    return { items: result.items, total: result.total };
  },
  { pageSize: 20 }
);

const page1 = await asyncPagination.getCurrentPage();
const page2 = await asyncPagination.nextPage();
```

### 3. Lazy Tree Loading

Load tree nodes on demand:

```typescript
import { LazyTreeNodeManager } from './data';

const treeManager = new LazyTreeNodeManager(async (parentId) => {
  return await loadTreeNodes(parentId);
});

const children = await treeManager.loadChildren('root');
const grandchildren = await treeManager.loadChildren('node-1');
```

### 4. Caching

Cache scan results and other data:

```typescript
import { getScanResultsCache } from './data';

const cache = getScanResultsCache<ScanReport>();

// Cache scan result
cache.set('scan-123', scanReport, 10 * 60 * 1000); // 10 minutes

// Get cached result
const cached = cache.get('scan-123');
```

### 5. Incremental Updates

Update data incrementally:

```typescript
import { IncrementalUpdateManager } from './data';

const updateManager = new IncrementalUpdateManager<Mismatch>();

updateManager.initialize(initialMismatches);

// Add new mismatch
updateManager.applyUpdate({
  type: 'add',
  item: newMismatch,
});

// Update existing mismatch
updateManager.applyUpdate({
  type: 'update',
  id: 'mismatch-1',
  item: updatedMismatch,
});

// Delete mismatch
updateManager.applyUpdate({
  type: 'delete',
  id: 'mismatch-1',
});
```

### 6. Background Refresh

Refresh data in the background:

```typescript
import { BackgroundRefreshManager } from './data';

const refreshManager = new BackgroundRefreshManager(
  async () => {
    return await fetchLatestScanResults();
  },
  {
    interval: 60000, // 1 minute
    immediate: true,
  }
);

refreshManager.start();
refreshManager.on('refreshed', (data) => {
  updateUI(data);
});
```

### 7. Smart Prefetching

Prefetch data that's likely to be needed:

```typescript
import { PrefetchManager } from './data';

const prefetchManager = new PrefetchManager(
  async (item) => {
    return await loadRelatedItems(item);
  },
  {
    strategy: 'adjacent',
    maxPrefetch: 5,
  }
);

// Prefetch adjacent items
await prefetchManager.prefetchAdjacent(items, currentIndex, (item) => item.id);
```

## Usage Examples

### Paginated Scan Results

```typescript
import { AsyncPaginationManager } from './data';

const scanResultsPagination = new AsyncPaginationManager(
  async (page, pageSize) => {
    const reports = await apiClient.getScanReports(page * pageSize, pageSize);
    return {
      items: reports,
      total: await apiClient.getScanReportsCount(),
    };
  },
  { pageSize: 20 }
);

const currentPage = await scanResultsPagination.getCurrentPage();
```

### Lazy Tree Nodes

```typescript
import { LazyTreeNodeManager } from './data';

const treeManager = new LazyTreeNodeManager(async (parentId) => {
  if (!parentId) {
    return await loadRootNodes();
  }
  return await loadChildNodes(parentId);
});

// Load only when expanded
const children = await treeManager.loadChildren('mismatches');
```

### Cached Scan Results

```typescript
import { getScanResultsCache } from './data';

const cache = getScanResultsCache<ScanReport>();

async function getScanReport(id: string): Promise<ScanReport | null> {
  // Check cache first
  const cached = cache.get(id);
  if (cached) {
    return cached;
  }

  // Load from API
  const report = await apiClient.getScanReport(id);
  if (report) {
    cache.set(id, report);
  }
  return report;
}
```

### Incremental Mismatch Updates

```typescript
import { IncrementalUpdateManager } from './data';

const mismatchManager = new IncrementalUpdateManager<Mismatch>();

mismatchManager.initialize(initialMismatches);

// Listen for updates
mismatchManager.on('added', (mismatch, index) => {
  updateUI(mismatch, index);
});

mismatchManager.on('updated', (mismatch, index) => {
  updateUI(mismatch, index);
});

// Apply updates
mismatchManager.applyUpdate({
  type: 'add',
  item: newMismatch,
});
```

## Performance Benefits

- **Faster Initial Load**: Pagination loads only first page
- **Reduced Memory**: Lazy loading loads only visible nodes
- **Faster Access**: Caching avoids redundant API calls
- **Smooth Updates**: Incremental updates avoid full reloads
- **Background Sync**: Background refresh keeps data fresh
- **Predictive Loading**: Prefetching loads data before needed

## Integration

These utilities can be integrated into:

- **Sidebar Provider**: Lazy load tree nodes, paginate mismatches
- **Scan Results**: Cache results, paginate large datasets
- **Migration History**: Lazy load migration files
- **API Client**: Cache API responses
- **Tree Views**: Lazy load children on expand

