/**
 * Performance monitoring utilities
 * Tracks operation timing, metrics, and performance data
 */

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  operation: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics in memory

  /**
   * Start timing an operation
   */
  start(operation: string): () => PerformanceReport {
    const startTime = performance.now();
    const timestamp = Date.now();

    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      const report: PerformanceReport = {
        operation,
        duration,
        startTime: timestamp,
        endTime: Date.now(),
      };

      this.recordMetric({
        name: operation,
        duration,
        timestamp,
      });

      return report;
    };
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only last maxMetrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow operations
    if (metric.duration > 1000) {
      console.warn(`[PERF] Slow operation: ${metric.name} took ${metric.duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get metrics for an operation
   */
  getMetrics(operationName?: string): PerformanceMetric[] {
    if (operationName) {
      return this.metrics.filter(m => m.name === operationName);
    }
    return [...this.metrics];
  }

  /**
   * Get average duration for an operation
   */
  getAverageDuration(operationName: string): number {
    const operationMetrics = this.metrics.filter(m => m.name === operationName);
    if (operationMetrics.length === 0) return 0;

    const total = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / operationMetrics.length;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalOperations: number;
    averageDuration: number;
    slowOperations: PerformanceMetric[];
    operationCounts: Record<string, number>;
  } {
    const slowOperations = this.metrics.filter(m => m.duration > 1000);
    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageDuration = this.metrics.length > 0 ? totalDuration / this.metrics.length : 0;

    const operationCounts: Record<string, number> = {};
    this.metrics.forEach(m => {
      operationCounts[m.name] = (operationCounts[m.name] || 0) + 1;
    });

    return {
      totalOperations: this.metrics.length,
      averageDuration,
      slowOperations,
      operationCounts,
    };
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Measure performance of an async operation
 */
export async function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const stop = performanceMonitor.start(operation);
  
  try {
    const result = await fn();
    const report = stop();
    
    if (metadata) {
      performanceMonitor.recordMetric({
        name: operation,
        duration: report.duration,
        timestamp: report.startTime,
        metadata,
      });
    }
    
    return result;
  } catch (error) {
    const report = stop();
    
    // Record failed operation
    performanceMonitor.recordMetric({
      name: `${operation} (failed)`,
      duration: report.duration,
      timestamp: report.startTime,
      metadata: {
        ...metadata,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    
    throw error;
  }
}

/**
 * Measure performance of a sync operation
 */
export function measurePerformanceSync<T>(
  operation: string,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  const stop = performanceMonitor.start(operation);
  
  try {
    const result = fn();
    const report = stop();
    
    if (metadata) {
      performanceMonitor.recordMetric({
        name: operation,
        duration: report.duration,
        timestamp: report.startTime,
        metadata,
      });
    }
    
    return result;
  } catch (error) {
    const report = stop();
    
    // Record failed operation
    performanceMonitor.recordMetric({
      name: `${operation} (failed)`,
      duration: report.duration,
      timestamp: report.startTime,
      metadata: {
        ...metadata,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    
    throw error;
  }
}

/**
 * Get Web Vitals metrics (if available)
 */
export function getWebVitals(): {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
} {
  // In browser environment, these would be collected via web-vitals library
  // For now, return empty object - can be extended with actual web-vitals integration
  return {};
}

