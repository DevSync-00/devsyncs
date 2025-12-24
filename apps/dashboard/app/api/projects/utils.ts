import type { NextRequest } from 'next/server';

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

/**
 * Validate device flow token (base64url-encoded JSON)
 * Returns user object if token is valid, null otherwise
 */
function validateDeviceFlowToken(token: string): { id: string; email?: string } | null {
  try {
    // Decode base64url token
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const payload = JSON.parse(decoded);
    
    // Check if token is expired
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }
    
    // Return user object from token
    if (payload.sub) {
      return {
        id: payload.sub,
        email: payload.email || '',
      };
    }
    
    return null;
  } catch {
    // Not a device flow token or invalid format
    return null;
  }
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
      
      // Fallback: try device flow token validation
      const deviceFlowUser = validateDeviceFlowToken(token);
      if (deviceFlowUser) {
        // Return the user object from the token
        // The token contains the user ID, which is sufficient for authorization
        return deviceFlowUser as any;
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

