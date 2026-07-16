import type { NextRequest } from 'next/server';
import { verifyJwt } from '@/lib/auth/tokens';

export const DEFAULT_PROJECT_LIMIT = 50;

export const VALID_SCHEMA_TYPES = [
  'prisma',
  'supabase',
  'typeorm',
  'kysely',
  'sequelize',
  'drizzle',
  'django',
  'sqlalchemy',
  'raw-sql',
] as const;

export const CODEBASE_TYPES = ['git', 'upload', 'cli'] as const;

export type SchemaType = (typeof VALID_SCHEMA_TYPES)[number];

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function resolveUser(
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
) {
  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    if (token.length > 0) {
      // Try Supabase JWT validation first
      const { data: { user: tokenUser }, error } = await supabase.auth.getUser(token);
      if (!error && tokenUser) {
        return tokenUser;
      }
      
      const devsyncToken = verifyJwt(token, 'access');
      if (devsyncToken) {
        return {
          id: devsyncToken.sub,
          email: devsyncToken.email || '',
        } as any;
      }
    }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!authError && user) {
    return user;
  }

  return null;
}

export function formatProjectSummary(project: any, latestScan?: any) {
  const mismatches = Array.isArray(latestScan?.mismatches) ? latestScan.mismatches : [];

  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    schemaType: project.schema_type,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    teamId: project.team_id,
    codebaseType: project.config?.codebase?.type || null,
    metadata: {
      lastScanAt: latestScan?.created_at || null,
      lastScanStatus: latestScan?.status || null,
      mismatchCount: mismatches.length,
    },
  };
}

export function maskConnectionString(connection?: string | null): string | null {
  if (!connection) {
    return null;
  }

  try {
    const url = new URL(connection);
    if (url.password) {
      url.password = '***';
    }
    if (url.username) {
      url.username = '***';
    }
    return url.toString();
  } catch {
    return connection.replace(/\/\/([^:@/]+)(?::([^@/]*))?@/, '//***:***@');
  }
}

export function buildCodebaseConfig(codebase: any) {
  if (!codebase) {
    return {
      codebaseConfig: {
        type: 'cli',
        status: 'manual',
      },
    };
  }

  if (!CODEBASE_TYPES.includes(codebase.type)) {
    return { codebaseConfig: null, validationError: 'Invalid codebase type' };
  }

  if (codebase.type === 'cli') {
    return {
      codebaseConfig: {
        type: 'cli',
        status: codebase.status || 'manual',
      },
    };
  }

  if (codebase.type === 'git') {
    if (!codebase.url) {
      return { codebaseConfig: null, validationError: 'Git URL is required' };
    }

    try {
      const url = new URL(codebase.url);
      if (!['http:', 'https:', 'git:'].includes(url.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return { codebaseConfig: null, validationError: 'Invalid Git URL format' };
    }

    return {
      codebaseConfig: {
        type: 'git',
        url: codebase.url,
        status: 'pending',
        jobId: `git-clone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      },
    };
  }

  const files = codebase.files || [];
  if (!Array.isArray(files) || files.length === 0) {
    return { codebaseConfig: null, validationError: 'No files uploaded' };
  }

  return {
    codebaseConfig: {
      type: 'upload',
      status: 'pending',
      fileCount: files.length,
    },
  };
}

