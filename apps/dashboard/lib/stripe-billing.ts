import { createHmac, timingSafeEqual } from 'crypto';
import { optionalEnv, requiredEnv } from './env';

export function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now()) {
  if (!header) return false;
  const fields = Object.fromEntries(header.split(',').map((part) => part.split('=', 2)));
  const timestamp = Number(fields.t);
  if (!timestamp || Math.abs(now / 1000 - timestamp) > 300 || !fields.v1) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const actual = fields.v1;
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function stripeRequest(path: string, values: Record<string, string | undefined>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) body.set(key, value);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requiredEnv('STRIPE_SECRET_KEY')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || 'Stripe request failed.');
  return result;
}

export async function stripeGet(path: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${requiredEnv('STRIPE_SECRET_KEY')}` },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || 'Stripe request failed.');
  return result;
}

export function planForPrice(priceId?: string | null) {
  if (priceId && priceId === optionalEnv('STRIPE_ENTERPRISE_PRICE_ID')) return 'enterprise';
  if (priceId && priceId === optionalEnv('STRIPE_TEAM_PRICE_ID')) return 'team';
  return 'free';
}

export function priceForPlan(plan: string) {
  if (plan === 'enterprise') return requiredEnv('STRIPE_ENTERPRISE_PRICE_ID');
  if (plan === 'team') return requiredEnv('STRIPE_TEAM_PRICE_ID');
  throw new Error('Only Team and Enterprise plans can be purchased.');
}
