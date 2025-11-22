import os from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, rmSync } from 'fs';

describe('auth config storage', () => {
  const tmpFile = join(os.tmpdir(), `devsync-config-${randomUUID()}.json`);

  beforeEach(() => {
    process.env.DEVSYNC_CONFIG_PATH = tmpFile;
    jest.resetModules();
    if (existsSync(tmpFile)) {
      rmSync(tmpFile);
    }
  });

  afterAll(() => {
    if (existsSync(tmpFile)) {
      rmSync(tmpFile);
    }
    delete process.env.DEVSYNC_CONFIG_PATH;
  });

  test('returns null when config missing', async () => {
    const { loadAuthConfig } = await import('../config.js');
    const config = await loadAuthConfig();
    expect(config).toBeNull();
  });

  test('persists and reads config', async () => {
    const { loadAuthConfig, saveAuthConfig } = await import('../config.js');
    const payload = {
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: 123,
      clientId: 'cli' as const,
    };
    await saveAuthConfig(payload);
    const loaded = await loadAuthConfig();
    expect(loaded).toEqual(payload);
  });
});

