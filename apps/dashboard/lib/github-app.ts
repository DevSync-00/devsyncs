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

export function getGitHubAppPrivateKey() {
  const base64Key = process.env.GITHUB_APP_PRIVATE_KEY_BASE64?.trim();
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
      'The GitHub App private key is invalid. Upload the complete PEM key or set GITHUB_APP_PRIVATE_KEY_BASE64 to its base64-encoded contents.'
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
    .ilike('account_login', owner)
    .maybeSingle();

  if (!installation) {
    return process.env.GITHUB_TOKEN?.trim() || null;
  }

  return createInstallationToken(Number(installation.installation_id), repository);
}
