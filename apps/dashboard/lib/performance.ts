/**
 * Performance optimization utilities
 */

// Cache TTL constants
export const CACHE_TTL = {
  PROJECTS: 30 * 1000, // 30 seconds
  SCAN_REPORTS: 60 * 1000, // 60 seconds
  TEAMS: 30 * 1000, // 30 seconds
  MIGRATIONS: 60 * 1000, // 60 seconds
} as const;

// In-memory cache (for server-side)
const cache = new Map<string, { data: any; expires: number }>();

export function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  if (Date.now() > cached.expires) {
    cache.delete(key);
    return null;
  }
  
  return cached.data as T;
}

export function setCached<T>(key: string, data: T, ttl: number = CACHE_TTL.PROJECTS): void {
  cache.set(key, {
    data,
    expires: Date.now() + ttl,
  });
}

export function clearCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

// Optimized query helpers
export function createProjectQuery(userId: string, limit?: number) {
  let query = {
    select: 'id, name, slug, schema_type, created_at, team_id',
    eq: { user_id: userId },
    order: { created_at: { ascending: false } },
  };
  
  if (limit) {
    (query as any).limit = limit;
  }
  
  return query;
}

export function createScanReportsQuery(projectIds: string[]) {
  return {
    select: 'id, project_id, status, created_at, mismatches',
    in: { project_id: projectIds },
    order: { created_at: { ascending: false } },
    // Limit to one per project for latest scans
  };
}

