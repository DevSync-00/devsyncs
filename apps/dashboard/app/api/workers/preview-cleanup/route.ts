import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/secret-vault';
import { getManagedPreviewProvider } from '@/lib/preview-providers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const expected = process.env.DEVSYNC_WORKER_SECRET || process.env.CRON_SECRET;
  if (!expected || request.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = getAdminClient() as any;
  const { data: expired, error } = await admin.from('environment_secrets')
    .select('id, provider, resource_id, encrypted_management_value')
    .lt('expires_at', new Date().toISOString())
    .in('lifecycle_status', ['ready', 'failed'])
    .not('resource_id', 'is', null)
    .limit(25);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const results = [];
  for (const secret of expired || []) {
    try {
      await admin.from('environment_secrets').update({ lifecycle_status: 'deleting' }).eq('id', secret.id);
      const credentials = JSON.parse(decryptSecret(secret.encrypted_management_value));
      await getManagedPreviewProvider(secret.provider).destroy(credentials, secret.resource_id);
      await admin.from('environment_secrets').update({ lifecycle_status: 'deleted', verification_status: 'failed', last_error: null }).eq('id', secret.id);
      results.push({ id: secret.id, status: 'deleted' });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      await admin.from('environment_secrets').update({ lifecycle_status: 'failed', last_error: message.slice(0, 1000) }).eq('id', secret.id);
      results.push({ id: secret.id, status: 'failed', error: message });
    }
  }
  return NextResponse.json({ processed: results.length, results });
}

export const GET = POST;
