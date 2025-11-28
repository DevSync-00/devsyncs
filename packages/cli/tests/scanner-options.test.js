import test from 'node:test';
import assert from 'node:assert/strict';

import { formatLastScan } from '../dist/commands/scan.js';

test('formatLastScan returns "Never" when undefined', () => {
  assert.equal(formatLastScan(), 'Never');
  assert.equal(formatLastScan(null), 'Never');
});

test('formatLastScan formats ISO timestamps', () => {
  const iso = new Date('2024-03-02T12:34:56Z').toISOString();
  const formatted = formatLastScan(iso);
  assert.ok(formatted.includes('2024') || formatted.includes('3/2/2024'));
});

test('formatLastScan preserves unparseable strings', () => {
  const weird = 'not-a-date';
  assert.equal(formatLastScan(weird), weird);
});

