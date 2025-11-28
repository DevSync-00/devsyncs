import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_LOG = console.log;
const ORIGINAL_ENV = {
  ANALYZER_URL: process.env.ANALYZER_URL,
  DASHBOARD_URL: process.env.DASHBOARD_URL,
  NEXT_PUBLIC_ANALYZER_URL: process.env.NEXT_PUBLIC_ANALYZER_URL,
  NEXT_PUBLIC_DASHBOARD_URL: process.env.NEXT_PUBLIC_DASHBOARD_URL,
  DEVSYNC_SILENT: process.env.DEVSYNC_SILENT,
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

test('loginCommand completes successfully and saves credentials', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-test-'));
  const configPath = join(tmpDir, 'auth.json');

  process.env.DEVSYNC_CONFIG_PATH = configPath;
  process.env.DEVSYNC_SILENT = '1';
  process.env.ANALYZER_URL = 'http://localhost:4000';
  process.env.DASHBOARD_URL = 'http://localhost:3000';

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

  let pollCount = 0;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/auth/device/start')) {
      return response(startPayload);
    }
    if (url.endsWith('/api/auth/device/token')) {
      pollCount++;
      if (pollCount === 1) {
        return response({ error: 'authorization_pending' }, 400);
      }
      return response(tokenPayload);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  try {
    const { setAuthConfigPath } = await import('../dist/lib/config.js');
    setAuthConfigPath(configPath);

    const { loginCommand } = await import('../dist/commands/login.js');
    await loginCommand();

    // Verify credentials were saved
    const stored = JSON.parse(readFileSync(configPath, 'utf-8'));
    assert.equal(stored.refreshToken, 'refresh-token');
    assert.equal(stored.accessToken, tokenPayload.access_token);
    assert.equal(stored.userId, 'user-1');
    assert.equal(stored.clientId, 'cli');
    assert.equal(stored.apiUrl, 'http://localhost:3000');
    assert.ok(stored.expiresAt);
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    console.log = ORIGINAL_LOG;
    rmSync(tmpDir, { recursive: true, force: true });
    Object.assign(process.env, ORIGINAL_ENV);
  }
});

test('loginCommand handles connection errors gracefully', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-test-'));
  const configPath = join(tmpDir, 'auth.json');

  process.env.DEVSYNC_CONFIG_PATH = configPath;
  process.env.DEVSYNC_SILENT = '1';
  process.env.ANALYZER_URL = 'http://localhost:4000';

  globalThis.fetch = async () => {
    throw new Error('fetch failed: ECONNREFUSED');
  };

  const lines = [];
  console.log = (message, ...rest) => {
    if (typeof message === 'string') {
      lines.push(message);
    }
    ORIGINAL_LOG.call(console, message, ...rest);
  };

  try {
    const { setAuthConfigPath } = await import('../dist/lib/config.js');
    setAuthConfigPath(configPath);

    const { loginCommand } = await import('../dist/commands/login.js');
    
    // Should exit with code 1
    const originalExit = process.exit;
    let exitCode = null;
    process.exit = (code) => {
      exitCode = code;
      throw new Error(`exit:${code}`);
    };

    await assert.rejects(
      () => loginCommand(),
      /exit:1/
    );

    assert.equal(exitCode, 1);
    
    // Should show helpful error message
    const errorMessage = lines.join(' ');
    assert.ok(
      errorMessage.includes('Failed to connect') || 
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('Troubleshooting'),
      'Should show helpful error message'
    );

    process.exit = originalExit;
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    console.log = ORIGINAL_LOG;
    rmSync(tmpDir, { recursive: true, force: true });
    Object.assign(process.env, ORIGINAL_ENV);
  }
});

test('loginCommand handles device flow timeout', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-test-'));
  const configPath = join(tmpDir, 'auth.json');

  process.env.DEVSYNC_CONFIG_PATH = configPath;
  process.env.DEVSYNC_SILENT = '1';
  process.env.ANALYZER_URL = 'http://localhost:4000';

  const startPayload = {
    device_code: 'device-code-1',
    user_code: 'CODE-1234',
    verification_uri: 'https://example.com/device',
    expires_in: 1, // Very short expiry
    interval: 0.5,
  };

  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/auth/device/start')) {
      return response(startPayload);
    }
    if (url.endsWith('/api/auth/device/token')) {
      return response({ error: 'authorization_pending' }, 400);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const lines = [];
  console.log = (message, ...rest) => {
    if (typeof message === 'string') {
      lines.push(message);
    }
    ORIGINAL_LOG.call(console, message, ...rest);
  };

  try {
    const { setAuthConfigPath } = await import('../dist/lib/config.js');
    setAuthConfigPath(configPath);

    const { loginCommand } = await import('../dist/commands/login.js');
    
    const originalExit = process.exit;
    let exitCode = null;
    process.exit = (code) => {
      exitCode = code;
      throw new Error(`exit:${code}`);
    };

    await assert.rejects(
      () => loginCommand(),
      /exit:1/
    );

    assert.equal(exitCode, 1);
    
    const errorMessage = lines.join(' ');
    assert.ok(
      errorMessage.includes('expired') || 
      errorMessage.includes('timeout'),
      'Should show timeout/expiry error'
    );

    process.exit = originalExit;
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    console.log = ORIGINAL_LOG;
    rmSync(tmpDir, { recursive: true, force: true });
    Object.assign(process.env, ORIGINAL_ENV);
  }
}, { timeout: 5000 });

test('loginCommand handles invalid token response', async () => {
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

  let pollCount = 0;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/auth/device/start')) {
      return response(startPayload);
    }
    if (url.endsWith('/api/auth/device/token')) {
      pollCount++;
      if (pollCount === 1) {
        return response({ error: 'authorization_pending' }, 400);
      }
      // Return invalid token (missing fields)
      return response({ token_type: 'Bearer' });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  try {
    const { setAuthConfigPath } = await import('../dist/lib/config.js');
    setAuthConfigPath(configPath);

    const { loginCommand } = await import('../dist/commands/login.js');
    
    const originalExit = process.exit;
    let exitCode = null;
    process.exit = (code) => {
      exitCode = code;
      throw new Error(`exit:${code}`);
    };

    await assert.rejects(
      () => loginCommand(),
      /exit:1/
    );

    assert.equal(exitCode, 1);
    process.exit = originalExit;
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    console.log = ORIGINAL_LOG;
    rmSync(tmpDir, { recursive: true, force: true });
    Object.assign(process.env, ORIGINAL_ENV);
  }
});

test.after(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  console.log = ORIGINAL_LOG;
  Object.assign(process.env, ORIGINAL_ENV);
});

