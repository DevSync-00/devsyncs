/**
 * Unit tests for RateLimiter
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { RateLimiter, createRateLimiter } from '../../../security/rateLimiting';
import { delay } from '../../utils/testHelpers';

suite('RateLimiter', () => {
  suite('check', () => {
    test('should allow request within limit', () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
      const result = limiter.check('user1');
      assert.ok(result.allowed);
      assert.strictEqual(result.remaining, 9);
    });

    test('should reject request exceeding limit', () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60000 });
      limiter.check('user1');
      limiter.check('user1');
      const result = limiter.check('user1');
      assert.ok(!result.allowed);
      assert.strictEqual(result.remaining, 0);
    });

    test('should track separate limits per identifier', () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60000 });
      limiter.check('user1');
      limiter.check('user1');
      const result1 = limiter.check('user1');
      const result2 = limiter.check('user2');
      assert.ok(!result1.allowed);
      assert.ok(result2.allowed);
    });

    test('should reset after window expires', async () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 100 });
      limiter.check('user1');
      limiter.check('user1');
      await delay(150);
      const result = limiter.check('user1');
      assert.ok(result.allowed);
    });

    test('should return correct reset time', () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
      const result = limiter.check('user1');
      assert.ok(result.resetTime > Date.now());
    });
  });

  suite('recordSuccess', () => {
    test('should record successful request when not skipped', () => {
      const limiter = new RateLimiter({
        maxRequests: 10,
        windowMs: 60000,
        skipSuccessfulRequests: false,
      });
      limiter.recordSuccess('user1');
      const status = limiter.getStatus('user1');
      assert.strictEqual(status.remaining, 9);
    });

    test('should skip recording when configured', () => {
      const limiter = new RateLimiter({
        maxRequests: 10,
        windowMs: 60000,
        skipSuccessfulRequests: true,
      });
      limiter.recordSuccess('user1');
      const status = limiter.getStatus('user1');
      assert.strictEqual(status.remaining, 10);
    });
  });

  suite('recordFailure', () => {
    test('should record failed request when not skipped', () => {
      const limiter = new RateLimiter({
        maxRequests: 10,
        windowMs: 60000,
        skipFailedRequests: false,
      });
      limiter.recordFailure('user1');
      const status = limiter.getStatus('user1');
      assert.strictEqual(status.remaining, 9);
    });

    test('should skip recording when configured', () => {
      const limiter = new RateLimiter({
        maxRequests: 10,
        windowMs: 60000,
        skipFailedRequests: true,
      });
      limiter.recordFailure('user1');
      const status = limiter.getStatus('user1');
      assert.strictEqual(status.remaining, 10);
    });
  });

  suite('reset', () => {
    test('should reset rate limit for identifier', () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
      limiter.check('user1');
      limiter.reset('user1');
      const status = limiter.getStatus('user1');
      assert.strictEqual(status.remaining, 10);
    });
  });

  suite('getStatus', () => {
    test('should return current status', () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
      limiter.check('user1');
      const status = limiter.getStatus('user1');
      assert.ok(status.allowed);
      assert.strictEqual(status.remaining, 9);
      assert.strictEqual(status.limit, 10);
    });

    test('should return fresh status for new identifier', () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
      const status = limiter.getStatus('newuser');
      assert.ok(status.allowed);
      assert.strictEqual(status.remaining, 10);
    });
  });

  suite('createRateLimiter', () => {
    test('should create rate limiter with defaults', () => {
      const limiter = createRateLimiter();
      assert.ok(limiter instanceof RateLimiter);
    });

    test('should create rate limiter with custom config', () => {
      const limiter = createRateLimiter(50, 30000);
      const result = limiter.check('user1');
      assert.ok(result.allowed);
      assert.strictEqual(result.limit, 50);
    });
  });

  suite('dispose', () => {
    test('should clean up resources', () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
      limiter.check('user1');
      limiter.dispose();
      // Should not throw
      assert.ok(true);
    });
  });
});

