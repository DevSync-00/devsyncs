import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { isIP } from 'net';

export function createScimToken() {
  const value = `dscim_${randomBytes(32).toString('base64url')}`;
  return { value, prefix: value.slice(0, 12), hash: hashToken(value) };
}

export function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function constantTimeHashMatch(left: string, right: string) {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normalizeDomains(domains: string[]) {
  return Array.from(new Set(domains.map((domain) => domain.trim().toLowerCase()).filter((domain) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain),
  )));
}

export function validateIpAllowlist(entries: string[]) {
  return entries.map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [address, prefix] = entry.split('/');
    const version = isIP(address);
    if (!version) throw new Error(`Invalid IP address: ${entry}`);
    if (prefix !== undefined) {
      const numeric = Number(prefix);
      const maximum = version === 4 ? 32 : 128;
      if (!Number.isInteger(numeric) || numeric < 0 || numeric > maximum) throw new Error(`Invalid CIDR prefix: ${entry}`);
    }
    return entry;
  });
}
