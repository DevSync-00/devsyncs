import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '@/app/api/projects/utils';
import { decryptSecret, encryptSecret, connectionPreview } from '@/lib/secret-vault';
import { getManagedPreviewProvider, getPreviewProvider } from '@/lib/preview-providers';
import { withRateLimit } from '@/lib/rate-limit-middleware';

const schema = z.object({ action: z.enum(['refresh', 'reset', 'destroy']) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withRateLimit(async (req: NextRequest) => {
    const supabase = await createClient();
    const user = await resolveUser(req, supabase);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: environment } = await supabase.from('project_environments').select('*, project:projects(id, user_id, team_id)').eq('id', params.id).single();
    if (!environment) return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    let canManage = environment.project.user_id === user.id;
    if (!canManage && environment.project.team_id) {
      const { data: member } = await supabase.from('team_members').select('role').eq('team_id', environment.project.team_id).eq('user_id', user.id).in('role', ['owner', 'admin']).maybeSingle();
      canManage = Boolean(member);
    }
    if (!canManage) return NextResponse.json({ error: 'Owner or admin permission is required.' }, { status: 403 });
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid lifecycle action.' }, { status: 400 });
    const { data: secret } = await supabase.from('environment_secrets').select('*').eq('environment_id', environment.id).single();
    if (!secret?.encrypted_management_value || !secret.resource_id) {
      return NextResponse.json({ error: 'This environment does not use a managed provider.' }, { status: 409 });
    }
    const credentials = JSON.parse(decryptSecret(secret.encrypted_management_value)) as { apiKey: string; projectId: string };
    const provider = getManagedPreviewProvider(secret.provider);

    try {
      if (parsed.data.action === 'refresh') {
        const health = await provider.status(credentials, secret.resource_id);
        const verificationStatus = health.status === 'ready' ? 'verified' : health.status === 'failed' || health.status === 'deleted' ? 'failed' : 'unverified';
        const { data } = await supabase.from('environment_secrets').update({
          lifecycle_status: health.status, verification_status: verificationStatus,
          last_verified_at: new Date().toISOString(), metadata: { ...(secret.metadata || {}), ...(health.metadata || {}) }, last_error: null,
        }).eq('id', secret.id).select('id, provider, connection_preview, verification_status, last_verified_at, metadata, resource_id, lifecycle_status, expires_at, last_error').single();
        return NextResponse.json({ provider: data });
      }
      if (parsed.data.action === 'destroy') {
        await supabase.from('environment_secrets').update({ lifecycle_status: 'deleting' }).eq('id', secret.id);
        await provider.destroy(credentials, secret.resource_id);
        const { data } = await supabase.from('environment_secrets').update({
          lifecycle_status: 'deleted', verification_status: 'failed', last_error: null,
        }).eq('id', secret.id).select('id, provider, connection_preview, verification_status, metadata, resource_id, lifecycle_status, expires_at, last_error').single();
        return NextResponse.json({ provider: data });
      }

      await supabase.from('environment_secrets').update({ lifecycle_status: 'resetting' }).eq('id', secret.id);
      await provider.destroy(credentials, secret.resource_id);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const resource = await provider.provision({
        ...credentials,
        name: `devsync-${environment.id.slice(0, 8)}-${Date.now().toString(36)}`,
        expiresAt,
      });
      const verification = await getPreviewProvider(secret.provider).verify(resource.connectionString);
      const { data } = await supabase.from('environment_secrets').update({
        encrypted_value: encryptSecret(resource.connectionString),
        connection_preview: connectionPreview(resource.connectionString),
        resource_id: resource.resourceId,
        lifecycle_status: 'ready',
        verification_status: 'verified',
        last_verified_at: new Date().toISOString(),
        expires_at: expiresAt,
        metadata: { ...resource.metadata, database: verification.database, serverVersion: verification.version.slice(0, 180) },
        last_error: null,
      }).eq('id', secret.id).select('id, provider, connection_preview, verification_status, last_verified_at, metadata, resource_id, lifecycle_status, expires_at, last_error').single();
      return NextResponse.json({ provider: data });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase.from('environment_secrets').update({ lifecycle_status: 'failed', verification_status: 'failed', last_error: message.slice(0, 1000) }).eq('id', secret.id);
      return NextResponse.json({ error: 'Managed provider action failed', details: message }, { status: 422 });
    }
  })(request);
}
