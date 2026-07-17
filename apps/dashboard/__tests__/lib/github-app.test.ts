import { generateKeyPairSync } from 'crypto';
import { createGitHubAppJwt, getGitHubAppPrivateKey } from '@/lib/github-app';

describe('GitHub App private key handling', () => {
  const originalEnv = process.env;
  const pem = generateKeyPairSync('rsa', { modulusLength: 2048 })
    .privateKey.export({ type: 'pkcs8', format: 'pem' })
    .toString();

  beforeEach(() => {
    process.env = { ...originalEnv, GITHUB_APP_ID: '12345' };
    delete process.env.GITHUB_APP_PRIVATE_KEY;
    delete process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('normalizes quoted PEM values with escaped newlines', () => {
    process.env.GITHUB_APP_PRIVATE_KEY = `"${pem.trim().replace(/\n/g, '\\n')}"`;

    expect(getGitHubAppPrivateKey()).toBe(pem.trim());
    expect(createGitHubAppJwt().split('.')).toHaveLength(3);
  });

  it('accepts a base64-encoded PEM value', () => {
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = Buffer.from(pem).toString('base64');

    expect(getGitHubAppPrivateKey()).toBe(pem.trim());
    expect(createGitHubAppJwt().split('.')).toHaveLength(3);
  });

  it('normalizes a quoted base64 assignment copied into an environment value', () => {
    const encoded = Buffer.from(pem).toString('base64');
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 =
      `"GITHUB_APP_PRIVATE_KEY_BASE64=${encoded}\n"`;

    expect(getGitHubAppPrivateKey()).toBe(pem.trim());
    expect(createGitHubAppJwt().split('.')).toHaveLength(3);
  });

  it('reports an actionable error for an invalid private key', () => {
    process.env.GITHUB_APP_PRIVATE_KEY = 'not-a-private-key';

    expect(() => createGitHubAppJwt()).toThrow(
      'GitHub App private key is invalid: missing PEM header'
    );
  });
});
