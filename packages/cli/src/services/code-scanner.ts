import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { createHash } from 'crypto';
import type { CodeSchema, Model, Field } from '../types/index.js';
import { analyzeCodebaseWithAI } from './ai-code-analyzer.js';
import { Cache } from '../utils/cache.js';
import { ProgressIndicator } from '../utils/progress.js';
import chalk from 'chalk';

export interface ScanCodebaseOptions {
  useAI?: boolean;
  useOllama?: boolean;
  ollamaModel?: string;
  ollamaUrl?: string;
  serviceApiUrl?: string; // Service API URL for AI analysis (uses service-configured API keys)
  serviceApiKey?: string; // Service API key for authentication
  aiProvider?: 'puter' | 'openai' | 'deepseek'; // AI provider to use (default: puter)
  useCache?: boolean;
  showProgress?: boolean;
  excludePatterns?: string[];
}

// Global cache instance (disabled by default - scans are always fresh)
const cache = new Cache({ ttl: 3600000 }); // 1 hour TTL (not used when cache is disabled)

export async function scanCodebase(
  basePath: string, 
  options: ScanCodebaseOptions = {}
): Promise<CodeSchema> {
  const {
    useAI = false,
    useOllama = false,
    ollamaModel,
    ollamaUrl,
    serviceApiUrl,
    serviceApiKey,
    aiProvider = 'puter',
    useCache = false, // DISABLED BY DEFAULT - every scan is fresh
    showProgress = true,
    excludePatterns = []
  } = options;

  // Clear cache before each scan to ensure fresh results
  // This ensures that code changes are immediately reflected
  if (cache) {
    cache.clear();
  }

  // Generate cache key from path and options (for potential future use)
  // Include all options that affect the analysis result
  const cacheKey = useCache 
    ? (() => {
        // Hash sensitive values (service API URL) to avoid storing them in plain text
        const serviceUrlHash = serviceApiUrl 
          ? createHash('sha256').update(serviceApiUrl).digest('hex').substring(0, 8)
          : 'none';
        const serviceKeyHash = serviceApiKey
          ? createHash('sha256').update(serviceApiKey).digest('hex').substring(0, 8)
          : 'none';
        const ollamaUrlHash = ollamaUrl && ollamaUrl !== 'http://localhost:11434'
          ? createHash('sha256').update(ollamaUrl).digest('hex').substring(0, 8)
          : 'default';
        
        return `code-schema:${basePath}:${useAI}:${useOllama}:${ollamaModel || ''}:${serviceUrlHash}:${serviceKeyHash}:${ollamaUrlHash}`;
      })()
    : null;

  // Cache is disabled by default - always perform fresh scan
  // This ensures that code changes are immediately reflected in scan results

  const progress = showProgress ? new ProgressIndicator({ message: 'Scanning codebase...' }) : null;
  // Try AI-powered code analysis first if enabled (default behavior)
  if (useAI) {
    try {
      progress?.update(0, 'Running AI analysis...');
      const aiResult = await analyzeCodebaseWithAI(basePath, {
        useOllama,
        ollamaModel,
        ollamaUrl,
        serviceApiUrl: options.serviceApiUrl,
        serviceApiKey: options.serviceApiKey,
        aiProvider: options.aiProvider || 'puter'
      });
      
      if (aiResult && aiResult.models.length > 0) {
        progress?.complete(`Found ${aiResult.models.length} models via AI analysis`);
        
        // Cache the result
        if (useCache && cacheKey) {
          cache.set(cacheKey, aiResult);
        }
        
        return aiResult;
      }
      
      // If AI analysis returns empty, fall back to traditional scanners
      if (showProgress) {
        progress?.update(0, 'AI analysis found no schema, trying SQL/database files...');
        console.log(chalk.yellow('⚠️  AI analysis found no schema, falling back to traditional scanners...'));
      }
    } catch (error) {
      // Always fall back to traditional scanners if AI fails
      if (showProgress) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        progress?.update(0, 'AI analysis failed, trying SQL/database files...');
        console.log(chalk.yellow(`⚠️  AI analysis failed: ${errorMsg}`));
        if (errorMsg.includes('Unauthorized') || errorMsg.includes('401')) {
          console.log(chalk.gray('   💡 Connect to service with: devsync login'));
        } else if (errorMsg.includes('Service API')) {
          console.log(chalk.gray('   💡 Use local AI with: --use-ollama'));
        }
        console.log(chalk.gray('   Falling back to traditional schema file scanning...'));
      }
    }
  }

  progress?.update(0, 'Scanning for schema files...');
  // Look for Prisma schema first (most common)
  const prismaPath = join(basePath, 'prisma', 'schema.prisma');
  if (existsSync(prismaPath)) {
    progress?.update(1, 'Found Prisma schema, parsing...');
    const result = scanPrismaSchema(prismaPath);
    progress?.complete(`Found ${result.models.length} models in Prisma schema`);
    
    // Cache the result
    if (useCache && cacheKey) {
      cache.set(cacheKey, result);
    }
    
    return result;
  }

  // Look for Supabase migrations (most important after Prisma)
  progress?.update(1, 'Checking for Supabase migrations...');
  const supabaseResult = await scanSupabaseMigrations(basePath);
  if (supabaseResult) {
    progress?.complete(`Found ${supabaseResult.models.length} models in Supabase migrations`);
    
    if (useCache && cacheKey) {
      cache.set(cacheKey, supabaseResult);
    }
    
    return supabaseResult;
  }

  // Look for TypeORM entities
  progress?.update(2, 'Checking for TypeORM entities...');
  const typeormResult = await scanTypeORMEntities(basePath);
  if (typeormResult) {
    progress?.complete(`Found ${typeormResult.models.length} models in TypeORM entities`);
    
    // Cache the result
    if (useCache && cacheKey) {
      cache.set(cacheKey, typeormResult);
    }
    
    return typeormResult;
  }

  // Look for Kysely schemas
  progress?.update(3, 'Checking for Kysely schemas...');
  const kyselyResult = await scanKyselySchema(basePath);
  if (kyselyResult) {
    progress?.complete(`Found ${kyselyResult.models.length} models in Kysely schema`);
    
    // Cache the result
    if (useCache && cacheKey) {
      cache.set(cacheKey, kyselyResult);
    }
    
    return kyselyResult;
  }

  // Look for Sequelize models
  progress?.update(4, 'Checking for Sequelize models...');
  const sequelizeResult = await scanSequelizeModels(basePath);
  if (sequelizeResult) {
    progress?.complete(`Found ${sequelizeResult.models.length} models in Sequelize models`);
    
    // Cache the result
    if (useCache && cacheKey) {
      cache.set(cacheKey, sequelizeResult);
    }
    
    return sequelizeResult;
  }

  // Look for Drizzle schemas
  progress?.update(5, 'Checking for Drizzle schemas...');
  const drizzleResult = await scanDrizzleSchema(basePath);
  if (drizzleResult) {
    progress?.complete(`Found ${drizzleResult.models.length} models in Drizzle schema`);
    
    // Cache the result
    if (useCache && cacheKey) {
      cache.set(cacheKey, drizzleResult);
    }
    
    return drizzleResult;
  }

  // Look for Django models
  progress?.update(6, 'Checking for Django models...');
  const djangoResult = await scanDjangoModels(basePath);
  if (djangoResult) {
    progress?.complete(`Found ${djangoResult.models.length} models in Django models`);
    
    // Cache the result
    if (useCache && cacheKey) {
      cache.set(cacheKey, djangoResult);
    }
    
    return djangoResult;
  }

  // Look for SQLAlchemy models
  progress?.update(7, 'Checking for SQLAlchemy models...');
  const sqlalchemyResult = await scanSQLAlchemyModels(basePath);
  if (sqlalchemyResult) {
    progress?.complete(`Found ${sqlalchemyResult.models.length} models in SQLAlchemy models`);
    
    // Cache the result
    if (useCache && cacheKey) {
      cache.set(cacheKey, sqlalchemyResult);
    }
    
    return sqlalchemyResult;
  }

  // Look for raw SQL migrations
  progress?.update(8, 'Checking for raw SQL migrations...');
  const sqlResult = await scanSQLMigrations(basePath);
  if (sqlResult) {
    progress?.complete(`Found ${sqlResult.models.length} models in SQL migrations`);
    
    // Cache the result
    if (useCache && cacheKey) {
      cache.set(cacheKey, sqlResult);
    }
    
    return sqlResult;
  }

  // No schema files found - perform comprehensive codebase scan
  // Extract table names from all code patterns (SQL, ORM, query builders, etc.)
  progress?.update(9, 'No schema files found, scanning entire codebase for table references...');
  
  try {
    const comprehensiveResult = await scanCodebaseForTables(basePath, excludePatterns);
    if (comprehensiveResult && comprehensiveResult.models.length > 0) {
      progress?.complete(`Found ${comprehensiveResult.models.length} tables from codebase analysis`);
      
      // Don't cache - always fresh
      return comprehensiveResult;
    }
  } catch (error) {
    // If comprehensive scan fails, continue with error message
    console.warn(chalk.yellow(`⚠️  Comprehensive codebase scan failed: ${error instanceof Error ? error.message : String(error)}`));
  }

  // No schema found and comprehensive scan found nothing
  progress?.complete();
  throw new Error(
    `No schema file found. Looking for:\n` +
    `  - ${prismaPath}\n` +
    `  - Supabase migrations (supabase/migrations/*.sql)\n` +
    `  - TypeORM entities (*.entity.ts)\n` +
    `  - Kysely schemas (schema.ts)\n` +
    `  - Sequelize models (*.model.js/ts)\n` +
    `  - Drizzle schemas (schema.ts)\n` +
    `  - Django models (models.py)\n` +
    `  - SQLAlchemy models (*.py)\n` +
    `  - SQL migrations (*.sql)\n` +
    `\nCurrently supported: Prisma, Supabase, TypeORM, Kysely, Sequelize, Drizzle, Django, SQLAlchemy, Raw SQL\n` +
    `\n💡 AI analysis was attempted but found no schema. To use AI analysis:\n` +
    `   - Connect to service: devsync login\n` +
    `   - Or use local AI: --use-ollama\n` +
    `   - Or disable AI: --no-ai-analysis`
  );
}

function scanPrismaSchema(schemaPath: string): CodeSchema {
  try {
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    const models = parsePrismaSchema(schemaContent);
    
    return {
      models,
      type: 'prisma'
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse Prisma schema: ${error.message}`);
    }
    throw error;
  }
}

function parsePrismaSchema(content: string): Model[] {
  const models: Model[] = [];
  
  // Remove comments and normalize
  const cleanedContent = content
    .replace(/\/\/.*$/gm, '') // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

  // Find all model blocks
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let match;
  
  while ((match = modelRegex.exec(cleanedContent)) !== null) {
    const [, modelName, fieldsContent] = match;
    const fields = parsePrismaFields(fieldsContent.trim());
    
    models.push({
      name: modelName,
      fields
    });
  }

  return models;
}

function parsePrismaFields(content: string): Field[] {
  const fields: Field[] = [];
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  for (const line of lines) {
    // Skip relation fields (they start with @relation) or are only attributes
    if (line.includes('@relation') || line.startsWith('@')) continue;
    
    // Match field definition: fieldName fieldType [attributes]
    // More flexible regex to handle various Prisma types
    const fieldMatch = line.match(/^(\w+)\s+(\w+(?:\[\])?|String|Int|BigInt|Float|Decimal|Boolean|DateTime|Date|Json|Bytes|Unsupported)(\??)(\s+.*)?$/);
    
    if (fieldMatch) {
      const [, name, type, optional, attributes] = fieldMatch;
      
      const field: Field = {
        name,
        type: normalizePrismaType(type),
        nullable: optional === '?'
      };

      // Parse attributes if present
      if (attributes) {
        // Parse @default attribute
        const defaultMatch = attributes.match(/@default\((.*?)\)/);
        if (defaultMatch) {
          field.defaultValue = defaultMatch[1];
        }
        
        // Parse @id attribute
        if (attributes.includes('@id')) {
          field.constraints = [...(field.constraints || []), 'PRIMARY KEY'];
        }
        
        // Parse @unique attribute
        if (attributes.includes('@unique')) {
          field.constraints = [...(field.constraints || []), 'UNIQUE'];
        }
      }
      
      fields.push(field);
    }
  }

  return fields;
}

function normalizePrismaType(prismaType: string): string {
  const typeMap: Record<string, string> = {
    'String': 'text',
    'Int': 'integer',
    'BigInt': 'bigint',
    'Float': 'double precision',
    'Decimal': 'numeric',
    'Boolean': 'boolean',
    'DateTime': 'timestamp',
    'Date': 'date',
    'Json': 'jsonb',
    'Bytes': 'bytea',
    'String[]': 'text[]',
    'Int[]': 'integer[]'
  };

  // Check if it's an array type
  if (prismaType.endsWith('[]')) {
    const baseType = prismaType.slice(0, -2);
    return typeMap[baseType] ? `${typeMap[baseType]}[]` : prismaType.toLowerCase() + '[]';
  }

  return typeMap[prismaType] || prismaType.toLowerCase();
}

// ============================================================================
// TypeORM Entity Scanner
// ============================================================================

async function scanTypeORMEntities(basePath: string): Promise<CodeSchema | null> {
  // Look for common TypeORM entity file patterns
  const commonPaths = [
    join(basePath, 'src', 'entities'),
    join(basePath, 'src', 'entity'),
    join(basePath, 'entities'),
    join(basePath, 'entity'),
    join(basePath, 'src'),
  ];

  const entityFiles: string[] = [];

  // Find entity files
  for (const searchPath of commonPaths) {
    if (existsSync(searchPath)) {
      const files = findEntityFiles(searchPath);
      entityFiles.push(...files);
    }
  }

  if (entityFiles.length === 0) {
    return null;
  }

  const models: Model[] = [];

  for (const filePath of entityFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const entity = parseTypeORMEntity(content, filePath);
      if (entity) {
        models.push(entity);
      }
    } catch (error) {
      console.warn(`Failed to parse TypeORM entity ${filePath}:`, error);
    }
  }

  if (models.length === 0) {
    return null;
  }

  return {
    models,
    type: 'typeorm'
  };
}

function findEntityFiles(dir: string, files: string[] = []): string[] {
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        findEntityFiles(fullPath, files);
      } else if (stat.isFile()) {
        const ext = extname(entry);
        const name = basename(entry, ext);
        
        // Match TypeORM entity patterns: *.entity.ts, *.entity.js, Entity.ts, etc.
        if (
          (ext === '.ts' || ext === '.js') &&
          (entry.includes('.entity.') || name.toLowerCase().includes('entity'))
        ) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return files;
}

function parseTypeORMEntity(content: string, filePath: string): Model | null {
  // Remove comments
  const cleanedContent = content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Find @Entity() decorator and class name
  const entityMatch = cleanedContent.match(/@Entity\([^)]*\)\s*(?:export\s+)?class\s+(\w+)/);
  if (!entityMatch) {
    return null;
  }

  const className = entityMatch[1];
  const modelName = extractTableName(content, className);

  // Find all @Column() decorated properties
  const columnRegex = /@Column\([^)]*\)\s*(?:@\w+\([^)]*\)\s*)*(?:public\s+|private\s+|protected\s+)?(\w+)\s*[:=]\s*([^;]+)/g;
  const fields: Field[] = [];
  let match;

  while ((match = columnRegex.exec(content)) !== null) {
    const [, fieldName, typeDefinition] = match;
    const columnDecorator = extractColumnDecorator(match[0]);
    
    const field: Field = {
      name: fieldName,
      type: extractTypeORMType(typeDefinition, columnDecorator),
      nullable: isNullable(columnDecorator),
    };

    // Parse default value
    const defaultMatch = columnDecorator.match(/default:\s*([^,}]+)/);
    if (defaultMatch) {
      field.defaultValue = defaultMatch[1].trim().replace(/['"]/g, '');
    }

    // Parse primary key
    if (content.includes(`@Primary`) && match[0].includes('@Primary')) {
      field.constraints = [...(field.constraints || []), 'PRIMARY KEY'];
    }

    // Parse unique
    if (columnDecorator.includes('unique:') || content.includes(`@Index`) && match[0].includes('@Index')) {
      field.constraints = [...(field.constraints || []), 'UNIQUE'];
    }

    fields.push(field);
  }

  return {
    name: modelName,
    fields
  };
}

function extractTableName(content: string, className: string): string {
  // Look for @Entity('table_name') or use class name
  const tableNameMatch = content.match(/@Entity\(['"]([^'"]+)['"]\)/);
  if (tableNameMatch) {
    return tableNameMatch[1];
  }
  // Convert PascalCase to snake_case
  return className.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function extractColumnDecorator(fieldBlock: string): string {
  const decoratorMatch = fieldBlock.match(/@Column\(([^)]+)\)/);
  return decoratorMatch ? decoratorMatch[1] : '';
}

function extractTypeORMType(typeDefinition: string, columnDecorator: string): string {
  // First try to get type from @Column({ type: 'varchar' })
  const typeMatch = columnDecorator.match(/type:\s*['"]([^'"]+)['"]/);
  if (typeMatch) {
    return normalizeTypeORMType(typeMatch[1]);
  }

  // Otherwise, parse from TypeScript type
  const typeMap: Record<string, string> = {
    'string': 'text',
    'String': 'text',
    'number': 'integer',
    'Number': 'integer',
    'boolean': 'boolean',
    'Boolean': 'boolean',
    'Date': 'timestamp',
    'BigInt': 'bigint',
  };

  // Extract type from type definition
  const cleanType = typeDefinition.trim().split(/[|&<>]/)[0].trim();
  const baseType = cleanType.replace(/[\[\]?]/g, '');
  
  return normalizeTypeORMType(typeMap[baseType] || baseType.toLowerCase());
}

function normalizeTypeORMType(type: string): string {
  const typeMap: Record<string, string> = {
    'varchar': 'text',
    'char': 'text',
    'text': 'text',
    'int': 'integer',
    'integer': 'integer',
    'bigint': 'bigint',
    'float': 'double precision',
    'double': 'double precision',
    'decimal': 'numeric',
    'numeric': 'numeric',
    'boolean': 'boolean',
    'bool': 'boolean',
    'date': 'date',
    'datetime': 'timestamp',
    'timestamp': 'timestamp',
    'json': 'jsonb',
    'jsonb': 'jsonb',
  };

  return typeMap[type.toLowerCase()] || type.toLowerCase();
}

function isNullable(columnDecorator: string): boolean {
  // Default is nullable unless nullable: false is specified
  if (columnDecorator.includes('nullable:')) {
    return !columnDecorator.includes('nullable:\s*false');
  }
  return true;
}

// ============================================================================
// Sequelize Model Scanner
// ============================================================================

async function scanSequelizeModels(basePath: string): Promise<CodeSchema | null> {
  const commonPaths = [
    join(basePath, 'src', 'models'),
    join(basePath, 'models'),
    join(basePath, 'src'),
  ];

  const modelFiles: string[] = [];

  for (const searchPath of commonPaths) {
    if (existsSync(searchPath)) {
      const files = findModelFiles(searchPath);
      modelFiles.push(...files);
    }
  }

  if (modelFiles.length === 0) {
    return null;
  }

  const models: Model[] = [];

  for (const filePath of modelFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const model = parseSequelizeModel(content, filePath);
      if (model) {
        models.push(model);
      }
    } catch (error) {
      console.warn(`Failed to parse Sequelize model ${filePath}:`, error);
    }
  }

  if (models.length === 0) {
    return null;
  }

  return {
    models,
    type: 'typeorm' // Using typeorm type for now, could add sequelize
  };
}

function findModelFiles(dir: string, files: string[] = []): string[] {
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        findModelFiles(fullPath, files);
      } else if (stat.isFile()) {
        const ext = extname(entry);
        const name = basename(entry, ext);
        
        // Match Sequelize model patterns: *.model.js, *.model.ts, models/*.js
        if (
          (ext === '.ts' || ext === '.js') &&
          (entry.includes('.model.') || name.toLowerCase().includes('model'))
        ) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return files;
}

function parseSequelizeModel(content: string, filePath: string): Model | null {
  // Remove comments
  const cleanedContent = content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Look for Sequelize.define() or class extends Model
  const defineMatch = cleanedContent.match(/sequelize\.define\(['"]([^'"]+)['"]/i);
  const classMatch = cleanedContent.match(/class\s+(\w+)\s+extends\s+Model/i);

  if (!defineMatch && !classMatch) {
    return null;
  }

  const modelName = defineMatch ? defineMatch[1] : (classMatch ? classMatch[1] : 'Unknown');
  
  // Find fields definition
  const fieldsDefinition = extractSequelizeFields(content);
  const fields: Field[] = [];

  for (const [fieldName, fieldDef] of Object.entries(fieldsDefinition)) {
    const field: Field = {
      name: fieldName,
      type: normalizeSequelizeType(fieldDef.type || 'STRING'),
      nullable: fieldDef.allowNull !== false,
    };

    if (fieldDef.defaultValue !== undefined) {
      field.defaultValue = String(fieldDef.defaultValue);
    }

    if (fieldDef.primaryKey) {
      field.constraints = [...(field.constraints || []), 'PRIMARY KEY'];
    }

    if (fieldDef.unique) {
      field.constraints = [...(field.constraints || []), 'UNIQUE'];
    }

    fields.push(field);
  }

  return {
    name: modelName,
    fields
  };
}

function extractSequelizeFields(content: string): Record<string, any> {
  // Look for fields definition in sequelize.define() or static attributes
  const defineMatch = content.match(/define\([^,]+,\s*\{([\s\S]+?)\}\s*[,)]/);
  const attributesMatch = content.match(/(?:static\s+)?attributes:\s*\{([\s\S]+?)\}/);

  const fieldsBlock = defineMatch ? defineMatch[1] : (attributesMatch ? attributesMatch[1] : '{}');

  // Simple parser for field definitions
  const fields: Record<string, any> = {};
  const fieldRegex = /(\w+):\s*\{([^}]+)\}/g;
  let match;

  while ((match = fieldRegex.exec(fieldsBlock)) !== null) {
    const [, fieldName, fieldProps] = match;
    const props: any = {};

    // Parse common Sequelize field properties
    const typeMatch = fieldProps.match(/type:\s*Sequelize\.(\w+)/i);
    if (typeMatch) {
      props.type = typeMatch[1];
    }

    const allowNullMatch = fieldProps.match(/allowNull:\s*(true|false)/i);
    if (allowNullMatch) {
      props.allowNull = allowNullMatch[1].toLowerCase() === 'true';
    }

    const primaryKeyMatch = fieldProps.match(/primaryKey:\s*(true|false)/i);
    if (primaryKeyMatch) {
      props.primaryKey = primaryKeyMatch[1].toLowerCase() === 'true';
    }

    const uniqueMatch = fieldProps.match(/unique:\s*(true|false)/i);
    if (uniqueMatch) {
      props.unique = uniqueMatch[1].toLowerCase() === 'true';
    }

    const defaultValueMatch = fieldProps.match(/defaultValue:\s*([^,}]+)/);
    if (defaultValueMatch) {
      props.defaultValue = defaultValueMatch[1].trim().replace(/['"]/g, '');
    }

    fields[fieldName] = props;
  }

  return fields;
}

function normalizeSequelizeType(type: string): string {
  const typeMap: Record<string, string> = {
    'STRING': 'text',
    'TEXT': 'text',
    'CHAR': 'text',
    'INTEGER': 'integer',
    'INT': 'integer',
    'BIGINT': 'bigint',
    'FLOAT': 'double precision',
    'DOUBLE': 'double precision',
    'DECIMAL': 'numeric',
    'BOOLEAN': 'boolean',
    'DATE': 'timestamp',
    'DATEONLY': 'date',
    'JSON': 'jsonb',
    'JSONB': 'jsonb',
  };

  return typeMap[type.toUpperCase()] || type.toLowerCase();
}

// ============================================================================
// Drizzle ORM Schema Scanner
// ============================================================================

async function scanDrizzleSchema(basePath: string): Promise<CodeSchema | null> {
  const commonPaths = [
    join(basePath, 'src', 'db', 'schema.ts'),
    join(basePath, 'src', 'db', 'schema.ts'),
    join(basePath, 'src', 'schema.ts'),
    join(basePath, 'schema.ts'),
    join(basePath, 'drizzle', 'schema.ts'),
  ];

  for (const schemaPath of commonPaths) {
    if (existsSync(schemaPath)) {
      try {
        const content = readFileSync(schemaPath, 'utf-8');
        return parseDrizzleSchema(content);
      } catch (error) {
        console.warn(`Failed to parse Drizzle schema ${schemaPath}:`, error);
      }
    }
  }

  return null;
}

function parseDrizzleSchema(content: string): CodeSchema {
  // Remove comments
  const cleanedContent = content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Find all pgTable() or mysqlTable() definitions
  const tableRegex = /(?:pgTable|mysqlTable|sqliteTable)\(['"]([^'"]+)['"]/g;
  const models: Model[] = [];
  let match;

  while ((match = tableRegex.exec(cleanedContent)) !== null) {
    const tableName = match[1];
    // Extract table definition block
    const startPos = match.index;
    const endPos = findMatchingBrace(cleanedContent, startPos + match[0].length - 1);
    const tableBlock = cleanedContent.substring(startPos, endPos);

    const fields = parseDrizzleFields(tableBlock);
    models.push({
      name: tableName,
      fields
    });
  }

  return {
    models,
    type: 'typeorm' // Using typeorm type for now
  };
}

function parseDrizzleFields(tableBlock: string): Field[] {
  const fields: Field[] = [];

  // Drizzle uses column definitions like: columnName: type('column_type')
  // or columnName: serial('column_name'), etc.
  const columnRegex = /(\w+):\s*(?:serial|integer|text|varchar|boolean|timestamp|json)\(['"]?([^'")]+)?['"]?\)/g;
  let match;

  while ((match = columnRegex.exec(tableBlock)) !== null) {
    const [, fieldName, columnName] = match;
    const columnDef = match[0];

    const field: Field = {
      name: columnName || fieldName,
      type: extractDrizzleType(columnDef),
      nullable: !columnDef.includes('.notNull()'),
    };

    // Parse primary key
    if (columnDef.includes('.primaryKey()') || fieldName.toLowerCase().includes('id')) {
      field.constraints = [...(field.constraints || []), 'PRIMARY KEY'];
    }

    // Parse default
    const defaultMatch = columnDef.match(/\.default\(([^)]+)\)/);
    if (defaultMatch) {
      field.defaultValue = defaultMatch[1].trim().replace(/['"]/g, '');
    }

    fields.push(field);
  }

  return fields;
}

function extractDrizzleType(columnDef: string): string {
  const typeMap: Record<string, string> = {
    'serial': 'integer',
    'integer': 'integer',
    'bigint': 'bigint',
    'text': 'text',
    'varchar': 'text',
    'boolean': 'boolean',
    'timestamp': 'timestamp',
    'date': 'date',
    'json': 'jsonb',
  };

  for (const [drizzleType, pgType] of Object.entries(typeMap)) {
    if (columnDef.includes(`${drizzleType}(`)) {
      return pgType;
    }
  }

  return 'text';
}

function findMatchingBrace(content: string, startPos: number): number {
  let depth = 0;
  let pos = startPos;

  while (pos < content.length) {
    if (content[pos] === '{') depth++;
    if (content[pos] === '}') {
      depth--;
      if (depth === 0) return pos + 1;
    }
    pos++;
  }

  return content.length;
}

// ============================================================================
// Supabase Migration Scanner (Most Important!)
// ============================================================================

async function scanSupabaseMigrations(basePath: string): Promise<CodeSchema | null> {
  // Supabase migrations are in supabase/migrations/*.sql
  const supabaseMigrationsPath = join(basePath, 'supabase', 'migrations');
  
  if (!existsSync(supabaseMigrationsPath)) {
    return null;
  }

  const sqlFiles = findSQLFiles(supabaseMigrationsPath);
  
  if (sqlFiles.length === 0) {
    return null;
  }

  // Parse all Supabase SQL files and extract CREATE TABLE statements
  const allModels: Record<string, Model> = {};

  for (const filePath of sqlFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const models = parseSQLSchema(content);
      
      for (const model of models) {
        // Merge tables if they appear in multiple migrations
        if (allModels[model.name]) {
          const existingFields = new Map(allModels[model.name].fields.map(f => [f.name, f]));
          for (const field of model.fields) {
            existingFields.set(field.name, field);
          }
          allModels[model.name].fields = Array.from(existingFields.values());
        } else {
          allModels[model.name] = model;
        }
      }
    } catch (error) {
      console.warn(`Failed to parse Supabase migration ${filePath}:`, error);
    }
  }

  const models = Object.values(allModels);
  if (models.length === 0) {
    return null;
  }

  return {
    models,
    type: 'raw-sql' // Using raw-sql type for Supabase migrations
  };
}

// ============================================================================
// Kysely Schema Scanner
// ============================================================================

async function scanKyselySchema(basePath: string): Promise<CodeSchema | null> {
  const commonPaths = [
    join(basePath, 'src', 'db', 'schema.ts'),
    join(basePath, 'src', 'database', 'schema.ts'),
    join(basePath, 'src', 'db', 'tables.ts'),
    join(basePath, 'src', 'database', 'tables.ts'),
    join(basePath, 'src', 'schema.ts'),
    join(basePath, 'schema.ts'),
  ];

  const kyselyFiles: string[] = [];

  // Find Kysely schema files
  for (const searchPath of commonPaths) {
    if (existsSync(searchPath)) {
      kyselyFiles.push(searchPath);
    }
  }

  // Also search for files with Kysely table definitions
  const srcPath = join(basePath, 'src');
  if (existsSync(srcPath)) {
    const files = findKyselyFiles(srcPath);
    kyselyFiles.push(...files);
  }

  if (kyselyFiles.length === 0) {
    return null;
  }

  const models: Model[] = [];

  for (const filePath of kyselyFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const parsedModels = parseKyselySchema(content);
      models.push(...parsedModels);
    } catch (error) {
      console.warn(`Failed to parse Kysely schema ${filePath}:`, error);
    }
  }

  if (models.length === 0) {
    return null;
  }

  return {
    models,
    type: 'typeorm' // Using typeorm type for now
  };
}

function findKyselyFiles(dir: string, files: string[] = []): string[] {
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        findKyselyFiles(fullPath, files);
      } else if (stat.isFile()) {
        const ext = extname(entry);
        if ((ext === '.ts' || ext === '.js')) {
          // Check if file contains Kysely table definitions
          try {
            const content = readFileSync(fullPath, 'utf-8');
            if (content.includes('sql`') && (content.includes('CREATE TABLE') || content.includes('table('))) {
              files.push(fullPath);
            }
          } catch {
            // Ignore read errors
          }
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return files;
}

function parseKyselySchema(content: string): Model[] {
  const models: Model[] = [];

  // Remove comments
  const cleanedContent = content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // Kysely uses table definitions like: const users = sql`CREATE TABLE users (...)`
  // Or: export const users = table('users', { ... })
  
  // Method 1: Parse SQL template literals
  const sqlTableRegex = /(?:const|export\s+const)\s+(\w+)\s*=\s*sql`\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`]?(\w+)["`]?\.)?["`]?(\w+)["`]?\s*\(([^`]+)\)/gi;
  let match;

  while ((match = sqlTableRegex.exec(content)) !== null) {
    const [, variableName, schema, tableName, columnsBlock] = match;
    const fullTableName = schema ? `${schema}.${tableName}` : tableName;
    
    const fields = parseSQLColumns(columnsBlock);
    
    models.push({
      name: fullTableName,
      fields
    });
  }

  // Method 2: Parse table() function calls (object-based syntax)
  const tableFunctionRegex = /(?:const|export\s+const)\s+(\w+)\s*=\s*table\(['"]([^'"]+)['"]/g;
  let tableMatch;

  while ((tableMatch = tableFunctionRegex.exec(cleanedContent)) !== null) {
    const [, variableName, tableName] = tableMatch;
    // Extract table definition block
    const startPos = tableMatch.index;
    const endPos = findMatchingBrace(content, startPos + tableMatch[0].length - 1);
    const tableBlock = content.substring(startPos, endPos);
    
    const fields = parseKyselyFields(tableBlock);
    models.push({
      name: tableName,
      fields
    });
  }

  return models;
}

function parseKyselyFields(tableBlock: string): Field[] {
  const fields: Field[] = [];

  // Kysely uses column definitions like: columnName: type('column_type')
  // Similar to Drizzle
  const columnRegex = /(\w+):\s*(?:text|varchar|integer|bigint|boolean|timestamp|date|json|serial|uuid)\(['"]?([^'")]+)?['"]?\)/g;
  let match;

  while ((match = columnRegex.exec(tableBlock)) !== null) {
    const [, fieldName, columnName] = match;
    const columnDef = match[0];

    const field: Field = {
      name: columnName || fieldName,
      type: extractKyselyType(columnDef),
      nullable: !columnDef.includes('.notNull()'),
    };

    // Parse primary key
    if (columnDef.includes('.primaryKey()') || fieldName.toLowerCase().includes('id')) {
      field.constraints = [...(field.constraints || []), 'PRIMARY KEY'];
    }

    // Parse default
    const defaultMatch = columnDef.match(/\.default\(([^)]+)\)/);
    if (defaultMatch) {
      field.defaultValue = defaultMatch[1].trim().replace(/['"]/g, '');
    }

    fields.push(field);
  }

  return fields;
}

function extractKyselyType(columnDef: string): string {
  const typeMap: Record<string, string> = {
    'serial': 'integer',
    'integer': 'integer',
    'int': 'integer',
    'bigint': 'bigint',
    'text': 'text',
    'varchar': 'text',
    'string': 'text',
    'boolean': 'boolean',
    'bool': 'boolean',
    'timestamp': 'timestamp',
    'timestamptz': 'timestamp',
    'date': 'date',
    'json': 'jsonb',
    'jsonb': 'jsonb',
    'uuid': 'uuid',
  };

  for (const [kyselyType, pgType] of Object.entries(typeMap)) {
    if (columnDef.includes(`${kyselyType}(`)) {
      return pgType;
    }
  }

  return 'text';
}

// ============================================================================
// Django Models Scanner (Python)
// ============================================================================

async function scanDjangoModels(basePath: string): Promise<CodeSchema | null> {
  const commonPaths = [
    join(basePath, 'models.py'),
    join(basePath, 'app', 'models.py'),
    join(basePath, 'apps', '**', 'models.py'),
    join(basePath, 'src', '**', 'models.py'),
  ];

  const modelFiles: string[] = [];

  for (const pattern of commonPaths) {
    if (pattern.includes('**')) {
      // Recursive search
      const baseDir = pattern.split('**')[0].replace(/\/$/, '');
      if (existsSync(baseDir)) {
        const files = findPythonFiles(baseDir, 'models.py');
        modelFiles.push(...files);
      }
    } else if (existsSync(pattern)) {
      modelFiles.push(pattern);
    }
  }

  if (modelFiles.length === 0) {
    return null;
  }

  const models: Model[] = [];

  for (const filePath of modelFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const parsedModels = parseDjangoModels(content);
      models.push(...parsedModels);
    } catch (error) {
      console.warn(`Failed to parse Django models ${filePath}:`, error);
    }
  }

  if (models.length === 0) {
    return null;
  }

  return {
    models,
    type: 'raw-sql' // Using raw-sql type for Python models
  };
}

function findPythonFiles(dir: string, filename: string, files: string[] = []): string[] {
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        findPythonFiles(fullPath, filename, files);
      } else if (stat.isFile() && entry === filename) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return files;
}

function parseDjangoModels(content: string): Model[] {
  const models: Model[] = [];

  // Remove comments
  const cleanedContent = content
    .replace(/#.*$/gm, '')
    .replace(/""".*?"""/gs, '')
    .replace(/'''.*?'''/gs, '');

  // Find Django model classes: class ModelName(models.Model):
  const modelRegex = /class\s+(\w+)\s*\([^)]*models\.Model[^)]*\)\s*:/g;
  let match;

  while ((match = modelRegex.exec(cleanedContent)) !== null) {
    const className = match[1];
    const modelStart = match.index;
    
    // Find class body (indented block)
    const classBody = extractPythonClassBody(cleanedContent, modelStart);
    
    // Extract table name from Meta class or use model name
    const tableName = extractDjangoTableName(classBody, className);
    
    // Parse fields
    const fields = parseDjangoFields(classBody);
    
    models.push({
      name: tableName,
      fields
    });
  }

  return models;
}

function extractPythonClassBody(content: string, startPos: number): string {
  // Find the first line after class definition
  const lines = content.substring(startPos).split('\n');
  let classBody = '';
  let baseIndent = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (i === 0) {
      // First line is class definition, get its indent
      baseIndent = line.length - line.trimStart().length;
    } else {
      const indent = line.length - line.trimStart().length;
      
      // If line is less indented than class, we're done
      if (trimmed && indent <= baseIndent) {
        break;
      }
      
      classBody += line + '\n';
    }
  }
  
  return classBody;
}

function extractDjangoTableName(classBody: string, className: string): string {
  // Look for Meta class with db_table
  const metaMatch = classBody.match(/class\s+Meta\s*:[\s\S]*?db_table\s*=\s*['"]([^'"]+)['"]/);
  if (metaMatch) {
    return metaMatch[1];
  }
  
  // Convert CamelCase to snake_case
  return className.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function parseDjangoFields(classBody: string): Field[] {
  const fields: Field[] = [];

  // Django field patterns: field_name = models.FieldType(...)
  const fieldRegex = /(\w+)\s*=\s*models\.(\w+)\([^)]*\)/g;
  let match;

  while ((match = fieldRegex.exec(classBody)) !== null) {
    const [, fieldName, fieldType] = match;
    const fieldDef = match[0];
    
    const field: Field = {
      name: fieldName,
      type: normalizeDjangoType(fieldType),
      nullable: fieldDef.includes('null=True') || fieldDef.includes('blank=True'),
    };

    // Parse primary key
    if (fieldDef.includes('primary_key=True')) {
      field.constraints = [...(field.constraints || []), 'PRIMARY KEY'];
    }

    // Parse unique
    if (fieldDef.includes('unique=True')) {
      field.constraints = [...(field.constraints || []), 'UNIQUE'];
    }

    // Parse default
    const defaultMatch = fieldDef.match(/default\s*=\s*([^,)]+)/);
    if (defaultMatch) {
      field.defaultValue = defaultMatch[1].trim().replace(/['"]/g, '');
    }

    // Parse max_length for CharField
    const maxLengthMatch = fieldDef.match(/max_length\s*=\s*(\d+)/);
    if (maxLengthMatch && fieldType === 'CharField') {
      field.type = `varchar(${maxLengthMatch[1]})`;
    }

    fields.push(field);
  }

  return fields;
}

function normalizeDjangoType(fieldType: string): string {
  const typeMap: Record<string, string> = {
    'CharField': 'text',
    'TextField': 'text',
    'IntegerField': 'integer',
    'BigIntegerField': 'bigint',
    'SmallIntegerField': 'integer',
    'FloatField': 'double precision',
    'DecimalField': 'numeric',
    'BooleanField': 'boolean',
    'NullBooleanField': 'boolean',
    'DateField': 'date',
    'DateTimeField': 'timestamp',
    'TimeField': 'time',
    'EmailField': 'text',
    'URLField': 'text',
    'UUIDField': 'uuid',
    'JSONField': 'jsonb',
    'BinaryField': 'bytea',
  };

  return typeMap[fieldType] || 'text';
}

// ============================================================================
// SQLAlchemy Models Scanner (Python)
// ============================================================================

async function scanSQLAlchemyModels(basePath: string): Promise<CodeSchema | null> {
  const commonPaths = [
    join(basePath, 'models.py'),
    join(basePath, 'app', 'models.py'),
    join(basePath, 'src', 'models.py'),
    join(basePath, 'src', '**', '*.py'),
  ];

  const modelFiles: string[] = [];

  for (const pattern of commonPaths) {
    if (pattern.includes('**')) {
      const baseDir = pattern.split('**')[0].replace(/\/$/, '');
      if (existsSync(baseDir)) {
        const files = findSQLAlchemyFiles(baseDir);
        modelFiles.push(...files);
      }
    } else if (existsSync(pattern)) {
      modelFiles.push(pattern);
    }
  }

  if (modelFiles.length === 0) {
    return null;
  }

  const models: Model[] = [];

  for (const filePath of modelFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Check if file contains SQLAlchemy imports
      if (!content.includes('sqlalchemy') && !content.includes('SQLAlchemy')) {
        continue;
      }
      
      const parsedModels = parseSQLAlchemyModels(content);
      models.push(...parsedModels);
    } catch (error) {
      console.warn(`Failed to parse SQLAlchemy models ${filePath}:`, error);
    }
  }

  if (models.length === 0) {
    return null;
  }

  return {
    models,
    type: 'raw-sql' // Using raw-sql type for Python models
  };
}

function findSQLAlchemyFiles(dir: string, files: string[] = []): string[] {
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        findSQLAlchemyFiles(fullPath, files);
      } else if (stat.isFile() && extname(entry) === '.py') {
        // Check if file contains SQLAlchemy
        try {
          const content = readFileSync(fullPath, 'utf-8');
          if (content.includes('sqlalchemy') || content.includes('SQLAlchemy') || 
              content.includes('declarative_base') || content.includes('Column') ||
              content.includes('Base =')) {
            files.push(fullPath);
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return files;
}

function parseSQLAlchemyModels(content: string): Model[] {
  const models: Model[] = [];

  // Remove comments
  const cleanedContent = content
    .replace(/#.*$/gm, '')
    .replace(/""".*?"""/gs, '')
    .replace(/'''.*?'''/gs, '');

  // Find SQLAlchemy model classes: class ModelName(Base):
  const modelRegex = /class\s+(\w+)\s*\([^)]*Base[^)]*\)\s*:/g;
  let match;

  while ((match = modelRegex.exec(cleanedContent)) !== null) {
    const className = match[1];
    const modelStart = match.index;
    
    // Find class body
    const classBody = extractPythonClassBody(cleanedContent, modelStart);
    
    // Extract table name from __tablename__ or use class name
    const tableName = extractSQLAlchemyTableName(classBody, className);
    
    // Parse fields (Column definitions)
    const fields = parseSQLAlchemyFields(classBody);
    
    models.push({
      name: tableName,
      fields
    });
  }

  return models;
}

function extractSQLAlchemyTableName(classBody: string, className: string): string {
  // Look for __tablename__ = 'table_name'
  const tableNameMatch = classBody.match(/__tablename__\s*=\s*['"]([^'"]+)['"]/);
  if (tableNameMatch) {
    return tableNameMatch[1];
  }
  
  // Convert CamelCase to snake_case
  return className.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function parseSQLAlchemyFields(classBody: string): Field[] {
  const fields: Field[] = [];

  // SQLAlchemy field patterns: field_name = Column(ColumnType, ...)
  const fieldRegex = /(\w+)\s*=\s*Column\([^)]+\)/g;
  let match;

  while ((match = fieldRegex.exec(classBody)) !== null) {
    const fieldName = match[1];
    const fieldDef = match[0];
    
    // Extract column type
    const typeMatch = fieldDef.match(/Column\s*\(\s*([^,)]+)/);
    if (!typeMatch) continue;
    
    const columnType = typeMatch[1].trim();
    const normalizedType = normalizeSQLAlchemyType(columnType);
    
    const field: Field = {
      name: fieldName,
      type: normalizedType,
      nullable: !fieldDef.includes('nullable=False'),
    };

    // Parse primary key
    if (fieldDef.includes('primary_key=True')) {
      field.constraints = [...(field.constraints || []), 'PRIMARY KEY'];
    }

    // Parse unique
    if (fieldDef.includes('unique=True')) {
      field.constraints = [...(field.constraints || []), 'UNIQUE'];
    }

    // Parse default
    const defaultMatch = fieldDef.match(/default\s*=\s*([^,)]+)/);
    if (defaultMatch) {
      field.defaultValue = defaultMatch[1].trim().replace(/['"]/g, '');
    }

    fields.push(field);
  }

  return fields;
}

function normalizeSQLAlchemyType(columnType: string): string {
  // Remove module prefixes like String, Integer, etc.
  const cleanType = columnType.replace(/^(?:sqlalchemy\.|sa\.)?\w+\./, '').trim();
  
  const typeMap: Record<string, string> = {
    'String': 'text',
    'Text': 'text',
    'Unicode': 'text',
    'UnicodeText': 'text',
    'Integer': 'integer',
    'BigInteger': 'bigint',
    'SmallInteger': 'integer',
    'Float': 'double precision',
    'Numeric': 'numeric',
    'Decimal': 'numeric',
    'Boolean': 'boolean',
    'Bool': 'boolean',
    'Date': 'date',
    'DateTime': 'timestamp',
    'Time': 'time',
    'TIMESTAMP': 'timestamp',
    'JSON': 'jsonb',
    'JSONB': 'jsonb',
    'UUID': 'uuid',
    'LargeBinary': 'bytea',
  };

  // Check for String(length)
  const stringMatch = cleanType.match(/String\s*\(\s*(\d+)\s*\)/);
  if (stringMatch) {
    return `varchar(${stringMatch[1]})`;
  }

  return typeMap[cleanType] || 'text';
}

// ============================================================================
// Raw SQL Migration Scanner
// ============================================================================

async function scanSQLMigrations(basePath: string): Promise<CodeSchema | null> {
  const commonPaths = [
    join(basePath, 'migrations'),
    join(basePath, 'db', 'migrations'),
    join(basePath, 'supabase', 'migrations'),
    join(basePath, 'src', 'migrations'),
  ];

  const sqlFiles: string[] = [];

  for (const searchPath of commonPaths) {
    if (existsSync(searchPath)) {
      const files = findSQLFiles(searchPath);
      sqlFiles.push(...files);
    }
  }

  if (sqlFiles.length === 0) {
    return null;
  }

  // Parse all SQL files and extract CREATE TABLE statements
  const allModels: Record<string, Model> = {};

  for (const filePath of sqlFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const models = parseSQLSchema(content);
      
      for (const model of models) {
        // Merge tables if they appear in multiple migrations
        if (allModels[model.name]) {
          // Merge fields
          const existingFields = new Map(allModels[model.name].fields.map(f => [f.name, f]));
          for (const field of model.fields) {
            existingFields.set(field.name, field);
          }
          allModels[model.name].fields = Array.from(existingFields.values());
        } else {
          allModels[model.name] = model;
        }
      }
    } catch (error) {
      console.warn(`Failed to parse SQL file ${filePath}:`, error);
    }
  }

  const models = Object.values(allModels);
  if (models.length === 0) {
    return null;
  }

  return {
    models,
    type: 'raw-sql'
  };
}

function findSQLFiles(dir: string, files: string[] = []): string[] {
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        findSQLFiles(fullPath, files);
      } else if (stat.isFile() && extname(entry) === '.sql') {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return files;
}

function parseSQLSchema(content: string): Model[] {
  const models: Model[] = [];

  // Find CREATE TABLE statements
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`]?(\w+)["`]?\.)?["`]?(\w+)["`]?\s*\(([^)]+)\)/gi;
  let match;

  while ((match = createTableRegex.exec(content)) !== null) {
    const [, schema, tableName, columnsBlock] = match;
    const fullTableName = schema ? `${schema}.${tableName}` : tableName;

    const fields = parseSQLColumns(columnsBlock);
    
    models.push({
      name: fullTableName,
      fields
    });
  }

  return models;
}

function parseSQLColumns(columnsBlock: string): Field[] {
  const fields: Field[] = [];
  
  // Split by commas, but be careful with nested parentheses
  const columns = splitSQLColumns(columnsBlock);

  for (const column of columns) {
    const trimmed = column.trim();
    if (!trimmed || trimmed.startsWith('PRIMARY KEY') || trimmed.startsWith('FOREIGN KEY') || trimmed.startsWith('CONSTRAINT')) {
      continue;
    }

    const field = parseSQLColumn(trimmed);
    if (field) {
      fields.push(field);
    }
  }

  return fields;
}

function splitSQLColumns(block: string): string[] {
  const columns: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < block.length; i++) {
    const char = block[i];
    
    if (char === '(') depth++;
    if (char === ')') depth--;
    
    if (char === ',' && depth === 0) {
      if (current.trim()) {
        columns.push(current.trim());
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    columns.push(current.trim());
  }

  return columns;
}

function parseSQLColumn(columnDef: string): Field | null {
  // Match: column_name TYPE [CONSTRAINTS]
  const columnMatch = columnDef.match(/^["`]?(\w+)["`]?\s+(\w+(?:\s*\(\s*\d+\s*\))?)/i);
  if (!columnMatch) {
    return null;
  }

  const [, fieldName, typeWithSize] = columnMatch;
  const type = normalizeSQLType(typeWithSize);

  const field: Field = {
    name: fieldName,
    type,
    nullable: !columnDef.toUpperCase().includes('NOT NULL'),
  };

  // Parse default value
  const defaultMatch = columnDef.match(/DEFAULT\s+([^,\s]+)/i);
  if (defaultMatch) {
    field.defaultValue = defaultMatch[1].trim().replace(/['"]/g, '');
  }

  // Parse constraints
  if (columnDef.toUpperCase().includes('PRIMARY KEY')) {
    field.constraints = [...(field.constraints || []), 'PRIMARY KEY'];
  }

  if (columnDef.toUpperCase().includes('UNIQUE')) {
    field.constraints = [...(field.constraints || []), 'UNIQUE'];
  }

  return field;
}

function normalizeSQLType(type: string): string {
  const typeMap: Record<string, string> = {
    'varchar': 'text',
    'char': 'text',
    'character': 'text',
    'text': 'text',
    'int': 'integer',
    'integer': 'integer',
    'bigint': 'bigint',
    'smallint': 'integer',
    'float': 'double precision',
    'double': 'double precision',
    'decimal': 'numeric',
    'numeric': 'numeric',
    'boolean': 'boolean',
    'bool': 'boolean',
    'date': 'date',
    'timestamp': 'timestamp',
    'timestamptz': 'timestamp',
    'json': 'jsonb',
    'jsonb': 'jsonb',
  };

  // Remove size specification: VARCHAR(255) -> varchar
  const baseType = type.toLowerCase().split('(')[0].trim();
  return typeMap[baseType] || baseType;
}

// ============================================================================
// Comprehensive Codebase Scanner (Schema-less scanning)
// ============================================================================

/**
 * Comprehensive codebase scanner that extracts table names from all code patterns
 * Used when no schema files or database connection is available
 */
async function scanCodebaseForTables(
  basePath: string,
  excludePatterns: string[] = []
): Promise<CodeSchema> {
  const files = collectAllCodeFiles(basePath, excludePatterns);
  
  if (files.length === 0) {
    return { models: [], type: 'raw-sql' };
  }

  // Read file contents
  const fileContents = files.map(file => ({
    path: file,
    content: readFileSync(file, 'utf-8')
  }));

  // Use pattern matching to extract tables from all code patterns
  return extractTablesFromAllPatterns(fileContents);
}

/**
 * Extract table names and fields from code content
 */
function extractTablesFromCode(
  content: string,
  filePath: string,
  tableNames: Set<string>,
  tableFields: Map<string, Set<string>>,
  falsePositives: Set<string>
): void {
  // Comprehensive patterns for table extraction
  
  // 1. Supabase queries: .from('table_name')
  const supabasePattern = /\.from\(["']([a-z_][a-z0-9_]{2,})["']\)/gi;
  let match;
  while ((match = supabasePattern.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    if (!falsePositives.has(tableName) && tableName.length >= 3) {
      tableNames.add(tableName);
      if (!tableFields.has(tableName)) {
        tableFields.set(tableName, new Set());
      }
    }
  }
  
  // 2. SQL queries: FROM table_name, INSERT INTO table_name, UPDATE table_name
  const sqlPatterns = [
    /FROM\s+["']?([a-z_][a-z0-9_]{2,})["']?/gi,
    /INSERT\s+INTO\s+["']?([a-z_][a-z0-9_]{2,})["']?/gi,
    /UPDATE\s+["']?([a-z_][a-z0-9_]{2,})["']?/gi,
    /DELETE\s+FROM\s+["']?([a-z_][a-z0-9_]{2,})["']?/gi,
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([a-z_][a-z0-9_]{2,})["']?/gi,
    /ALTER\s+TABLE\s+["']?([a-z_][a-z0-9_]{2,})["']?/gi,
    /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?["']?([a-z_][a-z0-9_]{2,})["']?/gi,
    /TRUNCATE\s+TABLE\s+["']?([a-z_][a-z0-9_]{2,})["']?/gi
  ];
  
  for (const pattern of sqlPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const tableName = match[1].toLowerCase();
      if (!falsePositives.has(tableName) && tableName.length >= 3) {
        tableNames.add(tableName);
        if (!tableFields.has(tableName)) {
          tableFields.set(tableName, new Set());
        }
      }
    }
  }
  
  // 3. TypeORM: @Entity('table_name') or @Entity() with class name
  const typeormEntityPattern = /@Entity\(["']?([a-z_][a-z0-9_]{2,})["']?\)/gi;
  typeormEntityPattern.lastIndex = 0;
  while ((match = typeormEntityPattern.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    if (!falsePositives.has(tableName) && tableName.length >= 3) {
      tableNames.add(tableName);
      if (!tableFields.has(tableName)) {
        tableFields.set(tableName, new Set());
      }
    }
  }
  
  // 4. Prisma: model TableName { ... }
  const prismaModelPattern = /model\s+([A-Z][a-zA-Z0-9]{2,})\s*\{/g;
  prismaModelPattern.lastIndex = 0;
  while ((match = prismaModelPattern.exec(content)) !== null) {
    const modelName = match[1];
    // Convert PascalCase to snake_case
    const tableName = modelName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    if (!falsePositives.has(tableName) && tableName.length >= 3) {
      tableNames.add(tableName);
      if (!tableFields.has(tableName)) {
        tableFields.set(tableName, new Set());
      }
    }
  }
  
  // 5. Sequelize: sequelize.define('table_name', ...)
  const sequelizePattern = /sequelize\.define\(["']([a-z_][a-z0-9_]{2,})["']/gi;
  sequelizePattern.lastIndex = 0;
  while ((match = sequelizePattern.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    if (!falsePositives.has(tableName) && tableName.length >= 3) {
      tableNames.add(tableName);
      if (!tableFields.has(tableName)) {
        tableFields.set(tableName, new Set());
      }
    }
  }
  
  // 6. Drizzle/Kysely: table('table_name', ...) or pgTable('table_name', ...)
  const tableFunctionPattern = /(?:pgTable|mysqlTable|sqliteTable|table)\(["']([a-z_][a-z0-9_]{2,})["']/gi;
  tableFunctionPattern.lastIndex = 0;
  while ((match = tableFunctionPattern.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    if (!falsePositives.has(tableName) && tableName.length >= 3) {
      tableNames.add(tableName);
      if (!tableFields.has(tableName)) {
        tableFields.set(tableName, new Set());
      }
    }
  }
  
  // 7. Django: class ModelName(models.Model): with db_table
  const djangoModelPattern = /class\s+(\w+)\s*\([^)]*models\.Model[^)]*\)/g;
  djangoModelPattern.lastIndex = 0;
  while ((match = djangoModelPattern.exec(content)) !== null) {
    const className = match[1];
    // Look for db_table in Meta class
    const metaMatch = content.slice(match.index).match(/class\s+Meta\s*:[\s\S]*?db_table\s*=\s*["']([^"']+)["']/);
    const tableName = metaMatch 
      ? metaMatch[1].toLowerCase()
      : className.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    if (!falsePositives.has(tableName) && tableName.length >= 3) {
      tableNames.add(tableName);
      if (!tableFields.has(tableName)) {
        tableFields.set(tableName, new Set());
      }
    }
  }
  
  // 8. SQLAlchemy: __tablename__ = 'table_name'
  const sqlalchemyPattern = /__tablename__\s*=\s*["']([a-z_][a-z0-9_]{2,})["']/gi;
  sqlalchemyPattern.lastIndex = 0;
  while ((match = sqlalchemyPattern.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    if (!falsePositives.has(tableName) && tableName.length >= 3) {
      tableNames.add(tableName);
      if (!tableFields.has(tableName)) {
        tableFields.set(tableName, new Set());
      }
    }
  }
  
  // 9. Extract field names from context around table references
  // Look for .select(), .eq(), .insert(), .update() calls
  const fieldPatterns = [
    /\.select\(["']([a-z_][a-z0-9_]{1,})["']\)/gi,
    /\.eq\(["']([a-z_][a-z0-9_]{1,})["']/gi,
    /\.insert\([^)]*["']([a-z_][a-z0-9_]{1,})["']/gi,
    /\.update\([^)]*["']([a-z_][a-z0-9_]{1,})["']/gi,
    /SELECT\s+([a-z_][a-z0-9_]{1,})\s+FROM/gi,
    /INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/gi
  ];
  
  for (const pattern of fieldPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const fieldName = match[1].toLowerCase();
      if (!falsePositives.has(fieldName) && fieldName.length >= 2) {
        // Try to associate field with nearby table
        const context = content.slice(Math.max(0, match.index - 500), Math.min(content.length, match.index + 500));
        for (const tableName of tableNames) {
          if (context.includes(tableName)) {
            if (!tableFields.has(tableName)) {
              tableFields.set(tableName, new Set());
            }
            tableFields.get(tableName)!.add(fieldName);
          }
        }
      }
    }
  }
}

// ============================================================================
// Comprehensive Codebase Scanner (Schema-less scanning)
// ============================================================================

/**
 * Collect all code files for comprehensive scanning
 */
function collectAllCodeFiles(basePath: string, excludePatterns: string[] = []): string[] {
  const files: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.sql', '.prisma'];
  const excludeDirs = [
    'node_modules',
    '.next',
    'dist',
    'build',
    '.git',
    'coverage',
    'test',
    'tests',
    '__tests__',
    '.devsync',
    'cache',
    '.cache'
  ];

  function walkDir(dir: string, depth: number = 0, maxDepth: number = 10): void {
    if (depth > maxDepth) return;

    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        // Skip excluded directories
        if (excludeDirs.includes(entry)) {
          continue;
        }

        // Check exclude patterns
        if (excludePatterns.some(pattern => entry.includes(pattern))) {
          continue;
        }

        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walkDir(fullPath, depth + 1, maxDepth);
        } else if (stat.isFile()) {
          const ext = extname(entry);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  walkDir(basePath);
  return files;
}

/**
 * Extract table names from all code patterns (SQL, ORM, query builders, etc.)
 */
function extractTablesFromAllPatterns(
  files: Array<{ path: string; content: string }>
): CodeSchema {
  const tableMap = new Map<string, Set<string>>(); // table name -> set of field names
  const falsePositives = new Set([
    'react', 'typescript', 'javascript', 'types', 'type', 'import', 'export', 'from',
    'return', 'const', 'let', 'var', 'function', 'class', 'interface', 'enum',
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p',
    'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'id', 'key', 'value', 'data',
    'item', 'obj', 'arr', 'str', 'num', 'props', 'state', 'ref', 'ctx', 'req', 'res',
    'chalk', 'clsx', 'commander', 'next', 'path', 'tailwindcss', 'lucide', 'fs', 'os',
    'window', 'document', 'console', 'process', 'global', 'name', 'table', 'schema',
    'information_schema', 'pg_catalog', 'pg_toast'
  ]);

  // Comprehensive patterns for table extraction
  const patterns = [
    // Supabase/PostgREST queries
    /\.from\(["']([a-z_][a-z0-9_]{2,})["']\)/gi,
    /\.from\([`"]([a-z_][a-z0-9_]{2,})[`"]\)/gi,
    
    // SQL queries in strings
    /(?:SELECT|INSERT|UPDATE|DELETE|FROM|INTO|JOIN)\s+(?:["`]?([a-z_][a-z0-9_]{2,})["`]?|([a-z_][a-z0-9_]{2,}))/gi,
    /FROM\s+["`]?([a-z_][a-z0-9_]{2,})["`]?/gi,
    /INTO\s+["`]?([a-z_][a-z0-9_]{2,})["`]?/gi,
    /JOIN\s+["`]?([a-z_][a-z0-9_]{2,})["`]?/gi,
    /UPDATE\s+["`]?([a-z_][a-z0-9_]{2,})["`]?/gi,
    
    // CREATE TABLE statements
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`]?(\w+)["`]?\.)?["`]?([a-z_][a-z0-9_]{2,})["`]?/gi,
    
    // TypeORM
    /@Entity\(["']([a-z_][a-z0-9_]{2,})["']\)/gi,
    /repository\.(?:find|save|create|update|delete)\(/gi,
    
    // Prisma
    /prisma\.(\w+)\.(?:find|create|update|delete|upsert)/gi,
    /model\s+([A-Z][a-zA-Z0-9]{2,})\s*\{/g,
    
    // Sequelize
    /sequelize\.define\(["']([a-z_][a-z0-9_]{2,})["']/gi,
    /\.findAll\(\)|\.findOne\(\)|\.create\(\)|\.update\(\)|\.destroy\(\)/gi,
    
    // Kysely/Drizzle
    /table\(["']([a-z_][a-z0-9_]{2,})["']/gi,
    /pgTable\(["']([a-z_][a-z0-9_]{2,})["']/gi,
    /mysqlTable\(["']([a-z_][a-z0-9_]{2,})["']/gi,
    
    // Django ORM
    /\.objects\.(?:all|filter|get|create|update)\(/gi,
    /class\s+(\w+)\s*\([^)]*models\.Model/gi,
    
    // SQLAlchemy
    /__tablename__\s*=\s*["']([a-z_][a-z0-9_]{2,})["']/gi,
    /\.query\(\)|\.filter\(\)|\.get\(\)/gi,
    
    // Raw SQL in template literals
    /sql`[\s\S]*?FROM\s+["`]?([a-z_][a-z0-9_]{2,})["`]?/gi,
    /sql`[\s\S]*?INTO\s+["`]?([a-z_][a-z0-9_]{2,})["`]?/gi,
    
    // Query builder patterns
    /\.table\(["']([a-z_][a-z0-9_]{2,})["']\)/gi,
    /\.select\(\)\.from\(["']([a-z_][a-z0-9_]{2,})["']\)/gi,
    
    // Common ORM patterns
    /db\.(\w+)\./gi,
    /database\.(\w+)\./gi,
    /db\[["']([a-z_][a-z0-9_]{2,})["']\]/gi,
  ];

  // Extract tables from all files
  for (const file of files) {
    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(file.content)) !== null) {
        // Extract table name from match (could be in different capture groups)
        let tableName: string | null = null;
        for (let i = 1; i < match.length; i++) {
          if (match[i] && match[i].length >= 3) {
            tableName = match[i].toLowerCase();
            break;
          }
        }
        
        if (!tableName || falsePositives.has(tableName) || tableName.length < 3) {
          continue;
        }
        
        if (!tableMap.has(tableName)) {
          tableMap.set(tableName, new Set());
        }
        
        // Try to extract fields from context
        const context = file.content.slice(
          Math.max(0, match.index - 500),
          Math.min(file.content.length, match.index + 1000)
        );
        
        // Extract field names from various patterns
        const fieldPatterns = [
          /\.select\(["']([a-z_][a-z0-9_]{1,})["']\)/gi,
          /\.eq\(["']([a-z_][a-z0-9_]{1,})["']/gi,
          /\.insert\([^)]*["']([a-z_][a-z0-9_]{1,})["']/gi,
          /\.update\([^)]*["']([a-z_][a-z0-9_]{1,})["']/gi,
          /(\w+)\s*[:=]\s*[^,;\)]+/g, // Field assignments
        ];
        
        for (const fieldPattern of fieldPatterns) {
          let fieldMatch;
          fieldPattern.lastIndex = 0;
          while ((fieldMatch = fieldPattern.exec(context)) !== null) {
            const fieldName = fieldMatch[1]?.toLowerCase();
            if (fieldName && fieldName.length >= 2 && !falsePositives.has(fieldName)) {
              tableMap.get(tableName)?.add(fieldName);
            }
          }
        }
      }
    }
  }

  // Convert to models
  const models: Model[] = [];
  for (const [tableName, fields] of tableMap.entries()) {
    const fieldArray = Array.from(fields)
      .filter(f => f.length >= 2 && !falsePositives.has(f))
      .slice(0, 50); // Limit fields per table
    
    const modelFields: Field[] = fieldArray.length > 0
      ? fieldArray.map(fieldName => {
          const field: Field = {
            name: fieldName,
            type: inferFieldType(fieldName),
            nullable: true
          };
          // Add PRIMARY KEY constraint for id fields
          if (fieldName === 'id' || fieldName.endsWith('_id')) {
            field.constraints = ['PRIMARY KEY'];
          }
          return field;
        })
      : [
          { name: 'id', type: 'uuid', nullable: false, constraints: ['PRIMARY KEY'] },
          { name: 'created_at', type: 'timestamp', nullable: true }
        ];
    
    models.push({
      name: tableName,
      fields: modelFields
    });
  }

  // Deduplicate and sort
  const uniqueModels = new Map<string, Model>();
  for (const model of models) {
    if (!uniqueModels.has(model.name)) {
      uniqueModels.set(model.name, model);
    } else {
      // Merge fields from duplicate models
      const existing = uniqueModels.get(model.name)!;
      const existingFields = new Map(existing.fields.map(f => [f.name, f]));
      for (const field of model.fields) {
        if (!existingFields.has(field.name)) {
          existingFields.set(field.name, field);
        }
      }
      existing.fields = Array.from(existingFields.values());
    }
  }

  return {
    models: Array.from(uniqueModels.values()).sort((a, b) => a.name.localeCompare(b.name)),
    type: 'raw-sql'
  };
}

/**
 * Infer field type from field name
 */
function inferFieldType(fieldName: string): string {
  const lower = fieldName.toLowerCase();
  
  if (lower.includes('id') && (lower.endsWith('_id') || lower === 'id')) {
    return 'uuid';
  }
  if (lower.includes('email')) {
    return 'text';
  }
  if (lower.includes('created') || lower.includes('updated') || lower.includes('_at')) {
    return 'timestamp';
  }
  if (lower.includes('count') || lower.includes('num') || lower.includes('quantity')) {
    return 'integer';
  }
  if (lower.includes('price') || lower.includes('amount') || lower.includes('cost')) {
    return 'numeric';
  }
  if (lower.includes('is_') || lower.includes('has_') || lower.startsWith('is') || lower.startsWith('has')) {
    return 'boolean';
  }
  if (lower.includes('json') || lower.includes('data') || lower.includes('meta')) {
    return 'jsonb';
  }
  
  return 'text'; // Default
}

