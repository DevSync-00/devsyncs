import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveUser } from '@/app/api/projects/utils';
import { priceForPlan, stripeRequest } from '@/lib/stripe-billing';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await resolveUser(request, supabase);
    const { teamId, plan } = await request.json();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: member } = await supabase.from('team_members').select('role').eq('team_id', teamId).eq('user_id', user.id).maybeSingle();
    if (member?.role !== 'owner') return NextResponse.json({ error: 'Team owner access required.' }, { status: 403 });
    const admin = getAdminClient() as any;
    const { data: current } = await admin.from('team_entitlements').select('*').eq('team_id', teamId).maybeSingle();
    const origin = request.nextUrl.origin;
    const session = await stripeRequest('checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': priceForPlan(plan),
      'line_items[0][quantity]': '1',
      customer: current?.stripe_customer_id || undefined,
      customer_email: current?.stripe_customer_id ? undefined : user.email,
      client_reference_id: teamId,
      'metadata[team_id]': teamId,
      'subscription_data[metadata][team_id]': teamId,
      success_url: `${origin}/dashboard/teams/${teamId}/settings?billing=success`,
      cancel_url: `${origin}/dashboard/teams/${teamId}/settings?billing=cancelled`,
      allow_promotion_codes: 'true',
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
