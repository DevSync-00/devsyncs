import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveDashboardUrl,
  buildDeviceVerificationUrl,
  normalizeBaseUrl,
} from '../dist/utils/dashboard-url.js';

const ORIGINAL_ENV = { ...process.env };

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test('normalizeBaseUrl rejects placeholder strings', () => {
  assert.equal(normalizeBaseUrl('undefined'), null);
  assert.equal(normalizeBaseUrl('null'), null);
  assert.equal(normalizeBaseUrl(''), null);
  assert.equal(normalizeBaseUrl('http://localhost:3000'), 'http://localhost:3000');
});

test('resolveDashboardUrl skips invalid env values', () => {
  process.env.DASHBOARD_URL = 'undefined';
  process.env.NEXT_PUBLIC_DASHBOARD_URL = '';
  process.env.ANALYZER_URL = 'null';
  assert.equal(resolveDashboardUrl(), 'http://localhost:3000');
});

test('buildDeviceVerificationUrl prefers valid API verification_uri', () => {
  const url = buildDeviceVerificationUrl(
    'http://localhost:3000/device?code=ABCD-1234',
    'undefined',
    'ABCD-1234'
  );
  assert.equal(url, 'http://localhost:3000/device?code=ABCD-1234');
});

test('buildDeviceVerificationUrl falls back to dashboard base when API uri is invalid', () => {
  const url = buildDeviceVerificationUrl(
    'undefined/device?code=ABCD-1234',
    'http://localhost:3000',
    'ABCD-1234'
  );
  assert.equal(url, 'http://localhost:3000/device?code=ABCD-1234');
});
