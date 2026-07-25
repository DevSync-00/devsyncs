import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveUser } from '@/app/api/projects/utils';
import { stripeRequest } from '@/lib/stripe-billing';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await resolveUser(request, supabase);
    const { teamId } = await request.json();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: member } = await supabase.from('team_members').select('role').eq('team_id', teamId).eq('user_id', user.id).maybeSingle();
    if (member?.role !== 'owner') return NextResponse.json({ error: 'Team owner access required.' }, { status: 403 });
    const admin = getAdminClient() as any;
    const { data } = await admin.from('team_entitlements').select('stripe_customer_id').eq('team_id', teamId).maybeSingle();
    if (!data?.stripe_customer_id) return NextResponse.json({ error: 'No billing account exists for this team.' }, { status: 404 });
    const session = await stripeRequest('billing_portal/sessions', {
      customer: data.stripe_customer_id,
      return_url: `${request.nextUrl.origin}/dashboard/teams/${teamId}/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
