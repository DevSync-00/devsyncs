import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_LOG = console.log;

const JWT_HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

function makeJwt(expiresInSeconds = 3600) {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    })
  ).toString('base64url');
  return `${JWT_HEADER}.${payload}.signature`;
}

function response(json, status = 200) {
  return new Response(JSON.stringify(json), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('loginCommand stores credentials and scanCommand reuses them in auth-only mode', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-cli-test-'));
  const configPath = join(tmpDir, 'auth.json');

  const originalEnv = {
    config: process.env.DEVSYNC_CONFIG_PATH,
    silent: process.env.DEVSYNC_SILENT,
    mode: process.env.DEVSYNC_TEST_MODE,
  };

  process.env.DEVSYNC_CONFIG_PATH = configPath;
  process.env.DEVSYNC_SILENT = '1';
  process.env.DEVSYNC_TEST_MODE = 'auth-only';

  const startPayload = {
    device_code: 'device-code-1',
    user_code: 'CODE-1234',
    verification_uri: 'https://example.com/device',
    expires_in: 600,
    interval: 0,
  };

  const tokenPayload = {
    token_type: 'Bearer',
    access_token: makeJwt(),
    refresh_token: 'refresh-token',
    refresh_expires_in: 86400,
    expires_in: 3600,
    user_id: 'user-1',
    client_id: 'cli',
  };

  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/auth/device/start')) {
      return response(startPayload);
    }
    if (url.endsWith('/api/auth/device/token')) {
      return response(tokenPayload);
    }
    if (url.endsWith('/api/auth/token/refresh')) {
      return response({
        ...tokenPayload,
        access_token: makeJwt(),
      });
    }
    throw new Error(`Unexpected fetch target ${url}`);
  };

  let restoreConfigPath;

  try {
    const configModule = await import('../dist/lib/config.js');
    configModule.setAuthConfigPath(configPath);
    restoreConfigPath = configModule.setAuthConfigPath;

    const { loginCommand } = await import('../dist/commands/login.js');
    const { scanCommand } = await import('../dist/commands/scan.js');
    await loginCommand();
    const stored = JSON.parse(readFileSync(configPath, 'utf-8'));
    assert.equal(stored.refreshToken, 'refresh-token');

    const lines = [];
    console.log = (message, ...rest) => {
      if (typeof message === 'string') {
        lines.push(message);
      }
      ORIGINAL_LOG.call(console, message, ...rest);
    };

    await scanCommand({
      path: '.',
      sync: false,
      json: true,
    });

    assert.ok(
      lines.some((line) => line.includes('Test mode enabled: skipping scan after authentication')),
      'expected auth-only mode log line'
    );
  } finally {
    console.log = ORIGINAL_LOG;
    globalThis.fetch = ORIGINAL_FETCH;
    restoreConfigPath?.(originalEnv.config ?? null);
    process.env.DEVSYNC_CONFIG_PATH = originalEnv.config;
    process.env.DEVSYNC_SILENT = originalEnv.silent;
    process.env.DEVSYNC_TEST_MODE = originalEnv.mode;
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

