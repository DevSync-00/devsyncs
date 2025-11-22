import { scanCodebase } from '../services/code-scanner.js';
import { scanDatabase, closeDatabaseConnections } from '../services/db-scanner.js';
import { compareSchemas } from '../services/diff-engine.js';
import { loadConfig } from '../utils/config.js';
import { ApiClient } from '../services/api-client.js';
import { saveScanResults, getScanExitCode } from '../utils/output.js';
import chalk from 'chalk';
import { resolve, join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import type { ScanOptions, CodeSchema, DbSchema, Mismatch } from '../types/index.js';
import { requireAuthenticatedCli, getAuthenticatedCli } from '../lib/auth-check.js';
import { selectPrompt, inputPrompt } from '../utils/prompts.js';
import { loginCommand } from './login.js';
import { AnalyzerApiClient } from '../lib/api-client.js';

export async function scanCommand(options: ScanOptions) {
  try {
    console.log(chalk.blue('🔍 Scanning codebase and database...\n'));
    
    // Show authentication prompt
    const authChoice = await selectPrompt(
      'How would you like to proceed?',
      [
        { name: 'Log in or create account', value: 'login' },
        { name: 'Continue without login', value: 'no-login' }
      ]
    );

    let dbConnection: string | undefined = options.db;
    let projectId: string | undefined = options.projectId;
    let apiUrl: string | undefined = options.apiUrl;
    let apiKey: string | undefined = options.apiKey;
    let shouldSync = false;

    if (authChoice === 'login') {
      // User chose to log in or create account
      console.log(chalk.blue('\n🔐 Logging in or creating account...\n'));
      await loginCommand();
      
      // Get authenticated API client (should be available after loginCommand)
      const auth = await getAuthenticatedCli();
      if (!auth) {
        console.error(chalk.red('❌ Authentication failed. Please try again.'));
        process.exit(1);
      }
      const apiClient = new AnalyzerApiClient();
      
      // Get API URL from environment or config
      apiUrl = options.apiUrl || process.env.DEVSYNC_API_URL || 'http://localhost:4000';
      apiKey = auth.accessToken;
      
      // Prompt for Project ID (can be empty to create new project)
      projectId = await inputPrompt('Enter your Project ID (leave empty to create a new project)');
      
      if (!projectId) {
        // User wants to create a new project
        console.log(chalk.blue('\n📝 Creating new project...\n'));
        
        const projectName = await inputPrompt('Enter project name');
        if (!projectName) {
          console.error(chalk.red('❌ Project name is required.'));
          process.exit(1);
        }
        
        // Prompt for schema type
        const schemaTypeChoice = await selectPrompt(
          'Select schema type',
          [
            { name: 'Prisma', value: 'prisma' },
            { name: 'Supabase', value: 'supabase' },
            { name: 'TypeORM', value: 'typeorm' },
            { name: 'Kysely', value: 'kysely' },
            { name: 'Sequelize', value: 'sequelize' },
            { name: 'Drizzle', value: 'drizzle' },
            { name: 'Django', value: 'django' },
            { name: 'SQLAlchemy', value: 'sqlalchemy' },
            { name: 'Raw SQL', value: 'raw-sql' },
            { name: 'Auto-detect (AI)', value: 'auto' }
          ]
        );
        
        // Prompt for database connection string
        dbConnection = await inputPrompt('Enter database connection string');
        if (!dbConnection) {
          console.error(chalk.red('❌ Database connection string is required.'));
          process.exit(1);
        }
        
        // Prompt for codebase source
        const codebaseSource = await inputPrompt('Enter codebase source (file path or git URL)', process.cwd());
        
        // Create project via API
        console.log(chalk.gray('\n📡 Creating project...'));
        try {
          const projectApiClient = new ApiClient({
            apiUrl,
            apiKey: auth.accessToken,
            timeout: 30000,
            maxRetries: 3
          });
          
          const newProject = await projectApiClient.createProject({
            name: projectName,
            schemaType: schemaTypeChoice === 'auto' ? undefined : schemaTypeChoice,
            databaseConnectionString: dbConnection,
            codebaseSource: codebaseSource || process.cwd()
          });
          
          projectId = newProject.id;
          shouldSync = true;
          
          console.log(chalk.green(`✅ Project "${newProject.name}" created successfully!`));
          console.log(chalk.gray(`   Project ID: ${projectId}\n`));
          
          // Save project ID to config if possible
          try {
            const configPath = resolve(process.cwd(), '.devsync', 'config.json');
            let config: any = await loadConfig('.devsync/config.json').catch(() => null);
            
            if (!config) {
              // Create default config structure
              config = {
                version: '1.0',
                project: {
                  name: projectName,
                  schemaType: schemaTypeChoice === 'auto' ? 'prisma' : schemaTypeChoice,
                  id: projectId
                },
                database: {
                  connectionString: dbConnection,
                  provider: 'postgresql' as const
                },
                api: {
                  url: apiUrl,
                  key: apiKey,
                  enabled: true
                }
              };
            } else {
              config.project = config.project || { name: projectName, schemaType: 'prisma' };
              config.project.id = projectId;
              config.project.name = projectName;
              if (schemaTypeChoice !== 'auto') {
                config.project.schemaType = schemaTypeChoice;
              }
              config.database = config.database || { provider: 'postgresql' as const };
              config.database.connectionString = dbConnection;
              config.database.provider = config.database.provider || 'postgresql';
              config.api = config.api || {};
              config.api.url = apiUrl;
              config.api.key = apiKey;
            }
            
            const configDir = join(process.cwd(), '.devsync');
            if (!existsSync(configDir)) {
              mkdirSync(configDir, { recursive: true });
            }
            writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log(chalk.gray(`   Config saved to: ${configPath}\n`));
          } catch (configError) {
            // Ignore config save errors
            console.log(chalk.yellow(`   ⚠️  Could not save config: ${configError instanceof Error ? configError.message : String(configError)}\n`));
          }
        } catch (error) {
          console.error(chalk.red(`❌ Failed to create project: ${error instanceof Error ? error.message : String(error)}`));
          console.log(chalk.yellow('⚠️  Continuing with manual database connection...\n'));
          // Continue with manual connection
        }
      } else {
        // User entered an existing Project ID - fetch project metadata
        console.log(chalk.gray('\n📡 Fetching project metadata...'));
        try {
          const projectApiClient = new ApiClient({
            apiUrl,
            apiKey: auth.accessToken,
            timeout: 30000,
            maxRetries: 3
          });
          
          const projectMetadata = await projectApiClient.getProjectMetadata(projectId);
          
          // Use database connection from project metadata if available
          if (projectMetadata.databaseConnectionString) {
            dbConnection = projectMetadata.databaseConnectionString;
            console.log(chalk.green('✅ Found database connection in project settings'));
          } else {
            console.log(chalk.yellow('⚠️  No database connection found in project settings'));
            dbConnection = await inputPrompt('Enter database connection string');
          }
          
          shouldSync = true;
          
          console.log(chalk.green(`✅ Project "${projectMetadata.name}" loaded\n`));
        } catch (error) {
          console.error(chalk.red(`❌ Failed to fetch project metadata: ${error instanceof Error ? error.message : String(error)}`));
          console.log(chalk.yellow('⚠️  Falling back to manual database connection...\n'));
          dbConnection = await inputPrompt('Enter database connection string');
        }
      }
    } else {
      // User chose to continue without login
      console.log(chalk.gray('\n📝 Continuing without login...\n'));
      
      // Load config if exists
      const config = options.config ? await loadConfig(options.config) : null;
      dbConnection = options.db || config?.database?.connectionString;
      
      // If still no database connection, prompt for it
      if (!dbConnection) {
        dbConnection = await inputPrompt('Enter database connection string');
      }
    }

    // Resolve path to absolute path
    // If path is already absolute, use it; otherwise resolve from cwd
    const absolutePath = options.path.startsWith('/') || /^[A-Z]:/.test(options.path)
      ? options.path
      : resolve(process.cwd(), options.path);

    // Load config if exists (for additional settings)
    const config = options.config ? await loadConfig(options.config) : null;
    
    // Override with config if not set from prompts
    if (!dbConnection) {
      dbConnection = config?.database?.connectionString;
    }
    if (!projectId) {
      projectId = config?.project?.id;
    }
    if (!apiUrl) {
      apiUrl = config?.api?.url;
    }
    if (!apiKey) {
      apiKey = config?.api?.key;
    }
    
    // Update shouldSync based on final values
    shouldSync = !!(options.sync !== false && shouldSync && projectId && apiUrl && apiKey);

    // 1. Scan codebase using AI analysis (always use AI to infer schema from code)
    console.log(chalk.gray('📁 Scanning codebase with AI analysis...'));
    
    const useOllama = options.useOllama || !!process.env.OLLAMA_URL;
    const openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
    const ollamaUrl = options.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    const ollamaModel = options.ollamaModel || process.env.OLLAMA_MODEL || 'llama3.2:3b';
    
    // Prefer Ollama (free, local) if available
    if (useOllama) {
      console.log(chalk.blue('🤖 Using Ollama (local, free) for AI analysis...'));
      console.log(chalk.gray(`   Model: ${ollamaModel}`));
      console.log(chalk.gray(`   URL: ${ollamaUrl}\n`));
    } else if (openaiApiKey) {
      console.log(chalk.blue('🤖 Using AI-powered code analysis (OpenAI)...\n'));
    } else {
      console.log(chalk.yellow('⚠️  No AI provider configured. Trying to use Ollama at default location...\n'));
    }
    
    // Always use AI analysis to infer schema from code
    // The code-scanner will fallback to schema files if AI fails, but we prefer AI
    const codeSchema = await scanCodebase(absolutePath, {
      useAI: true, // Always use AI for codebase analysis
      openaiApiKey: useOllama ? undefined : (openaiApiKey || undefined),
      useOllama: useOllama,
      ollamaModel: ollamaModel,
      ollamaUrl: ollamaUrl,
      useCache: true,
      showProgress: !options.json
    });
    console.log(chalk.green(`✅ Code schema extracted (${codeSchema.models.length} models)\n`));

    // 2. Scan database (if connection provided)
    if (!dbConnection) {
      console.log(chalk.yellow('⚠️  No database connection provided'));
      console.log(chalk.gray('💡 Tip: Use --db flag or set in .devsync/config.json'));
      console.log(chalk.gray('💡 Example: devsync scan --db postgresql://user:pass@localhost/db\n'));
      
      // Show what we found in code
      console.log(chalk.blue('📋 Models found in codebase:\n'));
      codeSchema.models.forEach((model) => {
        console.log(chalk.cyan(`  • ${model.name}`));
        model.fields.forEach((field) => {
          console.log(chalk.gray(`    - ${field.name}: ${field.type}`));
        });
      });

      // Try to sync to cloud even without DB
      if (shouldSync && apiUrl && apiKey && projectId) {
        await syncToCloud(apiUrl, apiKey, projectId, codeSchema, null, []);
      }
      return;
    }

    console.log(chalk.gray('🗄️  Scanning database...'));
    const dbSchema = await scanDatabase({
      connectionString: dbConnection,
      showProgress: !options.json,
      timeout: 30000,
      maxRetries: 3
    });
    console.log(chalk.green(`✅ Database schema extracted (${dbSchema.models.length} tables)\n`));

    // 3. Compare schemas
    console.log(chalk.gray('🔬 Comparing schemas...'));
    const diff = compareSchemas(codeSchema, dbSchema);
    console.log(chalk.green('✅ Comparison complete\n'));

    // 4. Display results
    if (options.json) {
      // JSON output mode (for CI/CD)
      console.log(JSON.stringify({
        mismatches: diff.mismatches,
        warnings: diff.warnings,
        metadata: {
          ...diff.metadata,
          timestamp: diff.metadata.timestamp.toISOString(),
        },
        summary: {
          totalMismatches: diff.mismatches.length,
          errors: diff.mismatches.filter(m => m.severity === 'error').length,
          warnings: diff.mismatches.filter(m => m.severity === 'warning').length,
          info: diff.mismatches.filter(m => m.severity === 'info').length,
        },
      }, null, 2));
    } else {
      displayResults(diff);
    }

    // 5. Save results to file if output path specified
    if (options.output) {
      const resultsPath = saveScanResults(absolutePath, diff, options.output);
      console.log(chalk.gray(`\n📄 Results saved to: ${resultsPath}\n`));
    }

    // 6. Sync to cloud if configured
    if (shouldSync && apiUrl && apiKey && projectId) {
      await syncToCloud(apiUrl, apiKey, projectId, codeSchema, dbSchema, diff.mismatches);
    }

    // 7. Exit with appropriate code for CI/CD
    const exitCode = getScanExitCode(diff, options.failOnWarnings || false);
    
    // Clean up database connections
    await closeDatabaseConnections();
    
    if (exitCode !== 0) {
      if (options.json) {
        // In JSON mode, we still exit with error code
        process.exit(exitCode);
      } else {
        process.exit(exitCode);
      }
    }

  } catch (error) {
    // Clean up on error
    await closeDatabaseConnections().catch(() => {});
    
    if (error instanceof Error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      if (error.stack && process.env.DEBUG) {
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red('❌ Unknown error occurred'));
    }
    process.exit(1);
  }
}

function displayResults(diff: ReturnType<typeof compareSchemas>) {
  if (diff.mismatches.length === 0) {
    console.log(chalk.green('✨ No mismatches found! Everything is in sync.\n'));
    return;
  }

  console.log(chalk.yellow(`⚠️  Found ${diff.mismatches.length} mismatch(es):\n`));
  
  // Group by severity
  const errors = diff.mismatches.filter(m => m.severity === 'error');
  const warnings = diff.mismatches.filter(m => m.severity === 'warning');
  const infos = diff.mismatches.filter(m => m.severity === 'info');

  if (errors.length > 0) {
    console.log(chalk.red(`🔴 Errors (${errors.length}):\n`));
    errors.forEach((mismatch, i) => {
      console.log(chalk.red(`  ${i + 1}. ${mismatch.type.toUpperCase()}: ${mismatch.model}${mismatch.field ? '.' + mismatch.field : ''}`));
      if (mismatch.codeValue) console.log(chalk.gray(`     Code: ${mismatch.codeValue}`));
      if (mismatch.dbValue) console.log(chalk.gray(`     DB:   ${mismatch.dbValue}`));
      console.log();
    });
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow(`🟡 Warnings (${warnings.length}):\n`));
    warnings.forEach((mismatch, i) => {
      console.log(chalk.yellow(`  ${i + 1}. ${mismatch.type.toUpperCase()}: ${mismatch.model}${mismatch.field ? '.' + mismatch.field : ''}`));
      if (mismatch.codeValue) console.log(chalk.gray(`     Code: ${mismatch.codeValue}`));
      if (mismatch.dbValue) console.log(chalk.gray(`     DB:   ${mismatch.dbValue}`));
      console.log();
    });
  }

  if (infos.length > 0) {
    console.log(chalk.blue(`ℹ️  Info (${infos.length}):\n`));
    infos.forEach((mismatch, i) => {
      console.log(chalk.blue(`  ${i + 1}. ${mismatch.type.toUpperCase()}: ${mismatch.model}${mismatch.field ? '.' + mismatch.field : ''}`));
      console.log();
    });
  }

  console.log(chalk.gray('\n💡 Run `devsync scan --help` for more options'));
}

async function syncToCloud(
  apiUrl: string,
  apiKey: string,
  projectId: string,
  codeSchema: CodeSchema,
  dbSchema: DbSchema | null,
  mismatches: Mismatch[]
) {
  try {
    console.log(chalk.gray('\n☁️  Syncing results to dashboard...'));
    
    const apiClient = new ApiClient({ 
      apiUrl, 
      apiKey,
      timeout: 30000,
      maxRetries: 3
    });
    
    const result = await apiClient.sendScanReport({
      projectId,
      codeSchema,
      dbSchema: dbSchema || undefined,
      mismatches,
      metadata: {
        codeVersion: codeSchema.type,
        dbVersion: dbSchema?.type || 'none',
        timestamp: new Date(),
      },
    });

    console.log(chalk.green(`✅ Scan report synced to dashboard!`));
    console.log(chalk.gray(`   Scan ID: ${result.scanId}`));
    console.log(chalk.gray(`   View in dashboard: ${apiUrl}/dashboard/projects/${projectId}\n`));
  } catch (error) {
    if (error instanceof Error) {
      console.log(chalk.yellow(`⚠️  Failed to sync to cloud: ${error.message}`));
      console.log(chalk.gray('   Results are still available locally\n'));
    } else {
      console.log(chalk.yellow('⚠️  Failed to sync to cloud\n'));
    }
  }
}

