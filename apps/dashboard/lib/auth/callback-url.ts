const DEFAULT_DASHBOARD_URL = 'https://dev-sync.dev';

export function getAuthCallbackUrl(next = '/dashboard') {
  const configuredUrl =
    process.env.NEXT_PUBLIC_DASHBOARD_URL?.trim() || DEFAULT_DASHBOARD_URL;
  const dashboardUrl = configuredUrl.replace(/\/+$/, '');

  return `${dashboardUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}
