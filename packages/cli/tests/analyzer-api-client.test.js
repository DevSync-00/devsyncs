import test from 'node:test';
import assert from 'node:assert/strict';

import { AnalyzerApiClient } from '../dist/lib/api-client.js';

const ORIGINAL_FETCH = globalThis.fetch;

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

test('AnalyzerApiClient.startDeviceFlow succeeds on first attempt', async () => {
  const startPayload = {
    device_code: 'device-code-1',
    user_code: 'CODE-1234',
    verification_uri: 'https://example.com/device',
    expires_in: 600,
    interval: 5,
  };

  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/auth/device/start')) {
      return response(startPayload);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const client = new AnalyzerApiClient('http://localhost:4000', {
    timeoutMs: 5000,
    retryAttempts: 3,
  });

  const result = await client.startDeviceFlow('cli');
  assert.equal(result.device_code, 'device-code-1');
  assert.equal(result.user_code, 'CODE-1234');
  assert.equal(result.verification_uri, 'https://example.com/device');
  assert.equal(result.expires_in, 600);
  assert.equal(result.interval, 5);
});

test('AnalyzerApiClient.startDeviceFlow retries on network errors', async () => {
  let attempts = 0;
  const startPayload = {
    device_code: 'device-code-1',
    user_code: 'CODE-1234',
    verification_uri: 'https://example.com/device',
    expires_in: 600,
    interval: 5,
  };

  globalThis.fetch = async (input) => {
    attempts++;
    if (attempts === 1) {
      throw new Error('fetch failed: ECONNRESET');
    }
    if (attempts === 2) {
      throw new Error('ETIMEDOUT');
    }
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/auth/device/start')) {
      return response(startPayload);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const client = new AnalyzerApiClient('http://localhost:4000', {
    timeoutMs: 5000,
    retryAttempts: 3,
  });

  const result = await client.startDeviceFlow('cli');
  assert.equal(result.user_code, 'CODE-1234');
  assert.equal(attempts, 3);
});

test('AnalyzerApiClient.startDeviceFlow provides helpful error on service unavailable', async () => {
  globalThis.fetch = async () => {
    return response({ error: 'Service unavailable' }, 503);
  };

  const client = new AnalyzerApiClient('http://localhost:4000', {
    timeoutMs: 5000,
    retryAttempts: 2,
  });

  await assert.rejects(
    () => client.startDeviceFlow('cli'),
    /Ensure the DevSync analyzer service is running/
  );
});

test('AnalyzerApiClient.startDeviceFlow validates response structure', async () => {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/auth/device/start')) {
      return response({ device_code: 'test' }); // Missing required fields
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const client = new AnalyzerApiClient('http://localhost:4000');
  
  await assert.rejects(
    () => client.startDeviceFlow('cli'),
    /Invalid device flow response: missing required fields/
  );
});

test('AnalyzerApiClient.pollDeviceFlowToken succeeds when authorized', async () => {
  let pollCount = 0;
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
    if (url.endsWith('/api/auth/device/token')) {
      pollCount++;
      if (pollCount === 1) {
        return response({ error: 'authorization_pending' }, 400);
      }
      return response(tokenPayload);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const client = new AnalyzerApiClient('http://localhost:4000', {
    timeoutMs: 5000,
  });

  const result = await client.pollDeviceFlowToken('device-code', 2, 600);
  assert.equal(result.access_token, tokenPayload.access_token);
  assert.equal(result.refresh_token, tokenPayload.refresh_token);
  assert.equal(result.user_id, 'user-1');
});

test('AnalyzerApiClient.pollDeviceFlowToken handles expired device code', async () => {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/auth/device/token')) {
      return response({ error: 'expired_token' }, 403);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const client = new AnalyzerApiClient('http://localhost:4000', {
    timeoutMs: 5000,
  });

  await assert.rejects(
    () => client.pollDeviceFlowToken('device-code', 2, 600),
    /Device code expired or was already used/
  );
});

test('AnalyzerApiClient.pollDeviceFlowToken times out after expiry', async () => {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/auth/device/token')) {
      return response({ error: 'authorization_pending' }, 400);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const client = new AnalyzerApiClient('http://localhost:4000', {
    timeoutMs: 100, // Short timeout for test
  });

  // Use very short expiry (1 second)
  await assert.rejects(
    () => client.pollDeviceFlowToken('device-code', 0.5, 1),
    /Device flow expired/
  );
}, { timeout: 5000 }); // Test timeout longer than flow expiry

test('AnalyzerApiClient.refreshTokens succeeds with valid refresh token', async () => {
  const refreshPayload = {
    token_type: 'Bearer',
    access_token: makeJwt(7200),
    refresh_token: 'new-refresh-token',
    refresh_expires_in: 86400,
    expires_in: 7200,
    user_id: 'user-1',
    client_id: 'cli',
  };

  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/auth/token/refresh')) {
      return response(refreshPayload);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const client = new AnalyzerApiClient('http://localhost:4000');
  const result = await client.refreshTokens('old-refresh-token');
  
  assert.equal(result.access_token, refreshPayload.access_token);
  assert.equal(result.refresh_token, refreshPayload.refresh_token);
  assert.equal(result.user_id, 'user-1');
});

test('AnalyzerApiClient.refreshTokens handles expired refresh token', async () => {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/auth/token/refresh')) {
      return response({ error: 'Invalid refresh token' }, 401);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const client = new AnalyzerApiClient('http://localhost:4000');
  
  await assert.rejects(
    () => client.refreshTokens('expired-token'),
    /Token refresh failed: refresh token is invalid or expired/
  );
});

test('AnalyzerApiClient.refreshTokens validates response structure', async () => {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.endsWith('/api/auth/token/refresh')) {
      return response({ token_type: 'Bearer' }); // Missing required fields
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const client = new AnalyzerApiClient('http://localhost:4000');
  
  await assert.rejects(
    () => client.refreshTokens('refresh-token'),
    /Invalid refresh response: missing required fields/
  );
});

test('AnalyzerApiClient handles timeout errors', async () => {
  globalThis.fetch = async () => {
    // Simulate slow response
    await new Promise(resolve => setTimeout(resolve, 200));
    return response({});
  };

  const client = new AnalyzerApiClient('http://localhost:4000', {
    timeoutMs: 50, // Very short timeout
    retryAttempts: 1,
  });

  await assert.rejects(
    () => client.startDeviceFlow('cli'),
    /timeout/
  );
}, { timeout: 1000 });

test.after(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

