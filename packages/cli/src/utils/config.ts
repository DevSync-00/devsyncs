import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import type { Config } from '../types/index.js';
import { validateConnectionString, validateApiUrl } from './validation.js';

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export async function loadConfig(configPath: string): Promise<Config | null> {
  const fullPath = resolve(configPath);
  
  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    const content = readFileSync(fullPath, 'utf-8');
    const config = JSON.parse(content) as Config;
    
    // Validate config
    const validation = validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
    }
    
    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load config: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate configuration object
 */
export function validateConfig(config: Config): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate version
  if (!config.version) {
    warnings.push('Config version not specified');
  }

  // Validate project
  if (!config.project) {
    errors.push('Project configuration is required');
  } else {
    if (!config.project.name) {
      errors.push('Project name is required');
    }
    if (!config.project.schemaType) {
      errors.push('Schema type is required');
    } else {
      const validSchemaTypes = ['prisma', 'supabase', 'typeorm', 'kysely', 'sequelize', 'drizzle', 'django', 'sqlalchemy', 'raw-sql'];
      if (!validSchemaTypes.includes(config.project.schemaType)) {
        errors.push(`Invalid schema type: ${config.project.schemaType}. Must be one of: ${validSchemaTypes.join(', ')}`);
      }
    }
  }

  // Validate database
  if (config.database) {
    if (config.database.connectionString) {
      const connValidation = validateConnectionString(config.database.connectionString);
      if (!connValidation.valid) {
        errors.push(...connValidation.errors.map(e => `Database: ${e}`));
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export async function saveConfig(configPath: string, config: Config): Promise<void> {
  const fullPath = resolve(configPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(config, null, 2), 'utf-8');
}


