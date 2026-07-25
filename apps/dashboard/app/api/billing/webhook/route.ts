import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requiredEnv } from '@/lib/env';
import { planForPrice, stripeGet, verifyStripeSignature } from '@/lib/stripe-billing';

export async function POST(request: NextRequest) {
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get('stripe-signature'), requiredEnv('STRIPE_WEBHOOK_SECRET'))) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }
  const event = JSON.parse(payload);
  const admin = getAdminClient() as any;
  const { error: claimError } = await admin.from('billing_events').insert({ id: event.id, event_type: event.type });
  if (claimError?.code === '23505') return NextResponse.json({ received: true, duplicate: true });
  try {
    let object = event.data.object;
    if (event.type === 'checkout.session.completed' && object.subscription) {
      object = await stripeGet(`subscriptions/${object.subscription}`);
    }
    if (event.type.startsWith('customer.subscription.') || event.type === 'checkout.session.completed') {
      const teamId = object.metadata?.team_id || event.data.object.client_reference_id;
      if (!teamId) throw new Error('Subscription event has no team_id metadata.');
      const priceId = object.items?.data?.[0]?.price?.id;
      const status = object.status === 'canceled' ? 'cancelled' : object.status;
      await admin.from('team_entitlements').upsert({
        team_id: teamId,
        plan: planForPrice(priceId),
        status: ['trialing', 'active', 'past_due'].includes(status) ? status : status === 'cancelled' ? 'cancelled' : 'suspended',
        stripe_customer_id: String(object.customer || event.data.object.customer),
        stripe_subscription_id: String(object.id || event.data.object.subscription),
        stripe_price_id: priceId,
        period_start: object.current_period_start ? new Date(object.current_period_start * 1000).toISOString() : null,
        period_end: object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'team_id' });
    }
    await admin.from('billing_events').update({ processed: true, processed_at: new Date().toISOString() }).eq('id', event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    await admin.from('billing_events').update({ error_message: error instanceof Error ? error.message : String(error), processed_at: new Date().toISOString() }).eq('id', event.id);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
