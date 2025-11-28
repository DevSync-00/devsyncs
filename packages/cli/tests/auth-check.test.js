import test from 'node:test';
import assert from 'node:assert/strict';

import {
  requireAuthenticatedCli,
  __setAuthCheckDeps,
  __resetAuthCheckDeps,
} from '../dist/lib/auth-check.js';

const fakeChalk = {
  red: (msg) => msg,
  gray: (msg) => msg,
  green: (msg) => msg,
};

const silentEnv = () => {
  const original = process.env.DEVSYNC_SILENT;
  process.env.DEVSYNC_SILENT = '1';
  return () => {
    process.env.DEVSYNC_SILENT = original;
  };
};

const withDeps = async (overrides, fn) => {
  __setAuthCheckDeps({ chalk: fakeChalk, ...overrides });
  try {
    return await fn();
  } finally {
    __resetAuthCheckDeps();
  }
};

test('requireAuthenticatedCli returns existing session when token is still valid', async () => {
  const restoreEnv = silentEnv();
  const auth = {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    clientId: 'cli',
  };

  try {
    const result = await withDeps(
      {
        loadAuthConfig: async () => auth,
        saveAuthConfig: async () => {
          throw new Error('save should not be called');
        },
        isTokenExpired: () => false,
      },
      () => requireAuthenticatedCli()
    );
    assert.equal(result, auth);
  } finally {
    restoreEnv();
  }
});

test('requireAuthenticatedCli refreshes expired tokens and saves them', async () => {
  const restoreEnv = silentEnv();
  let savedPayload = null;

  try {
    const refreshed = await withDeps(
      {
        loadAuthConfig: async () => ({
          accessToken: 'old-access',
          refreshToken: 'old-refresh',
          expiresAt: 10,
          clientId: 'cli',
        }),
        saveAuthConfig: async (payload) => {
          savedPayload = payload;
        },
        isTokenExpired: () => true,
        AnalyzerApiClient: class {
          async refreshTokens() {
            return {
              access_token: 'new-access',
              refresh_token: 'new-refresh',
              client_id: 'cli',
            };
          }
        },
        deriveExpiryFromToken: () => 999,
      },
      () => requireAuthenticatedCli()
    );

    assert.equal(refreshed.accessToken, 'new-access');
    assert.equal(refreshed.refreshToken, 'new-refresh');
    assert.equal(refreshed.expiresAt, 999);
    assert.deepEqual(savedPayload, refreshed);
  } finally {
    restoreEnv();
  }
});

test('requireAuthenticatedCli exits when no session is present', async () => {
  const restoreEnv = silentEnv();
  const originalExit = process.exit;
  let exitCode = null;

  process.exit = (code) => {
    exitCode = code;
    throw new Error(`exit:${code}`);
  };

  try {
    await assert.rejects(
      () =>
        withDeps(
          {
            loadAuthConfig: async () => null,
            saveAuthConfig: async () => {},
            isTokenExpired: () => true,
            AnalyzerApiClient: class {},
            deriveExpiryFromToken: () => 0,
          },
          () => requireAuthenticatedCli()
        ),
      /exit:1/
    );
    assert.equal(exitCode, 1);
  } finally {
    process.exit = originalExit;
    restoreEnv();
  }
});

