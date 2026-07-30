const PLACEHOLDER_VALUES = new Set(['undefined', 'null', 'none', '']);
const PLACEHOLDER_HOSTS = new Set([
  'example.com',
  'www.example.com',
  'example.org',
  'www.example.org',
  'example.net',
  'www.example.net',
]);
const PRODUCTION_DASHBOARD_URL = 'https://www.dev-sync.dev';

/**
 * Resolve the Dev-Sync dashboard base URL from environment variables.
 * Ignores placeholder strings like "undefined" that often appear in .env templates.
 */
export function resolveDashboardUrl(): string {
  const candidates = [
    process.env.DASHBOARD_URL,
    process.env.NEXT_PUBLIC_DASHBOARD_URL,
    process.env.ANALYZER_URL,
    process.env.NEXT_PUBLIC_ANALYZER_URL,
  ];

  for (const raw of candidates) {
    const normalized = normalizeBaseUrl(raw);
    if (normalized) {
      return normalized;
    }
  }

  return PRODUCTION_DASHBOARD_URL;
}

/**
 * Build the browser URL for device-flow authorization.
 * Accepts a server-provided verification URI only when it uses the configured
 * dashboard origin. This prevents a compromised or misconfigured response from
 * sending users to an unrelated authorization page.
 */
export function buildDeviceVerificationUrl(
  verificationUri: string | undefined,
  dashboardUrl: string,
  userCode: string
): string {
  const base = normalizeBaseUrl(dashboardUrl) ?? PRODUCTION_DASHBOARD_URL;
  const fromApi = normalizeAbsoluteUrl(verificationUri);
  if (fromApi && new URL(fromApi).origin === base) {
    return fromApi;
  }

  return `${base}/device?code=${encodeURIComponent(userCode)}`;
}

export function normalizeBaseUrl(raw?: string): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (PLACEHOLDER_HOSTS.has(parsed.hostname.toLowerCase())) {
      return null;
    }
    // The apex domain redirects to www in production. Fetch removes bearer
    // credentials on that cross-origin redirect, so always use the canonical
    // API origin before sending authenticated requests.
    if (parsed.hostname.toLowerCase() === 'dev-sync.dev') {
      parsed.hostname = 'www.dev-sync.dev';
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function normalizeAbsoluteUrl(raw?: string): string | null {
  const base = normalizeBaseUrl(raw);
  if (!base) {
    return null;
  }

  try {
    const parsed = new URL(raw!.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (parsed.pathname.includes('undefined')) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
