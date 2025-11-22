import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import os from 'os';

export interface AuthConfig {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId: 'cli' | 'vscode';
}

const defaultConfigDir = join(os.homedir(), '.config', 'devsync');
const configPath = process.env.DEVSYNC_CONFIG_PATH ?? join(defaultConfigDir, 'config.json');

async function ensureDirExists() {
  await mkdir(dirname(configPath), { recursive: true });
}

export async function loadAuthConfig(): Promise<AuthConfig | null> {
  try {
    const raw = await readFile(configPath, 'utf-8');
    return JSON.parse(raw) as AuthConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function saveAuthConfig(config: AuthConfig) {
  await ensureDirExists();
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export async function clearAuthConfig() {
  try {
    await rm(configPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export const getConfigPath = () => configPath;

export const isTokenExpired = (auth: AuthConfig, skewSeconds = 30) => {
  const now = Math.floor(Date.now() / 1000);
  return now >= auth.expiresAt - skewSeconds;
};

