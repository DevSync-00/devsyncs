import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = {
  DEVSYNC_CONFIG_PATH: process.env.DEVSYNC_CONFIG_PATH,
  DEVSYNC_SILENT: process.env.DEVSYNC_SILENT,
  ANALYZER_URL: process.env.ANALYZER_URL,
};

function makeJwt(expiresInSeconds = 3600) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    })
  ).toString('base64url');
  return `${header}.${payload}.signature`;
}

function response(json, status = 200) {
  return new Response(JSON.stringify(json), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('Full auth flow: login → token refresh → requireAuthenticatedCli', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-test-'));
  const configPath = join(tmpDir, 'auth.json');

  process.env.DEVSYNC_CONFIG_PATH = configPath;
  process.env.DEVSYNC_SILENT = '1';
  process.env.ANALYZER_URL = 'http://localhost:4000';

  const startPayload = {
    device_code: 'device-code-1',
    user_code: 'CODE-1234',
    verification_uri: 'https://example.com/device',
    expires_in: 600,
    interval: 0,
  };

  const initialToken = {
    token_type: 'Bearer',
    access_token: makeJwt(10), // Expires in 10 seconds
    refresh_token: 'refresh-token',
    refresh_expires_in: 86400,
    expires_in: 10,
    user_id: 'user-1',
    client_id: 'cli',
  };

  const refreshedToken = {
    token_type: 'Bearer',
    access_token: makeJwt(3600), // New token, expires in 1 hour
    refresh_token: 'new-refresh-token',
    refresh_expires_in: 86400,
    expires_in: 3600,
    user_id: 'user-1',
    client_id: 'cli',
  };

  let fetchCount = 0;
  globalThis.fetch = async (input) => {
    fetchCount++;
    const url = typeof input === 'string' ? input : input.url;
    
    if (url.endsWith('/api/auth/device/start')) {
      return response(startPayload);
    }
    if (url.endsWith('/api/auth/device/token')) {
      return response(initialToken);
    }
    if (url.endsWith('/api/auth/token/refresh')) {
      return response(refreshedToken);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  try {
    const { setAuthConfigPath } = await import('../dist/lib/config.js');
    setAuthConfigPath(configPath);

    // Step 1: Login
    const { loginCommand } = await import('../dist/commands/login.js');
    await loginCommand();

    // Verify initial credentials saved
    let stored = JSON.parse(readFileSync(configPath, 'utf-8'));
    assert.equal(stored.refreshToken, 'refresh-token');
    assert.equal(stored.userId, 'user-1');

    // Step 2: Wait a bit to simulate token expiry, then use requireAuthenticatedCli
    // (In real scenario, token would expire, but for test we'll just check refresh logic)
    const { requireAuthenticatedCli } = await import('../dist/lib/auth-check.js');
    
    // Mock isTokenExpired to return true to trigger refresh
    const { __setAuthCheckDeps, __resetAuthCheckDeps } = await import('../dist/lib/auth-check.js');
    const { isTokenExpired } = await import('../dist/lib/auth-config.js');
    
    __setAuthCheckDeps({
      isTokenExpired: () => true, // Force refresh
    });

    const auth = await requireAuthenticatedCli();

    // Verify refreshed token
    assert.equal(auth.accessToken, refreshedToken.access_token);
    assert.equal(auth.refreshToken, refreshedToken.refresh_token);

    // Verify config was updated
    stored = JSON.parse(readFileSync(configPath, 'utf-8'));
    assert.equal(stored.refreshToken, refreshedToken.refresh_token);

    __resetAuthCheckDeps();
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    rmSync(tmpDir, { recursive: true, force: true });
    Object.assign(process.env, ORIGINAL_ENV);
  }
});

test('Auth flow handles refresh token expiration', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-test-'));
  const configPath = join(tmpDir, 'auth.json');

  process.env.DEVSYNC_CONFIG_PATH = configPath;
  process.env.DEVSYNC_SILENT = '1';
  process.env.ANALYZER_URL = 'http://localhost:4000';

  // Load expired auth config
  const expiredConfig = {
    accessToken: makeJwt(-3600), // Expired
    refreshToken: 'expired-refresh',
    expiresAt: Math.floor(Date.now() / 1000) - 3600,
    clientId: 'cli',
  };

  const { setAuthConfigPath, saveAuthConfig } = await import('../dist/lib/config.js');
  setAuthConfigPath(configPath);
  await saveAuthConfig(expiredConfig);

  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/auth/token/refresh')) {
      return response({ error: 'Invalid refresh token' }, 401);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  try {
    const { requireAuthenticatedCli } = await import('../dist/lib/auth-check.js');
    const { __setAuthCheckDeps } = await import('../dist/lib/auth-check.js');
    
    __setAuthCheckDeps({
      isTokenExpired: () => true,
    });

    const originalExit = process.exit;
    let exitCode = null;
    process.exit = (code) => {
      exitCode = code;
      throw new Error(`exit:${code}`);
    };

    await assert.rejects(
      () => requireAuthenticatedCli(),
      /exit:1/
    );

    assert.equal(exitCode, 1);
    process.exit = originalExit;
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    rmSync(tmpDir, { recursive: true, force: true });
    Object.assign(process.env, ORIGINAL_ENV);
  }
});

test.after(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  Object.assign(process.env, ORIGINAL_ENV);
});

