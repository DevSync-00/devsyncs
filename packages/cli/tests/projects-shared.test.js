import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeSchemaType,
  ensureConfigObject,
} from '../dist/commands/projects/shared.js';

test('normalizeSchemaType coerces known values and defaults to prisma', () => {
  assert.equal(normalizeSchemaType('PrIsMa'), 'prisma');
  assert.equal(normalizeSchemaType('django'), 'django');
  assert.equal(normalizeSchemaType('unknown'), 'prisma');
  assert.equal(normalizeSchemaType(undefined), 'prisma');
});

test('ensureConfigObject builds config scaffolding when missing', () => {
  const config = ensureConfigObject(
    null,
    {
      id: 'proj-1',
      name: 'Test Project',
      schemaType: 'supabase',
      dbConnectionString: 'postgres://example',
    },
    'https://api.local',
    'token'
  );

  assert.equal(config.project?.schemaType, 'supabase');
  assert.equal(config.api?.url, 'https://api.local');
  assert.equal(config.api?.key, 'token');
});

test('ensureConfigObject returns existing config untouched', () => {
  const existing = {
    version: '1.0',
    project: { id: 'keep', name: 'Keep', schemaType: 'drizzle' },
  };
  const config = ensureConfigObject(existing, {}, '', '');
  assert.equal(config, existing);
});

