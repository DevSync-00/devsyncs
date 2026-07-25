import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const domain = String(body.domain || '').trim().toLowerCase();
  if (!domain && !body.providerId) return NextResponse.json({ error: 'Domain or provider ID is required.' }, { status: 400 });
  const admin = getAdminClient() as any;
  let query = admin.from('team_security_settings').select('team_id,sso_provider_id,verified_domains').not('sso_provider_id', 'is', null);
  const { data: settings } = await query;
  const match = (settings || []).find((row: any) =>
    body.providerId ? row.sso_provider_id === body.providerId : (row.verified_domains || []).includes(domain),
  );
  if (!match) return NextResponse.json({ error: 'No configured SSO organization matches.' }, { status: 404 });
  const { data: entitlement } = await admin.from('team_entitlements').select('plan,status').eq('team_id', match.team_id).maybeSingle();
  if (entitlement?.plan !== 'enterprise' || !['active', 'trialing'].includes(entitlement.status)) {
    return NextResponse.json({ error: 'SSO is not active for this organization.' }, { status: 402 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithSSO({
    providerId: match.sso_provider_id,
    options: { redirectTo: `${request.nextUrl.origin}/auth/callback` },
  });
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ url: data.url });
}
