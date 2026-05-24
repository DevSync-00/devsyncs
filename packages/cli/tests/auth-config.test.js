import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  loadAuthConfig,
  saveAuthConfig,
  deleteAuthConfig,
  isTokenExpired,
  deriveExpiryFromToken,
  setAuthConfigPath,
} from '../dist/lib/auth-config.js';

const ORIGINAL_ENV = process.env.DEVSYNC_CONFIG_PATH;

function makeJwt(expiresInSeconds = 3600) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    })
  ).toString('base64url');
  return `${header}.${payload}.signature`;
}

test('loadAuthConfig returns null when file does not exist', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-test-'));
  const configPath = join(tmpDir, 'nonexistent.json');
  setAuthConfigPath(configPath);

  try {
    const result = await loadAuthConfig();
    assert.equal(result, null);
  } finally {
    setAuthConfigPath(null);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('loadAuthConfig loads valid config', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-test-'));
  const configPath = join(tmpDir, 'auth.json');
  setAuthConfigPath(configPath);

  const testConfig = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    refreshExpiresAt: Math.floor(Date.now() / 1000) + 86400,
    userId: 'user-1',
    clientId: 'cli',
    apiUrl: 'http://localhost:3000',
  };

  writeFileSync(configPath, JSON.stringify(testConfig), 'utf-8');

  try {
    const result = await loadAuthConfig();
    assert.ok(result);
    assert.equal(result.accessToken, 'access-token');
    assert.equal(result.refreshToken, 'refresh-token');
    assert.equal(result.userId, 'user-1');
    assert.equal(result.clientId, 'cli');
    assert.equal(result.apiUrl, 'http://localhost:3000');
  } finally {
    setAuthConfigPath(null);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('loadAuthConfig returns null for invalid config', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-test-'));
  const configPath = join(tmpDir, 'auth.json');
  setAuthConfigPath(configPath);

  // Write invalid config (missing required fields)
  writeFileSync(configPath, JSON.stringify({ accessToken: 'token' }), 'utf-8');

  try {
    const result = await loadAuthConfig();
    assert.equal(result, null);
  } finally {
    setAuthConfigPath(null);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('loadAuthConfig handles corrupted JSON', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-test-'));
  const configPath = join(tmpDir, 'auth.json');
  setAuthConfigPath(configPath);

  writeFileSync(configPath, 'invalid json{', 'utf-8');

  try {
    const result = await loadAuthConfig();
    assert.equal(result, null);
  } finally {
    setAuthConfigPath(null);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('saveAuthConfig creates file with correct structure', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-test-'));
  const configPath = join(tmpDir, 'auth.json');
  setAuthConfigPath(configPath);

  const testConfig = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    refreshExpiresAt: Math.floor(Date.now() / 1000) + 86400,
    userId: 'user-1',
    clientId: 'cli',
    apiUrl: 'http://localhost:3000',
  };

  try {
    await saveAuthConfig(testConfig);
    assert.ok(existsSync(configPath));
    
    const saved = JSON.parse(readFileSync(configPath, 'utf-8'));
    assert.equal(saved.accessToken, testConfig.accessToken);
    assert.equal(saved.refreshToken, testConfig.refreshToken);
    assert.equal(saved.userId, testConfig.userId);
  } finally {
    setAuthConfigPath(null);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('deleteAuthConfig removes config file', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-test-'));
  const configPath = join(tmpDir, 'auth.json');
  setAuthConfigPath(configPath);

  const testConfig = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    clientId: 'cli',
  };

  writeFileSync(configPath, JSON.stringify(testConfig), 'utf-8');

  try {
    assert.ok(existsSync(configPath));
    await deleteAuthConfig();
    assert.equal(existsSync(configPath), false);
  } finally {
    setAuthConfigPath(null);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('deleteAuthConfig handles nonexistent file gracefully', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-test-'));
  const configPath = join(tmpDir, 'nonexistent.json');
  setAuthConfigPath(configPath);

  try {
    await deleteAuthConfig(); // Should not throw
  } finally {
    setAuthConfigPath(null);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('isTokenExpired returns false for valid token', () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  assert.equal(isTokenExpired(expiresAt), false);
});

test('isTokenExpired returns true for expired token', () => {
  const expiresAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
  assert.equal(isTokenExpired(expiresAt), true);
});

test('isTokenExpired respects buffer seconds', () => {
  const expiresAt = Math.floor(Date.now() / 1000) + 30; // 30 seconds from now
  // With default 60s buffer, should be considered expired
  assert.equal(isTokenExpired(expiresAt), true);
  
  // With 0s buffer, should not be expired
  assert.equal(isTokenExpired(expiresAt, 0), false);
});

test('deriveExpiryFromToken extracts expiry from JWT', () => {
  const expiresIn = 7200; // 2 hours
  const token = makeJwt(expiresIn);
  const expiry = deriveExpiryFromToken(token);
  
  const expected = Math.floor(Date.now() / 1000) + expiresIn;
  // Allow 1 second tolerance
  assert.ok(Math.abs(expiry - expected) <= 1);
});

test('deriveExpiryFromToken throws on invalid JWT format', () => {
  assert.throws(
    () => deriveExpiryFromToken('invalid.jwt'),
    /Failed to parse token expiry/
  );
});

test('deriveExpiryFromToken throws on missing exp claim', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url');
  const token = `${header}.${payload}.signature`;
  
  assert.throws(
    () => deriveExpiryFromToken(token),
    /JWT missing expiration claim/
  );
});

test('setAuthConfigPath overrides default path', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'devsync-test-'));
  const customPath = join(tmpDir, 'custom-auth.json');
  
  const testConfig = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    clientId: 'cli',
  };

  try {
    setAuthConfigPath(customPath);
    await saveAuthConfig(testConfig);
    assert.ok(existsSync(customPath));
    
    const loaded = await loadAuthConfig();
    assert.equal(loaded?.accessToken, 'access-token');
  } finally {
    setAuthConfigPath(null);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test.after(() => {
  if (ORIGINAL_ENV) {
    process.env.DEVSYNC_CONFIG_PATH = ORIGINAL_ENV;
  } else {
    delete process.env.DEVSYNC_CONFIG_PATH;
  }
  setAuthConfigPath(null);
});

