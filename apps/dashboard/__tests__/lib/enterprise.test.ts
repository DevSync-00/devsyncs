import { createHmac } from 'crypto';
import { assertWithinLimit, effectiveEntitlements } from '@/lib/entitlements';
import { createScimToken, normalizeDomains, validateIpAllowlist } from '@/lib/enterprise-security';
import { verifyStripeSignature } from '@/lib/stripe-billing';

describe('enterprise controls', () => {
  it('merges plan defaults with overrides and downgrades inactive plans', () => {
    expect(effectiveEntitlements({ plan: 'team', status: 'active' }).features.managedPreviews).toBe(true);
    expect(effectiveEntitlements({ plan: 'enterprise', status: 'suspended' }).features.sso).toBe(false);
  });

  it('enforces finite limits but permits unlimited values', () => {
    expect(() => assertWithinLimit(-1, 100000, 'Scans')).not.toThrow();
    expect(() => assertWithinLimit(3, 3, 'Projects')).toThrow('Projects limit reached');
  });

  it('normalizes domains and validates IP ranges', () => {
    expect(normalizeDomains([' HTTPS://Example.COM ', 'example.com'])).toEqual(['example.com']);
    expect(validateIpAllowlist(['10.0.0.1', '2001:db8::1'])).toHaveLength(2);
    expect(() => validateIpAllowlist(['not-an-ip'])).toThrow();
  });

  it('creates opaque SCIM tokens stored as hashes', () => {
    const token = createScimToken();
    expect(token.value).toMatch(/^dscim_/);
    expect(token.hash).not.toContain(token.value);
  });

  it('verifies Stripe signatures and rejects stale payloads', () => {
    const payload = '{"id":"evt_1"}';
    const secret = 'whsec_test';
    const timestamp = 1_700_000_000;
    const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
    expect(verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, timestamp * 1000)).toBe(true);
    expect(verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, (timestamp + 301) * 1000)).toBe(false);
  });
});
