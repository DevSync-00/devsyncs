import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'dotenv';

/**
 * Connection String Detector
 * 
 * Detects database connection strings from:
 * 1. Environment variables
 * 2. .env files
 * 3. Config files (.devsync/config.json, etc.)
 * 4. Common framework config files
 * 
 * Priority order as specified in README:
 * 1. Detect database connection string → inspect live DB (read-only)
 * 2. Else, detect schema files (.sql, .prisma, migrations, etc.)
 * 3. Else, deeply scan the entire codebase to infer schema
 */

export interface DetectedConnection {
  connectionString: string;
  source: 'env' | '.env' | 'config' | 'prisma' | 'typeorm' | 'sequelize' | 'drizzle' | 'supabase';
  provider: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';
  isValid: boolean;
}

/**
 * Detect database connection string from various sources
 */
export function detectConnectionString(basePath: string): DetectedConnection | null {
  // 1. Check environment variables (highest priority)
  const envConnection = detectFromEnvironment();
  if (envConnection) {
    return envConnection;
  }

  // 2. Check .env files
  const envFileConnection = detectFromEnvFile(basePath);
  if (envFileConnection) {
    return envFileConnection;
  }

  // 3. Check config files
  const configConnection = detectFromConfig(basePath);
  if (configConnection) {
    return configConnection;
  }

  // 4. Check framework-specific config files
  const frameworkConnection = detectFromFrameworkConfig(basePath);
  if (frameworkConnection) {
    return frameworkConnection;
  }

  return null;
}

/**
 * Detect connection string from environment variables
 */
function detectFromEnvironment(): DetectedConnection | null {
  const envVars = [
    'DATABASE_URL',
    'DB_URL',
    'POSTGRES_URL',
    'POSTGRESQL_URL',
    'MYSQL_URL',
    'MARIADB_URL',
    'SQLITE_URL',
    'DATABASE_CONNECTION_STRING',
    'DB_CONNECTION_STRING',
    'SUPABASE_DB_URL',
    'NEON_DATABASE_URL',
    'TURSO_DATABASE_URL',
    'PLANETSCALE_DATABASE_URL'
  ];

  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value && isValidConnectionString(value)) {
      return {
        connectionString: value,
        source: 'env',
        provider: detectProvider(value),
        isValid: true
      };
    }
  }

  return null;
}

/**
 * Detect connection string from .env files
 */
function detectFromEnvFile(basePath: string): DetectedConnection | null {
  const envFiles = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test'
  ];

  for (const envFile of envFiles) {
    const envPath = join(basePath, envFile);
    if (existsSync(envPath)) {
      try {
        const envContent = readFileSync(envPath, 'utf-8');
        const envVars = parse(envContent);

        const envVarNames = [
          'DATABASE_URL',
          'DB_URL',
          'POSTGRES_URL',
          'POSTGRESQL_URL',
          'MYSQL_URL',
          'MARIADB_URL',
          'SQLITE_URL',
          'DATABASE_CONNECTION_STRING',
          'DB_CONNECTION_STRING',
          'SUPABASE_DB_URL',
          'NEON_DATABASE_URL'
        ];

        for (const envVar of envVarNames) {
          const value = envVars[envVar];
          if (value && isValidConnectionString(value)) {
            return {
              connectionString: value,
              source: '.env',
              provider: detectProvider(value),
              isValid: true
            };
          }
        }
      } catch (error) {
        // Ignore errors reading .env files
      }
    }
  }

  return null;
}

/**
 * Detect connection string from DevSync config
 */
function detectFromConfig(basePath: string): DetectedConnection | null {
  const configPaths = [
    join(basePath, '.devsync', 'config.json'),
    join(basePath, 'devsync.config.json'),
    join(basePath, '.devsync.json')
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const configContent = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);

        if (config.database?.connectionString) {
          const connStr = config.database.connectionString;
          if (isValidConnectionString(connStr)) {
            return {
              connectionString: connStr,
              source: 'config',
              provider: detectProvider(connStr),
              isValid: true
            };
          }
        }
      } catch (error) {
        // Ignore errors reading config files
      }
    }
  }

  return null;
}

/**
 * Detect connection string from framework-specific config files
 */
function detectFromFrameworkConfig(basePath: string): DetectedConnection | null {
  // 1. Prisma schema
  const prismaPath = join(basePath, 'prisma', 'schema.prisma');
  if (existsSync(prismaPath)) {
    const prismaConnection = detectFromPrisma(prismaPath);
    if (prismaConnection) {
      return prismaConnection;
    }
  }

  // 2. TypeORM config
  const typeormConnection = detectFromTypeORM(basePath);
  if (typeormConnection) {
    return typeormConnection;
  }

  // 3. Sequelize config
  const sequelizeConnection = detectFromSequelize(basePath);
  if (sequelizeConnection) {
    return sequelizeConnection;
  }

  // 4. Drizzle config
  const drizzleConnection = detectFromDrizzle(basePath);
  if (drizzleConnection) {
    return drizzleConnection;
  }

  // 5. Supabase config
  const supabaseConnection = detectFromSupabase(basePath);
  if (supabaseConnection) {
    return supabaseConnection;
  }

  return null;
}

/**
 * Detect connection string from Prisma schema
 */
function detectFromPrisma(prismaPath: string): DetectedConnection | null {
  try {
    const content = readFileSync(prismaPath, 'utf-8');
    
    // Look for datasource db { url = env("DATABASE_URL") }
    const urlMatch = content.match(/datasource\s+\w+\s*\{[^}]*url\s*=\s*(?:env\(["']([^"']+)["']\)|["']([^"']+)["'])/i);
    if (urlMatch) {
      const envVar = urlMatch[1];
      if (envVar) {
        const value = process.env[envVar];
        if (value && isValidConnectionString(value)) {
          return {
            connectionString: value,
            source: 'prisma',
            provider: detectProvider(value),
            isValid: true
          };
        }
      } else if (urlMatch[2]) {
        const value = urlMatch[2];
        if (isValidConnectionString(value)) {
          return {
            connectionString: value,
            source: 'prisma',
            provider: detectProvider(value),
            isValid: true
          };
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return null;
}

/**
 * Detect connection string from TypeORM config
 */
function detectFromTypeORM(basePath: string): DetectedConnection | null {
  const configPaths = [
    join(basePath, 'ormconfig.json'),
    join(basePath, 'ormconfig.js'),
    join(basePath, 'ormconfig.ts'),
    join(basePath, 'src', 'ormconfig.json'),
    join(basePath, 'src', 'ormconfig.js'),
    join(basePath, 'src', 'ormconfig.ts')
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        
        // Try to parse as JSON first
        try {
          const config = JSON.parse(content);
          if (config.url && isValidConnectionString(config.url)) {
            return {
              connectionString: config.url,
              source: 'typeorm',
              provider: detectProvider(config.url),
              isValid: true
            };
          }
        } catch {
          // Not JSON, try to extract from JS/TS
          const urlMatch = content.match(/url:\s*["']([^"']+)["']/i);
          if (urlMatch && isValidConnectionString(urlMatch[1])) {
            return {
              connectionString: urlMatch[1],
              source: 'typeorm',
              provider: detectProvider(urlMatch[1]),
              isValid: true
            };
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }
  }

  return null;
}

/**
 * Detect connection string from Sequelize config
 */
function detectFromSequelize(basePath: string): DetectedConnection | null {
  const configPaths = [
    join(basePath, 'config', 'database.js'),
    join(basePath, 'config', 'database.ts'),
    join(basePath, 'config', 'config.json')
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        
        // Try to extract connection string
        const urlMatch = content.match(/(?:url|uri|connectionString):\s*["']([^"']+)["']/i);
        if (urlMatch && isValidConnectionString(urlMatch[1])) {
          return {
            connectionString: urlMatch[1],
            source: 'sequelize',
            provider: detectProvider(urlMatch[1]),
            isValid: true
          };
        }
      } catch (error) {
        // Ignore errors
      }
    }
  }

  return null;
}

/**
 * Detect connection string from Drizzle config
 */
function detectFromDrizzle(basePath: string): DetectedConnection | null {
  const configPaths = [
    join(basePath, 'drizzle.config.ts'),
    join(basePath, 'drizzle.config.js'),
    join(basePath, 'src', 'db', 'index.ts'),
    join(basePath, 'src', 'db', 'index.js')
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        
        // Look for connection string in Drizzle config
        const urlMatch = content.match(/(?:connectionString|url):\s*["']([^"']+)["']/i);
        if (urlMatch && isValidConnectionString(urlMatch[1])) {
          return {
            connectionString: urlMatch[1],
            source: 'drizzle',
            provider: detectProvider(urlMatch[1]),
            isValid: true
          };
        }
      } catch (error) {
        // Ignore errors
      }
    }
  }

  return null;
}

/**
 * Detect connection string from Supabase config
 */
function detectFromSupabase(basePath: string): DetectedConnection | null {
  const configPaths = [
    join(basePath, 'supabase', 'config.toml'),
    join(basePath, '.supabase', 'config.toml')
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        
        // Look for db_url in Supabase config
        const urlMatch = content.match(/db_url\s*=\s*["']([^"']+)["']/i);
        if (urlMatch && isValidConnectionString(urlMatch[1])) {
          return {
            connectionString: urlMatch[1],
            source: 'supabase',
            provider: 'postgresql',
            isValid: true
          };
        }
      } catch (error) {
        // Ignore errors
      }
    }
  }

  return null;
}

/**
 * Validate connection string format
 */
function isValidConnectionString(connStr: string): boolean {
  if (!connStr || typeof connStr !== 'string') {
    return false;
  }

  const trimmed = connStr.trim();
  if (trimmed.length === 0) {
    return false;
  }

  // Check for common database URL patterns
  const patterns = [
    /^postgresql:\/\//i,
    /^postgres:\/\//i,
    /^mysql:\/\//i,
    /^mariadb:\/\//i,
    /^sqlite:\/\//i,
    /^mongodb:\/\//i,
    /^mongodb\+srv:\/\//i,
    /^file:/i
  ];

  return patterns.some(pattern => pattern.test(trimmed));
}

/**
 * Detect database provider from connection string
 */
function detectProvider(connStr: string): 'postgresql' | 'mysql' | 'sqlite' | 'mongodb' {
  const lower = connStr.toLowerCase();
  
  if (lower.startsWith('postgresql://') || lower.startsWith('postgres://')) {
    return 'postgresql';
  }
  if (lower.startsWith('mysql://') || lower.startsWith('mariadb://')) {
    return 'mysql';
  }
  if (lower.startsWith('sqlite://') || lower.startsWith('file:')) {
    return 'sqlite';
  }
  if (lower.startsWith('mongodb://') || lower.startsWith('mongodb+srv://')) {
    return 'mongodb';
  }
  
  // Default to PostgreSQL
  return 'postgresql';
}
