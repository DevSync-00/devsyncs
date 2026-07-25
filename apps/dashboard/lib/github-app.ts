import { createPrivateKey, createSign } from 'crypto';
import { getAdminClient } from '@/lib/supabase/admin';

const GITHUB_API_VERSION = '2026-03-10';

export interface GitHubRepository {
  id: number;
  fullName: string;
  private: boolean;
  url: string;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

export function getGitHubAppSlug() {
  return process.env.GITHUB_APP_SLUG?.trim() || '';
}

export function getGitHubAppOAuthClientId() {
  return process.env.GITHUB_APP_CLIENT_ID?.trim() || '';
}

export function getGitHubAppPrivateKey() {
  let base64Key = process.env.GITHUB_APP_PRIVATE_KEY_BASE64?.trim() || '';
  if (
    (base64Key.startsWith('"') && base64Key.endsWith('"')) ||
    (base64Key.startsWith("'") && base64Key.endsWith("'"))
  ) {
    base64Key = base64Key.slice(1, -1);
  }
  base64Key = base64Key
    .replace(/^GITHUB_APP_PRIVATE_KEY_BASE64\s*=\s*/i, '')
    .replace(/\s/g, '');

  let privateKey = base64Key
    ? Buffer.from(base64Key, 'base64').toString('utf8')
    : process.env.GITHUB_APP_PRIVATE_KEY?.trim() || '';

  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }

  return privateKey.replace(/\\r\\n|\\n/g, '\n').replace(/\r\n/g, '\n').trim();
}

function describePrivateKey(privateKey: string) {
  if (!privateKey) return 'empty';
  if (/^LS0tLS1CRUdJTi/.test(privateKey)) return 'still base64-encoded';
  if (!privateKey.includes('-----BEGIN ')) return 'missing PEM header';
  if (!privateKey.includes(' PRIVATE KEY-----')) return 'not a private-key PEM';
  if (!privateKey.includes('-----END ')) return 'missing PEM footer';
  return `PEM detected (${privateKey.length} characters)`;
}

export function createGitHubAppJwt() {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const privateKey = getGitHubAppPrivateKey();
  if (!appId || !privateKey) {
    throw new Error(
      'GitHub App is not configured. Add GITHUB_APP_ID and a GitHub-generated private key.'
    );
  }

  let key;
  try {
    key = createPrivateKey(privateKey);
  } catch {
    throw new Error(
      `The GitHub App private key is invalid: ${describePrivateKey(privateKey)}. Check the Vercel Production environment value and redeploy.`
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: appId }));
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  return `${unsignedToken}.${base64Url(signer.sign(key))}`;
}

async function githubRequest<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'DevSync',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status} ${response.statusText}).`);
  }
  return response.json() as Promise<T>;
}

export async function exchangeGitHubOAuthCode(code: string) {
  const clientId = getGitHubAppOAuthClientId();
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'GitHub user authorization is not configured. Add GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET.'
    );
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'DevSync',
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const data = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || 'GitHub authorization failed.');
  }
  return data.access_token;
}

export async function getGitHubInstallationsForUser(userAccessToken: string) {
  const data = await githubRequest<{ installations: any[] }>(
    'https://api.github.com/user/installations?per_page=100',
    userAccessToken
  );
  return data.installations || [];
}

export async function getGitHubOAuthUser(userAccessToken: string) {
  return githubRequest<{ id: number; login: string }>(
    'https://api.github.com/user',
    userAccessToken
  );
}

export async function getGitHubInstallation(installationId: number) {
  return githubRequest<any>(
    `https://api.github.com/app/installations/${installationId}`,
    createGitHubAppJwt()
  );
}

export async function createInstallationToken(installationId: number, repository?: string) {
  const data = await githubRequest<{ token: string; expires_at: string }>(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    createGitHubAppJwt(),
    {
      method: 'POST',
      body: JSON.stringify({
        ...(repository ? { repositories: [repository] } : {}),
        permissions: { contents: 'read' },
      }),
    }
  );
  return data.token;
}

export async function createPullRequestReviewToken(installationId: number, repository: string) {
  const data = await githubRequest<{ token: string; expires_at: string }>(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    createGitHubAppJwt(),
    {
      method: 'POST',
      body: JSON.stringify({
        repositories: [repository],
        permissions: {
          contents: 'read',
          checks: 'write',
          pull_requests: 'read',
        },
      }),
    },
  );
  return data.token;
}

export async function createGitHubCheckRun(input: {
  token: string;
  owner: string;
  repository: string;
  headSha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'action_required';
  title: string;
  summary: string;
  text?: string;
  detailsUrl?: string;
}) {
  return githubRequest<any>(
    `https://api.github.com/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repository)}/check-runs`,
    input.token,
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'DevSync Database Safety',
        head_sha: input.headSha,
        status: input.status,
        ...(input.conclusion ? { conclusion: input.conclusion, completed_at: new Date().toISOString() } : {}),
        ...(input.detailsUrl ? { details_url: input.detailsUrl } : {}),
        output: {
          title: input.title.slice(0, 255),
          summary: input.summary.slice(0, 65_535),
          text: input.text?.slice(0, 65_535),
        },
      }),
    },
  );
}

export async function getRepositoriesForInstallation(installationId: number) {
  const token = await createInstallationToken(installationId);
  const repositories: any[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const data = await githubRequest<{ repositories: any[] }>(
      `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
      token
    );
    repositories.push(...(data.repositories || []));
    if (!data.repositories || data.repositories.length < 100) break;
  }

  return repositories;
}

export async function getGitHubAccessTokenForRepository(
  userId: string,
  owner: string,
  repository: string
): Promise<string | null> {
  const admin = getAdminClient() as any;
  const { data: installation } = await admin
    .from('github_app_installations')
    .select('installation_id')
    .eq('user_id', userId)
    .not('github_user_id', 'is', null)
    .ilike('account_login', owner)
    .maybeSingle();

  if (!installation) {
    return process.env.GITHUB_TOKEN?.trim() || null;
  }

  return createInstallationToken(Number(installation.installation_id), repository);
}
