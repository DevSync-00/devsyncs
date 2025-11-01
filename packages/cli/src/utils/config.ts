import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Config } from '../types/index.js';

export async function loadConfig(configPath: string): Promise<Config | null> {
  const fullPath = join(process.cwd(), configPath);
  
  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content) as Config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load config: ${error.message}`);
    }
    throw error;
  }
}

