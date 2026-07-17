const DEFAULT_DASHBOARD_URL = 'https://www.dev-sync.dev';

export function getAuthCallbackUrl(next = '/dashboard') {
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const configuredUrl = browserOrigin
    || process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim()
    || DEFAULT_DASHBOARD_URL;
  const dashboardUrl = configuredUrl.replace(/\/+$/, '');

  const callbackUrl = `${dashboardUrl}/auth/callback`;
  return next === '/dashboard'
    ? callbackUrl
    : `${callbackUrl}?next=${encodeURIComponent(next)}`;
}
