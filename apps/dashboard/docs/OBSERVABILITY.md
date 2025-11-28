# Observability & Monitoring

This document describes the observability infrastructure for the DevSync dashboard, including performance monitoring, error tracking, and logging.

## Overview

The dashboard includes comprehensive observability tools:
- **Performance Monitoring**: Track operation timing and identify slow operations
- **Error Tracking**: Centralized error tracking with optional Sentry integration
- **Structured Logging**: Consistent logging with context and levels

## Performance Monitoring

### Usage

```typescript
import { measurePerformance } from '@/lib/performance-monitor';

// Measure async operation
const result = await measurePerformance('fetchProjects', async () => {
  return await fetchProjects();
});

// Measure sync operation
const result = measurePerformanceSync('processData', () => {
  return processData();
}, { userId: 'user-123' });
```

### Accessing Metrics

```typescript
import { performanceMonitor } from '@/lib/performance-monitor';

// Get all metrics
const metrics = performanceMonitor.getMetrics();

// Get metrics for specific operation
const projectMetrics = performanceMonitor.getMetrics('fetchProjects');

// Get average duration
const avgDuration = performanceMonitor.getAverageDuration('fetchProjects');

// Get performance summary
const summary = performanceMonitor.getSummary();
```

## Error Tracking

### Setup

Error tracking is initialized automatically via `instrumentation.ts`. To enable Sentry:

1. Install Sentry:
```bash
npm install @sentry/nextjs
```

2. Set environment variable:
```bash
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

### Usage

```typescript
import { trackError, trackMessage, setUserContext } from '@/lib/error-tracking';

// Track an error
trackError(error, {
  userId: 'user-123',
  projectId: 'project-456',
  operation: 'createProject',
  metadata: { schemaType: 'prisma' },
});

// Track a message
trackMessage('Project created successfully', 'info', {
  userId: 'user-123',
  projectId: 'project-456',
});

// Set user context
setUserContext('user-123', 'user@example.com', { plan: 'pro' });
```

## Structured Logging

### Usage

```typescript
import { logger, createScopedLogger } from '@/lib/logger';

// Basic logging
logger.debug('Debug message', { userId: 'user-123' });
logger.info('Info message', { projectId: 'project-456' });
logger.warn('Warning message', { operation: 'migration' });
logger.error('Error message', error, { context: 'data' });

// API request logging
logger.apiRequest('GET', '/api/projects', 200, 150, { userId: 'user-123' });

// Database query logging
logger.dbQuery('SELECT projects', 45, { userId: 'user-123' });

// Scoped logger with default context
const projectLogger = createScopedLogger({ projectId: 'project-456' });
projectLogger.info('Project operation'); // Automatically includes projectId
```

### Log Levels

- **debug**: Development debugging (only in development)
- **info**: General information
- **warn**: Warnings that don't break functionality
- **error**: Errors that need attention

## API Route Monitoring

API routes are automatically monitored when using `measurePerformance`:

```typescript
export async function GET(request: NextRequest) {
  return measurePerformance('GET /api/projects', async () => {
    // Your route handler
    return NextResponse.json({ data });
  });
}
```

## Best Practices

1. **Always include context**: Provide userId, projectId, or operation name when logging
2. **Use appropriate log levels**: Don't log everything as error
3. **Track performance for slow operations**: Operations > 1s are automatically logged
4. **Set user context**: Call `setUserContext` after authentication
5. **Clear user context**: Call `clearUserContext` on logout

## Environment Variables

- `NEXT_PUBLIC_SENTRY_DSN`: Sentry DSN for error tracking (optional)
- `NODE_ENV`: Set to 'production' to reduce debug logs

## Performance Thresholds

- **Fast**: < 100ms
- **Normal**: 100ms - 1000ms
- **Slow**: > 1000ms (automatically logged as warning)

## Error Tracking Services

The system supports:
- **Sentry** (recommended): Full-featured error tracking
- **Console logging**: Fallback when Sentry is not configured

To add other services, extend `apps/dashboard/lib/error-tracking.ts`.

