import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProjectCommand } from '../dist/commands/projects.js';

test('createProjectCommand creates a usable offline project', async () => {
  const root = mkdtempSync(join(tmpdir(), 'devsync-create-'));
  const originalLog = console.log;
  console.log = () => {};
  try {
    await createProjectCommand({ path: root, name: 'Local Project', schemaType: 'prisma', local: true });
    const config = JSON.parse(readFileSync(join(root, '.devsync', 'config.json'), 'utf8'));
    assert.equal(config.project.name, 'Local Project');
    assert.equal(config.project.schemaType, 'prisma');
    assert.equal(config.project.id, '');
    assert.equal(config.database.writeAccess, false);
    assert.equal(config.safety.allowDbWrites, false);
  } finally {
    console.log = originalLog;
    rmSync(root, { recursive: true, force: true });
  }
});
