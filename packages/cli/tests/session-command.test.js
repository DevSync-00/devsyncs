import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { saveAuthConfig, setAuthConfigPath } from '../dist/lib/auth-config.js';
import { logoutCommand, sessionCommand } from '../dist/commands/session.js';

function captureLogs() {
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  return { lines, restore: () => { console.log = original; } };
}

test('sessionCommand reports signed-out state', async () => {
  const root = mkdtempSync(join(tmpdir(), 'devsync-session-'));
  setAuthConfigPath(join(root, 'auth.json'));
  const capture = captureLogs();
  try {
    await sessionCommand();
    assert.match(capture.lines.join('\n'), /Not signed in/);
  } finally {
    capture.restore();
    setAuthConfigPath(null);
    rmSync(root, { recursive: true, force: true });
  }
});

test('logoutCommand removes the saved session', async () => {
  const root = mkdtempSync(join(tmpdir(), 'devsync-session-'));
  setAuthConfigPath(join(root, 'auth.json'));
  const capture = captureLogs();
  try {
    await saveAuthConfig({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      clientId: 'cli',
    });
    await logoutCommand();
    await sessionCommand();
    assert.match(capture.lines.join('\n'), /Signed out of DevSync/);
    assert.match(capture.lines.join('\n'), /Not signed in/);
  } finally {
    capture.restore();
    setAuthConfigPath(null);
    rmSync(root, { recursive: true, force: true });
  }
});
