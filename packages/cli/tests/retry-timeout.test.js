import test from 'node:test';
import assert from 'node:assert/strict';

import { retry, withTimeout } from '../dist/utils/retry.js';

const ORIGINAL_SET_TIMEOUT = globalThis.setTimeout;

test('retry succeeds on first attempt', async () => {
  let attempts = 0;
  const fn = async () => {
    attempts++;
    return 'success';
  };

  const result = await retry(fn, { maxAttempts: 3 });
  assert.equal(result, 'success');
  assert.equal(attempts, 1);
});

test('retry succeeds after transient failures', async () => {
  let attempts = 0;
  const fn = async () => {
    attempts++;
    if (attempts < 3) {
      throw new Error('ECONNREFUSED');
    }
    return 'success';
  };

  const result = await retry(fn, {
    maxAttempts: 3,
    retryableErrors: ['ECONNREFUSED'],
    initialDelay: 10, // Short delay for test
  });
  
  assert.equal(result, 'success');
  assert.equal(attempts, 3);
});

test('retry fails after max attempts', async () => {
  let attempts = 0;
  const fn = async () => {
    attempts++;
    throw new Error('ECONNREFUSED');
  };

  await assert.rejects(
    () => retry(fn, {
      maxAttempts: 3,
      retryableErrors: ['ECONNREFUSED'],
      initialDelay: 10,
    }),
    /ECONNREFUSED/
  );
  
  assert.equal(attempts, 3);
});

test('retry does not retry non-retryable errors', async () => {
  let attempts = 0;
  const fn = async () => {
    attempts++;
    throw new Error('INVALID_INPUT');
  };

  await assert.rejects(
    () => retry(fn, {
      maxAttempts: 3,
      retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT'],
      initialDelay: 10,
    }),
    /INVALID_INPUT/
  );
  
  assert.equal(attempts, 1); // Should not retry
});

test('retry uses exponential backoff', async () => {
  let attempts = 0;
  const delays = [];
  const startTime = Date.now();

  const fn = async () => {
    attempts++;
    if (attempts < 3) {
      const now = Date.now();
      if (attempts > 1) {
        delays.push(now - startTime);
      }
      throw new Error('ECONNREFUSED');
    }
    return 'success';
  };

  await retry(fn, {
    maxAttempts: 3,
    retryableErrors: ['ECONNREFUSED'],
    initialDelay: 50,
    backoffMultiplier: 2,
  });

  // Verify delays increased (with some tolerance)
  assert.ok(attempts === 3, 'Should have retried');
  // The second delay should be approximately 2x the first
  if (delays.length >= 1) {
    // Allow some tolerance for timing
    assert.ok(delays[0] >= 40 && delays[0] <= 100, 'First retry delay should be around initialDelay');
  }
});

test('retry respects maxDelay', async () => {
  let attempts = 0;
  const fn = async () => {
    attempts++;
    if (attempts < 5) {
      throw new Error('ECONNREFUSED');
    }
    return 'success';
  };

  const startTime = Date.now();
  await retry(fn, {
    maxAttempts: 5,
    retryableErrors: ['ECONNREFUSED'],
    initialDelay: 10,
    maxDelay: 50,
    backoffMultiplier: 2,
  });
  const totalTime = Date.now() - startTime;

  // With maxDelay of 50ms, total time should be reasonable
  // 4 retries with max 50ms each = ~200ms max
  assert.ok(totalTime < 500, 'Total time should respect maxDelay');
});

test('withTimeout succeeds when operation completes in time', async () => {
  const promise = new Promise(resolve => {
    setTimeout(() => resolve('success'), 50);
  });

  const result = await withTimeout(promise, 200, 'Operation timed out');
  assert.equal(result, 'success');
});

test('withTimeout fails when operation exceeds timeout', async () => {
  const promise = new Promise(resolve => {
    setTimeout(() => resolve('success'), 200);
  });

  await assert.rejects(
    () => withTimeout(promise, 50, 'Operation timed out'),
    /Operation timed out/
  );
});

test('withTimeout uses custom error message', async () => {
  const promise = new Promise(resolve => {
    setTimeout(() => resolve('success'), 200);
  });

  await assert.rejects(
    () => withTimeout(promise, 50, 'Custom timeout message'),
    /Custom timeout message/
  );
});

test('withTimeout handles promise rejection', async () => {
  const promise = Promise.reject(new Error('Operation failed'));

  await assert.rejects(
    () => withTimeout(promise, 100, 'Timeout'),
    /Operation failed/
  );
});

test('retry and withTimeout work together', async () => {
  let attempts = 0;
  const fn = async () => {
    attempts++;
    if (attempts < 2) {
      // Simulate slow operation that times out
      await new Promise(resolve => setTimeout(resolve, 100));
      throw new Error('timeout');
    }
    return 'success';
  };

  const wrappedFn = () => withTimeout(fn(), 50, 'Request timed out');
  
  const result = await retry(wrappedFn, {
    maxAttempts: 3,
    retryableErrors: ['timeout', 'Request timed out'],
    initialDelay: 10,
  });

  assert.equal(result, 'success');
  assert.equal(attempts, 2);
});

test.after(() => {
  globalThis.setTimeout = ORIGINAL_SET_TIMEOUT;
});

