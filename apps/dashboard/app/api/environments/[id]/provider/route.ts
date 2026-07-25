import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '@/app/api/projects/utils';
import { connectionPreview, encryptSecret } from '@/lib/secret-vault';
import { getManagedPreviewProvider, getPreviewProvider } from '@/lib/preview-providers';
import { withRateLimit } from '@/lib/rate-limit-middleware';

const providerSchema = z.discriminatedUnion('provider', [z.object({
  provider: z.literal('postgres-transaction').default('postgres-transaction'),
  connectionString: z.string().url().refine(
    (value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol),
    'A PostgreSQL connection string is required.',
  ),
}), z.object({
  provider: z.literal('neon-branch'),
  apiKey: z.string().min(10),
  projectId: z.string().regex(/^[a-z0-9-]{1,60}$/),
  parentBranchId: z.string().regex(/^[a-z0-9-]{1,60}$/).optional(),
  expiresInHours: z.number().int().min(1).max(168).default(24),
})]);

async function environmentAccess(supabase: any, environmentId: string, userId: string) {
  const { data: environment } = await supabase
    .from('project_environments')
    .select('*, project:projects(id, user_id, team_id)')
    .eq('id', environmentId)
    .single();
  if (!environment) return { environment: null, status: 404 };
  if (environment.project.user_id === userId) return { environment, status: 200 };
  if (environment.project.team_id) {
    const { data: isMember } = await supabase.rpc('check_team_membership', { team_uuid: environment.project.team_id });
    if (isMember) return { environment, status: 200 };
  }
  return { environment: null, status: 403 };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const access = await environmentAccess(supabase, params.id, user.id);
    if (!access.environment) return NextResponse.json({ error: access.status === 404 ? 'Environment not found' : 'Access denied' }, { status: access.status });

    const { data } = await supabase
      .from('environment_secrets')
      .select('id, provider, connection_preview, verification_status, last_verified_at, metadata, resource_id, lifecycle_status, expires_at, last_error')
      .eq('environment_id', params.id)
      .maybeSingle();
    return NextResponse.json({
      environment: {
        id: access.environment.id,
        name: access.environment.name,
        tier: access.environment.tier,
      },
      provider: data || null,
    });
  })(request);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const access = await environmentAccess(supabase, params.id, user.id);
    if (!access.environment) return NextResponse.json({ error: access.status === 404 ? 'Environment not found' : 'Access denied' }, { status: access.status });
    if (access.environment.protected && access.environment.project.user_id !== user.id) {
      const { data: member } = await supabase.from('team_members').select('role').eq('team_id', access.environment.project.team_id).eq('user_id', user.id).in('role', ['owner', 'admin']).maybeSingle();
      if (!member) return NextResponse.json({ error: 'Owner or admin permission is required to configure a protected target.' }, { status: 403 });
    }

    const parsed = providerSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid provider configuration' }, { status: 400 });

    let connectionString: string;
    let managementValue: string | null = null;
    let managedMetadata: Record<string, unknown> = {};
    let resourceId: string | null = null;
    let expiresAt: string | null = null;
    let managedProvider: ReturnType<typeof getManagedPreviewProvider> | null = null;
    let managedCredentials: { apiKey: string; projectId: string } | null = null;
    if (parsed.data.provider === 'neon-branch') {
      expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000).toISOString();
      managedProvider = getManagedPreviewProvider(parsed.data.provider);
      managedCredentials = { apiKey: parsed.data.apiKey, projectId: parsed.data.projectId };
      let resource;
      try {
        resource = await managedProvider.provision({
          ...managedCredentials, parentBranchId: parsed.data.parentBranchId,
          name: `devsync-${access.environment.id.slice(0, 8)}-${Date.now().toString(36)}`, expiresAt,
        });
      } catch (error) {
        return NextResponse.json({ error: 'Managed preview provisioning failed', details: error instanceof Error ? error.message : String(error) }, { status: 422 });
      }
      connectionString = resource.connectionString;
      resourceId = resource.resourceId;
      managedMetadata = resource.metadata;
      managementValue = JSON.stringify({ apiKey: parsed.data.apiKey, projectId: parsed.data.projectId });
    } else {
      connectionString = parsed.data.connectionString;
    }
    const provider = getPreviewProvider(parsed.data.provider);
    let verification: { version: string; database: string };
    try {
      verification = await provider.verify(connectionString);
    } catch (error) {
      if (managedProvider && managedCredentials && resourceId) await managedProvider.destroy(managedCredentials, resourceId).catch(() => undefined);
      return NextResponse.json(
        { error: 'Preview connection verification failed', details: error instanceof Error ? error.message : String(error) },
        { status: 422 },
      );
    }

    const now = new Date().toISOString();
    const { data: secret, error } = await supabase
      .from('environment_secrets')
      .upsert({
        environment_id: params.id,
        provider: parsed.data.provider,
        encrypted_value: encryptSecret(connectionString),
        encrypted_management_value: managementValue ? encryptSecret(managementValue) : null,
        connection_preview: connectionPreview(connectionString),
        resource_id: resourceId,
        lifecycle_status: 'ready',
        expires_at: expiresAt,
        last_error: null,
        configured_by: user.id,
        last_verified_at: now,
        verification_status: 'verified',
        metadata: {
          database: verification.database,
          serverVersion: verification.version.slice(0, 180),
          ...managedMetadata,
        },
      }, { onConflict: 'environment_id' })
      .select('id, provider, connection_preview, verification_status, last_verified_at, metadata, resource_id, lifecycle_status, expires_at, last_error')
      .single();
    if (error) {
      if (managedProvider && managedCredentials && resourceId) await managedProvider.destroy(managedCredentials, resourceId).catch(() => undefined);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase
      .from('project_environments')
      .update({ connection_secret_id: secret.id, status: 'unknown' })
      .eq('id', params.id);
    return NextResponse.json({ provider: secret }, { status: 201 });
  })(request);
}
