import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';
import type { CodeSchema, Model, Field } from '../types/index.js';

/**
 * AI-powered code analyzer that reads through project files
 * and infers the expected database schema based on code patterns
 */
export async function analyzeCodebaseWithAI(
  basePath: string,
  options?: { openaiApiKey?: string; useOllama?: boolean; ollamaModel?: string; ollamaUrl?: string }
): Promise<CodeSchema | null> {
  // Collect all relevant code files
  const codeFiles = collectCodeFiles(basePath);
  
  if (codeFiles.length === 0) {
    return null;
  }

  // Read file contents
  const fileContents = codeFiles.map(file => ({
    path: file,
    content: readFileSync(file, 'utf-8')
  }));

  // Prefer Ollama if enabled (free and local)
  if (options?.useOllama) {
    const ollamaUrl = options.ollamaUrl || 'http://localhost:11434';
    const model = options.ollamaModel || 'llama3.2:3b';
    console.log(`🤖 Using Ollama (local, free): ${model}`);
    const schemaAnalysis = await analyzeWithOllama(ollamaUrl, model, fileContents, basePath);
    return schemaAnalysis;
  }

  // Fallback to OpenAI if API key provided
  if (options?.openaiApiKey) {
    const schemaAnalysis = await analyzeWithAI(options.openaiApiKey, fileContents, basePath);
    return schemaAnalysis;
  }

  // If neither provided, use pattern matching
  console.warn('⚠️  No AI service configured, using pattern matching');
  return analyzeWithPatterns(fileContents);
}

/**
 * Collect all relevant code files for analysis
 */
function collectCodeFiles(basePath: string, maxDepth: number = 4): string[] {
  const files: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
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
    '.devsync'
  ];

  function walkDir(dir: string, depth: number): void {
    if (depth > maxDepth) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        // Skip excluded directories
        if (entry.isDirectory()) {
          if (!excludeDirs.some(excluded => entry.name.includes(excluded))) {
            walkDir(fullPath, depth + 1);
          }
          continue;
        }

        // Collect relevant files
        if (extensions.includes(extname(entry.name))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  // Start from apps/ and packages/ directories
  const targetDirs = [
    join(basePath, 'apps'),
    join(basePath, 'packages'),
    join(basePath, 'lib'),
    join(basePath, 'src')
  ].filter(dir => existsSync(dir));

  if (targetDirs.length === 0) {
    // Fallback: scan entire basePath
    walkDir(basePath, 0);
  } else {
    targetDirs.forEach(dir => walkDir(dir, 0));
  }

  // Limit to reasonable number of files for AI analysis
  return files.slice(0, 100);
}

/**
 * Analyze code files with AI to infer database schema
 */
async function analyzeWithAI(
  openaiApiKey: string,
  files: Array<{ path: string; content: string }>,
  basePath: string
): Promise<CodeSchema> {
  // Prepare prompt for AI
  const prompt = buildAnalysisPrompt(files, basePath);

  try {
    // Call OpenAI API directly
    const response = await callOpenAI(openaiApiKey, prompt);

    // Parse AI response to extract schema
    const inferredSchema = parseAISchemaResponse(response);

    // Check if we got valid results
    if (!inferredSchema || inferredSchema.models.length === 0) {
      console.warn('⚠️  AI analysis returned no results, using pattern matching fallback');
      return analyzeWithPatterns(files);
    }

    return inferredSchema;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  AI analysis failed: ${errorMessage}`);
    console.warn('⚠️  Using pattern matching fallback');
    // Fallback: use pattern matching if AI fails
    return analyzeWithPatterns(files);
  }
}

/**
 * Analyze code with Ollama (local, free)
 */
async function analyzeWithOllama(
  ollamaUrl: string,
  model: string,
  files: Array<{ path: string; content: string }>,
  basePath: string
): Promise<CodeSchema> {
  const prompt = buildAnalysisPrompt(files, basePath);

  try {
    // Check if Ollama is available
    const healthCheck = await fetch(`${ollamaUrl}/api/tags`).catch(() => null);
    if (!healthCheck || !healthCheck.ok) {
      throw new Error(`Ollama not available at ${ollamaUrl}. Make sure Ollama is installed and running.`);
    }

    // Call Ollama API
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: `You are an expert database schema analyzer. Analyze code files and infer the expected database schema. Return only valid JSON.

${prompt}

Return only the JSON object, no markdown, no code blocks, just pure JSON:`,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 4000
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama API error: ${errorText}`);
    }

    const data: any = await response.json();
    const aiResponse = data.response || '';

    // Parse AI response
    const inferredSchema = parseAISchemaResponse(aiResponse);

    // Check if we got valid results
    if (!inferredSchema || inferredSchema.models.length === 0) {
      console.warn('⚠️  Ollama analysis returned no results, using pattern matching fallback');
      return analyzeWithPatterns(files);
    }

    return inferredSchema;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Ollama analysis failed: ${errorMessage}`);
    console.warn('⚠️  Using pattern matching fallback');
    return analyzeWithPatterns(files);
  }
}

/**
 * Call OpenAI API to analyze code
 */
async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert database schema analyzer. Analyze code files and infer the expected database schema. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    const errorData: any = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(`OpenAI API error: ${errorData?.error?.message || response.statusText}`);
  }

  const data: any = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Build prompt for AI code analysis
 */
function buildAnalysisPrompt(
  files: Array<{ path: string; content: string }>,
  basePath: string
): string {
  const fileSummaries = files.slice(0, 50).map((file, index) => {
    const relativePath = file.path.replace(basePath, '').replace(/^[\/\\]/, '');
    // Truncate content for prompt
    const preview = file.content.slice(0, 2000);
    return `File ${index + 1}: ${relativePath}\n\`\`\`\n${preview}\n\`\`\``;
  }).join('\n\n');

  return `Analyze this codebase and infer the expected database schema.

Focus on:
1. Database queries (SELECT, INSERT, UPDATE, DELETE)
2. ORM model definitions (Prisma, TypeORM, Sequelize, etc.)
3. Table references in code
4. Field access patterns (model.field)
5. Type definitions that indicate database structure

Code files:
${fileSummaries}

Return a JSON object with this structure:
{
  "models": [
    {
      "name": "table_name",
      "fields": [
        {
          "name": "field_name",
          "type": "postgresql_type",
          "nullable": true/false,
          "primaryKey": true/false
        }
      ]
    }
  ]
}

Only include tables that are clearly referenced or defined in the code.`;
}

/**
 * Parse AI response to extract schema
 */
function parseAISchemaResponse(aiResponse: string): CodeSchema {
  try {
    // Try to extract JSON from AI response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Convert to CodeSchema format
      const models: Model[] = parsed.models?.map((m: any) => ({
        name: m.name,
        fields: m.fields?.map((f: any) => ({
          name: f.name,
          type: mapTypeToPostgres(f.type),
          nullable: f.nullable ?? true,
          primaryKey: f.primaryKey ?? false
        })) || []
      })) || [];

      if (models.length > 0) {
        return {
          models,
          type: 'raw-sql' // Using raw-sql as generic type for AI-inferred schema
        };
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Failed to parse AI response: ${errorMessage}`);
    // Return empty schema to trigger fallback
  }

  return {
    models: [],
    type: 'raw-sql'
  };
}

/**
 * Fallback: Analyze code patterns to infer schema
 */
function analyzeWithPatterns(
  files: Array<{ path: string; content: string }>
): CodeSchema {
  const models: Model[] = [];
  const tablePatterns = new Map<string, Set<string>>();

  // Common false positives to exclude (npm packages, keywords, etc.)
  const falsePositives = new Set([
    // Language keywords
    'react', 'typescript', 'javascript', 'types', 'type',
    'import', 'export', 'from', 'return', 'const', 'let', 'var',
    'function', 'class', 'interface', 'enum', 'namespace', 'module',
    // Single letters
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    // Common variable names
    'id', 'key', 'value', 'data', 'item', 'obj', 'arr', 'str', 'num',
    'props', 'state', 'ref', 'ctx', 'req', 'res', 'env', 'url', 'api',
    // Popular npm packages (likely from import statements)
    'chalk', 'clsx', 'commander', 'next', 'path', 'tailwindcss', 'lucide',
    'fs', 'os', 'util', 'http', 'https', 'url', 'stream',
    'express', 'lodash', 'axios', 'moment', 'date-fns',
    // Common Node.js/browser APIs
    'window', 'document', 'console', 'process', 'global',
    // Field-like words from code patterns
    'name', 'table', 'table_name', 'tablename',
    // Common words found in code comments/documentation
    'cwd', 'dashboard', 'detected', 'information_schema', 'mismatches', 'schema', 'the',
    // Database system schemas
    'information_schema', 'pg_catalog', 'pg_toast'
  ]);

  // Patterns to detect tables and fields (more specific - only actual database queries)
  const patterns = [
    // Supabase queries - most reliable (match .from() preceded by supabase variable)
    // Pattern: supabase variable (any identifier) followed by .from('table')
    /(?:await\s+)?(?:const\s+\w+\s*=\s*)?\w*supabase\w*[^;]*?\.from\(["']([a-z_][a-z0-9_]{2,})["']\)/gi,  // supabase.from('table_name')
    // Also match direct .from() calls (when supabase context is clear)
    /\.from\(["']([a-z_][a-z0-9_]{2,})["']\)/gi,  // .from('table_name') - fallback
    // SQL queries (in string literals or template literals)
    /(?:sql|query|db|database)[\s\S]{0,200}FROM\s+["']?([a-z_][a-z0-9_]{2,})["']?/gi,  // ...FROM 'table_name'
    /(?:sql|query|db|database)[\s\S]{0,200}INSERT\s+INTO\s+["']?([a-z_][a-z0-9_]{2,})["']?/gi,  // ...INSERT INTO 'table_name'
    // TypeORM entities
    /@Entity\(["']([a-z_][a-z0-9_]{2,})["']\)/gi,  // @Entity('table_name')
    // Prisma models
    /model\s+([A-Z][a-zA-Z0-9]{2,})\s*\{/g,        // model TableName {
  ];

  // Collect table/model names
  for (const file of files) {
    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex
      while ((match = pattern.exec(file.content)) !== null) {
        const tableName = match[1].toLowerCase();
        
        // Skip false positives
        if (falsePositives.has(tableName)) {
          continue;
        }
        
        // Skip single character names
        if (tableName.length < 3) {
          continue;
        }
        
        if (!tablePatterns.has(tableName)) {
          tablePatterns.set(tableName, new Set());
        }

        // Look for field references in same context (more specific)
        const context = file.content.slice(
          Math.max(0, match.index - 300),
          Math.min(file.content.length, match.index + 800)
        );
        
        // Extract field names from select() calls
        const selectPattern = /\.select\(["']([a-z_][a-z0-9_]{1,})["']\)/gi;
        let selectMatch;
        while ((selectMatch = selectPattern.exec(context)) !== null) {
          tablePatterns.get(tableName)?.add(selectMatch[1]);
        }
        
        // Extract field names from .eq(), .insert(), .update()
        const fieldPatterns = [
          /\.eq\(["']([a-z_][a-z0-9_]{1,})["']/gi,
          /\.insert\([^)]*["']([a-z_][a-z0-9_]{1,})["']/gi,
          /\.update\([^)]*["']([a-z_][a-z0-9_]{1,})["']/gi,
        ];
        
        for (const fieldPattern of fieldPatterns) {
          let fieldMatch;
          fieldPattern.lastIndex = 0;
          while ((fieldMatch = fieldPattern.exec(context)) !== null) {
            const fieldName = fieldMatch[1].toLowerCase();
            // Skip common false positives
            if (!falsePositives.has(fieldName) && fieldName.length >= 2) {
              tablePatterns.get(tableName)?.add(fieldName);
            }
          }
        }
      }
    }
  }

  // Convert to models (filter out false positives)
  for (const [tableName, fields] of tablePatterns.entries()) {
    // Skip if table name is too short or is a false positive
    if (tableName.length < 3 || falsePositives.has(tableName)) {
      continue;
    }
    
    // Filter out false positive fields
    const validFields = Array.from(fields).filter(field => 
      field.length >= 2 && 
      !falsePositives.has(field.toLowerCase()) &&
      !['react', 'typescript', 'type', 'from', 'import', 'export'].includes(field.toLowerCase())
    );
    
    if (validFields.length > 0 || tablePatterns.has(tableName)) {
      // If we have valid fields, use them; otherwise add common fields
      const modelFields = validFields.length > 0 
        ? validFields.map(fieldName => ({
            name: fieldName,
            type: 'text', // Default type
            nullable: true,
            primaryKey: fieldName === 'id'
          }))
        : [
            { name: 'id', type: 'uuid', nullable: false, primaryKey: true },
            { name: 'created_at', type: 'timestamp', nullable: true, primaryKey: false }
          ];
      
      models.push({
        name: tableName,
        fields: modelFields
      });
    }
  }
  
  // Sort by name and remove duplicates
  const uniqueModels = new Map();
  for (const model of models) {
    if (!uniqueModels.has(model.name)) {
      uniqueModels.set(model.name, model);
    }
  }
  
  return {
    models: Array.from(uniqueModels.values()).sort((a, b) => a.name.localeCompare(b.name)),
    type: 'raw-sql'
  };
}

/**
 * Map various types to PostgreSQL types
 */
function mapTypeToPostgres(type: string): string {
  const typeMap: Record<string, string> = {
    'string': 'text',
    'text': 'text',
    'varchar': 'text',
    'char': 'text',
    'number': 'integer',
    'integer': 'integer',
    'int': 'integer',
    'bigint': 'bigint',
    'boolean': 'boolean',
    'bool': 'boolean',
    'date': 'timestamp',
    'datetime': 'timestamp',
    'timestamp': 'timestamp',
    'uuid': 'uuid',
    'json': 'jsonb',
    'jsonb': 'jsonb'
  };

  return typeMap[type.toLowerCase()] || 'text';
}

