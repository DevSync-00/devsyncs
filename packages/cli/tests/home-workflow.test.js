import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getHomeState } from '../dist/commands/home.js';
import { saveAuthConfig, setAuthConfigPath } from '../dist/lib/auth-config.js';

test('getHomeState combines the signed-in account and linked project', async () => {
  const root = mkdtempSync(join(tmpdir(), 'devsync-home-'));
  const authPath = join(root, 'auth.json');
  setAuthConfigPath(authPath);
  mkdirSync(join(root, '.devsync'), { recursive: true });
  writeFileSync(join(root, '.devsync', 'config.json'), JSON.stringify({
    version: '1.0',
    project: { id: 'project-123', name: 'Dashboard Project', schemaType: 'supabase' },
    database: { mode: 'auto', connectionString: '', writeAccess: false },
    safety: { allowWrites: false, allowDbWrites: false, requirePlanApproval: true },
    paths: { ignores: [] },
  }));
  await saveAuthConfig({
    accessToken: 'token',
    refreshToken: 'refresh',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    clientId: 'cli',
    userId: 'user-123',
  });

  try {
    const state = await getHomeState(root);
    assert.deepEqual(state, {
      authenticated: true,
      userId: 'user-123',
      projectId: 'project-123',
      projectName: 'Dashboard Project',
      schemaType: 'supabase',
    });
  } finally {
    setAuthConfigPath(null);
    rmSync(root, { recursive: true, force: true });
  }
});

test('devsync without arguments gives safe guidance outside an interactive terminal', () => {
  const output = execFileSync(process.execPath, ['dist/index.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.match(output, /guided workflow/);
  assert.match(output, /devsync --help/);
});
