import test from 'node:test';
import assert from 'node:assert/strict';

import { AnalyzerApiClient } from '../dist/lib/api-client.js';

const ORIGINAL_FETCH = globalThis.fetch;

test('AnalyzerApiClient retries transient start failures', async () => {
  let attempts = 0;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    attempts += 1;
    if (attempts === 1) {
      throw new Error('fetch failed: ECONNRESET');
    }
    if (url.endsWith('/api/auth/device/start')) {
      return new Response(
        JSON.stringify({
          device_code: 'device-test',
          user_code: 'ABCD-1234',
          verification_uri: 'https://example.com/device',
          expires_in: 600,
          interval: 0,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unhandled URL ${url}`);
  };

  const client = new AnalyzerApiClient('http://localhost:5555', {
    timeoutMs: 50,
    retryAttempts: 2,
  });

  const payload = await client.startDeviceFlow('cli');
  assert.equal(payload.user_code, 'ABCD-1234');
  assert.equal(attempts, 2);
});

test('AnalyzerApiClient surfaces analyzer hint on repeated failures', async () => {
  globalThis.fetch = async () => {
    throw new Error('fetch failed: ECONNREFUSED');
  };

  const client = new AnalyzerApiClient('http://localhost:6666', {
    timeoutMs: 10,
    retryAttempts: 2,
  });

  await assert.rejects(
    () => client.startDeviceFlow('cli'),
    /Ensure the Dev-Sync dashboard is running/
  );
});

test.after(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

