const PLACEHOLDER_VALUES = new Set(['undefined', 'null', 'none', '']);

/**
 * Resolve the DevSync dashboard base URL from environment variables.
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

  return 'http://localhost:3000';
}

/**
 * Build the browser URL for device-flow authorization.
 * Prefers the server-provided verification_uri when it is a valid absolute URL.
 */
export function buildDeviceVerificationUrl(
  verificationUri: string | undefined,
  dashboardUrl: string,
  userCode: string
): string {
  const fromApi = normalizeAbsoluteUrl(verificationUri);
  if (fromApi) {
    return fromApi;
  }

  const base = normalizeBaseUrl(dashboardUrl) ?? 'http://localhost:3000';
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
