import { scanCodebase } from '../services/code-scanner.js';
import { scanDatabase, closeDatabaseConnections } from '../services/db-scanner.js';
import { compareSchemas } from '../services/diff-engine.js';
import { loadConfig } from '../utils/config.js';
import { ApiClient } from '../services/api-client.js';
import { saveScanResults, getScanExitCode } from '../utils/output.js';
import { detectProjectInfo, matchProject } from '../utils/project-detector.js';
import { loadAuthConfig, isTokenExpired } from '../lib/auth-config.js';
import { requireAuthenticatedCli } from '../lib/auth-check.js';
import chalk from 'chalk';
import { resolve } from 'path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { ScanOptions, CodeSchema, DbSchema, Mismatch, Config } from '../types/index.js';

export async function scanCommand(options: ScanOptions) {
  try {
    console.log(chalk.blue('🔍 Scanning codebase and database...\n'));

    // Resolve path to absolute path
    // If path is already absolute, use it; otherwise resolve from cwd
    const absolutePath = options.path.startsWith('/') || /^[A-Z]:/.test(options.path)
      ? options.path
      : resolve(process.cwd(), options.path);

    // Load config if exists
    const config = options.config ? await loadConfig(options.config) : null;
    const dbConnection = options.db || config?.database?.connectionString;

    // Auto-detect project information
    const projectInfo = detectProjectInfo(absolutePath);
    
    // Load and validate auth config (from devsync login)
    // If using service API, ensure token is valid and refresh if needed
    let authConfig = await loadAuthConfig();
    
    // If we need service API (for AI analysis OR project fetching), ensure token is valid
    // ALWAYS refresh/validate token BEFORE any API calls to ensure we have a valid token
    if (authConfig && (options.aiAnalysis !== false || !options.projectId)) {
      try {
        // Always call requireAuthenticatedCli - it will refresh if expired, or return existing if valid
        // This ensures we always have a fresh, valid token
        authConfig = await requireAuthenticatedCli();
      } catch (error) {
        // Check if it's a real authentication error or just a network/refresh issue
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        // Debug: Log the actual error
        if (process.env.DEVSYNC_DEBUG === '1') {
          console.log(chalk.gray(`   Error from requireAuthenticatedCli: ${errorMessage}`));
          if (errorStack) {
            console.log(chalk.gray(`   Stack: ${errorStack.split('\n').slice(0, 3).join('\n')}`));
          }
        }
        
        // Re-load authConfig to check expiry (it might have been updated)
        const currentAuthConfig = await loadAuthConfig();
        const actuallyExpired = currentAuthConfig ? (Date.now() / 1000 >= currentAuthConfig.expiresAt) : true;
        
        // If it's a network error or refresh failure, try to use the existing token
        // Sessions are lifecycle-based - network issues shouldn't invalidate the session
        if ((errorMessage.includes('timeout') || 
            errorMessage.includes('ECONNREFUSED') || 
            errorMessage.includes('ENOTFOUND') ||
            errorMessage.includes('network') ||
            errorMessage.includes('refresh') ||
            errorMessage.includes('fetch failed')) && !actuallyExpired && currentAuthConfig) {
          // Network/refresh error but token is still valid - use it
          console.log(chalk.yellow('⚠️  Could not refresh token, using existing token.'));
          console.log(chalk.gray('   Session remains active. Token refresh will retry on next operation.\n'));
          authConfig = currentAuthConfig; // Use the current config
        } else if (errorMessage.includes('Refresh token expired') || 
                   errorMessage.includes('Refresh token') && errorMessage.includes('invalid') ||
                   (errorMessage.includes('Unauthorized') && errorMessage.includes('401')) ||
                   actuallyExpired) {
          // Real authentication error - token is invalid or expired
          console.log(chalk.red('❌ Authentication failed. Please run `devsync login` again.'));
          console.log(chalk.gray('   Your authentication token may have expired or is invalid.\n'));
          if (process.env.DEVSYNC_DEBUG === '1') {
            console.log(chalk.gray(`   Error details: ${errorMessage}`));
          }
          authConfig = null;
        } else {
          // Unknown error - try to use existing token if it's not expired
          if (!actuallyExpired && currentAuthConfig) {
            console.log(chalk.yellow('⚠️  Could not validate token, using existing token.'));
            console.log(chalk.gray('   If authentication fails, please run `devsync login` again.\n'));
            if (process.env.DEVSYNC_DEBUG === '1') {
              console.log(chalk.gray(`   Error details: ${errorMessage}`));
            }
            authConfig = currentAuthConfig; // Use the current config
          } else {
            console.log(chalk.red('❌ Authentication failed. Please run `devsync login` again.'));
            console.log(chalk.gray('   Your authentication token may have expired or is invalid.\n'));
            if (process.env.DEVSYNC_DEBUG === '1') {
              console.log(chalk.gray(`   Error details: ${errorMessage}`));
            }
            authConfig = null;
          }
        }
      }
    }
    
    // API settings - prioritize: command-line > config file > saved auth config
    let projectId = options.projectId || config?.project?.id;
    const apiUrl = options.apiUrl || config?.api?.url || authConfig?.apiUrl;
    // Always use authConfig token if available (it's refreshed and valid)
    // IMPORTANT: Use authConfig.accessToken first since it's the refreshed token
    // Create a helper function to get the current API key (always uses latest authConfig)
    const getApiKey = () => authConfig?.accessToken || options.apiKey || config?.api?.key;
    let apiKey = getApiKey();

    // Auto-match with existing projects if API is configured
    if (!projectId && apiUrl && apiKey) {
      try {
        // Use the refreshed token from authConfig
        const apiClient = new ApiClient({
          apiUrl,
          apiKey,
          timeout: 60000, // Increased to 1 minute for better reliability
          maxRetries: 2
        });
        
        if (process.env.DEVSYNC_DEBUG === '1') {
          console.log(chalk.gray(`   Attempting to list projects with API key: ${apiKey.substring(0, 20)}...`));
        }
        
        const existingProjects = await apiClient.listProjects();
        const matches = matchProject(projectInfo, existingProjects);
        
        if (matches.length > 0 && matches[0].score >= 50) {
          // Found a good match
          const bestMatch = matches[0].project;
          console.log(chalk.blue(`🔗 Found matching project: ${bestMatch.name} (${bestMatch.id})`));
          console.log(chalk.gray(`   Match score: ${matches[0].score}/100\n`));
          
          if (process.stdout.isTTY) {
            const rl = readline.createInterface({ input, output });
            try {
              const answer = (await rl.question(
                chalk.cyan(`Use this project? (Y/n): `)
              )).trim().toLowerCase();
              
              if (answer === '' || answer === 'y' || answer === 'yes') {
                projectId = bestMatch.id;
                console.log(chalk.green(`✅ Using project: ${bestMatch.name}\n`));
              } else {
                // Let user select manually
                // Use the refreshed token (apiKey already has the latest from authConfig)
                const selectedProjectId = await promptForProjectSelection(apiUrl, apiKey, projectInfo);
                projectId = selectedProjectId || undefined;
              }
            } finally {
              rl.close();
            }
          } else {
            // Non-interactive: use best match if score is high enough
            if (matches[0].score >= 80) {
              projectId = bestMatch.id;
              console.log(chalk.green(`✅ Auto-matched with project: ${bestMatch.name}\n`));
            } else {
              console.log(chalk.yellow('⚠️  Found potential matches but score too low for auto-match.'));
              console.log(chalk.gray('   Use --project-id or set project.id in .devsync/config.json to sync with the dashboard.\n'));
            }
          }
        } else if (process.stdout.isTTY) {
          // No good matches, prompt user
          console.log(chalk.blue(`📋 Project detected: ${projectInfo.name}`));
          if (projectInfo.schemaType) {
            console.log(chalk.gray(`   Schema type: ${projectInfo.schemaType}`));
          }
          console.log();
          // Get the latest API key (may have been refreshed)
          const currentApiKey = getApiKey();
          if (!currentApiKey) {
            console.log(chalk.red('❌ No API key available. Please run `devsync login` first.'));
            return;
          }
          const selectedProjectId = await promptForProjectSelection(apiUrl, currentApiKey, projectInfo);
          projectId = selectedProjectId || undefined;
        } else {
          console.log(chalk.yellow('⚠️  No project ID provided and interactive prompts are disabled.'));
          console.log(chalk.gray('   Use --project-id or set project.id in .devsync/config.json to sync with the dashboard.\n'));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Debug: Log the actual error
        if (process.env.DEVSYNC_DEBUG === '1') {
          console.log(chalk.gray(`   Error from listProjects: ${errorMessage}`));
        }
        
        // Check if it's an authentication error
        // The error format is: "Failed to fetch projects: ${errorMessage} (${status})"
        // So we need to check for 401 in the status part or "Unauthorized" in the message
        const isAuthError = errorMessage.includes('Unauthorized') || 
                           errorMessage.includes('401') ||
                           errorMessage.match(/\(401\)/) !== null ||
                           (errorMessage.includes('Failed to fetch projects') && errorMessage.includes('(401)'));
        
        if (isAuthError) {
          console.log(chalk.red('❌ Authentication failed. Please run `devsync login` again.'));
          console.log(chalk.gray('   Your authentication token may have expired or is invalid.\n'));
          if (process.env.DEVSYNC_DEBUG === '1') {
            console.log(chalk.gray(`   Error details: ${errorMessage}`));
          }
          // Don't try to prompt for project selection if auth failed
          return;
        }
        
        // If API call fails for other reasons, fall back to manual selection
        if (process.stdout.isTTY) {
          console.log(chalk.yellow('⚠️  Could not auto-match project. Please select manually:\n'));
          // Use the latest API key (try to refresh if needed)
          const currentApiKey = getApiKey();
          if (!currentApiKey) {
            console.log(chalk.red('❌ No API key available. Please run `devsync login` first.'));
            return;
          }
          const selectedProjectId = await promptForProjectSelection(apiUrl, currentApiKey, projectInfo);
          projectId = selectedProjectId || undefined;
        } else {
          console.log(chalk.yellow('⚠️  Could not auto-match project.'));
          console.log(chalk.gray('   Use --project-id or set project.id in .devsync/config.json to sync with the dashboard.\n'));
        }
      }
    }

    const shouldSync = options.sync !== false && projectId && apiUrl && apiKey;

    // 1. Scan codebase (AI first by default, then fallback to Prisma, TypeORM, Sequelize, Drizzle, or Raw SQL)
    console.log(chalk.gray('📁 Scanning codebase...'));
    
    // AI analysis uses service-configured API keys (no user API keys needed)
    // Users can only choose to use local Ollama if available
    const useOllama = options.useOllama || 
                     !!process.env.OLLAMA_URL || 
                     config?.ai?.useOllama || 
                     false;
    const ollamaUrl = options.ollamaUrl || 
                     process.env.OLLAMA_URL || 
                     config?.ai?.ollamaUrl || 
                     'http://localhost:11434';
    const ollamaModel = options.ollamaModel || 
                       process.env.OLLAMA_MODEL || 
                       config?.ai?.ollamaModel || 
                       'llama3.2:3b';
    
    // Use AI by default unless explicitly disabled with --no-ai-analysis
    // AI will try service API first, then Ollama, then fallback to pattern matching
    const aiEnabledInConfig = config?.ai?.enabled !== false; // Default to true if not specified
    // AI is enabled by default - it will attempt to use service API or Ollama, and fallback gracefully
    const useAI = options.aiAnalysis !== false && 
                  (options.aiAnalysis === true || aiEnabledInConfig !== false);
    
    // Prefer Ollama (free, local) if enabled
    if (useAI && useOllama) {
      console.log(chalk.blue('🤖 Using Ollama (local, free) for AI analysis...'));
      console.log(chalk.gray(`   Model: ${ollamaModel}`));
      console.log(chalk.gray(`   URL: ${ollamaUrl}`));
      console.log(chalk.gray('   (Will fallback to SQL/database files if AI fails)\n'));
    } else if (useAI && apiUrl && apiKey) {
      const provider = options.aiProvider || 'puter';
      const { getModelInfo } = await import('../utils/ai-provider-resolver.js');
      const modelInfo = getModelInfo(provider as any);
      console.log(chalk.blue(`🤖 Using AI-powered code analysis (${modelInfo.displayName})...`));
      console.log(chalk.gray(`   Provider: ${modelInfo.provider}`));
      console.log(chalk.gray(`   Model: ${modelInfo.model}`));
      console.log(chalk.gray('   API keys are managed by the service'));
      if (authConfig) {
        console.log(chalk.gray(`   Authenticated as: ${authConfig.userId || 'user'}`));
      }
      console.log(chalk.gray('   (Will fallback to SQL/database files if AI fails)\n'));
    } else if (useAI) {
      // AI is enabled but no service connection or Ollama - try service API anyway, it will fail gracefully
      console.log(chalk.blue('🤖 Attempting AI-powered code analysis...'));
      if (!apiUrl || !apiKey) {
        console.log(chalk.yellow('⚠️  Not connected to service API.'));
        console.log(chalk.gray('   Connect with: devsync login'));
        console.log(chalk.gray('   Or use local AI: --use-ollama'));
      }
      console.log(chalk.gray('   Will try service API, then fallback to pattern matching...\n'));
    } else if (!useAI) {
      console.log(chalk.gray('📋 Scanning for SQL/database schema files...\n'));
    }
    
    // DISABLED CACHE: Every scan is fresh to ensure code changes are immediately reflected
    const codeSchema = await scanCodebase(absolutePath, {
      useAI: !!useAI,
      useOllama: !!useOllama,
      ollamaModel: ollamaModel,
      ollamaUrl: ollamaUrl,
      // Service API - try to use if available, even if not fully synced
      serviceApiUrl: apiUrl || undefined,
      serviceApiKey: apiKey || undefined,
      aiProvider: options.aiProvider || 'puter',
      useCache: false, // DISABLED: Always perform fresh scan
      showProgress: !options.json
    });
    console.log(chalk.green(`✅ Code schema extracted (${codeSchema.models.length} models)\n`));

    // 2. Scan database (if connection provided)
    // Check if user passed connection string as positional argument (common mistake)
    if (!dbConnection && process.argv.length > 0) {
      const args = process.argv.slice(process.argv.indexOf('scan') + 1);
      const potentialDbArg = args.find(arg => 
        (arg.startsWith('postgresql://') || 
         arg.startsWith('postgres://') ||
         arg.startsWith('mysql://') ||
         arg.startsWith('mongodb://')) &&
        !arg.startsWith('--')
      );
      if (potentialDbArg) {
        console.log(chalk.yellow(`\n⚠️  Database connection string detected but --db flag is missing.`));
        console.log(chalk.yellow(`   Use: devsync scan --ai-provider deepseek --db "${potentialDbArg}"`));
        console.log(chalk.gray(`   (Skipping database scan for now)\n`));
      }
    }
    
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
      if (shouldSync && projectId && apiUrl && apiKey) {
        await syncToCloud(apiUrl, apiKey, projectId, codeSchema, null, []);
      }
      return;
    }

    console.log(chalk.gray('🗄️  Scanning database...'));
    const dbSchema = await scanDatabase({
      connectionString: dbConnection,
      showProgress: !options.json,
      timeout: 60000, // Increased to 1 minute for better reliability
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
    if (shouldSync && projectId && apiUrl && apiKey) {
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
      timeout: 60000, // Increased to 1 minute for better reliability
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

function formatLastScan(lastScan?: string | null): string {
  if (!lastScan) {
    return 'Never';
  }

  try {
    const date = new Date(lastScan);
    if (Number.isNaN(date.getTime())) {
      return lastScan;
    }
    return date.toLocaleString();
  } catch {
    return lastScan;
  }
}

function buildProjectLine(index: number, project: Awaited<ReturnType<ApiClient['listProjects']>>[number]) {
  const mismatchCount = project.mismatchCount ?? project.metadata?.mismatchCount ?? 0;
  const lastScanAt = project.lastScanAt ?? project.metadata?.lastScanAt ?? null;
  const lastScanStatus = project.lastScanStatus ?? project.metadata?.lastScanStatus ?? null;
  const schemaLabel = project.schemaType || 'Unknown schema';
  const lastScanLabel = `${formatLastScan(lastScanAt)}${lastScanStatus ? ` (${lastScanStatus})` : ''}`;

  console.log(chalk.cyan(`  ${index + 1}. ${project.name}`));
  console.log(
    chalk.gray(
      `     ${schemaLabel} • Last scan: ${lastScanLabel} • Mismatches: ${mismatchCount}`
    )
  );
}

async function promptForProjectSelection(apiUrl: string, apiKey: string, projectInfo?: { name: string; schemaType?: string | null }): Promise<string | null> {
  // Try to refresh the token before creating API client
  let currentApiKey = apiKey;
  try {
    const authConfig = await loadAuthConfig();
    if (authConfig) {
      // Check if token is expired and refresh if needed
      if (isTokenExpired(authConfig.expiresAt)) {
        const refreshed = await requireAuthenticatedCli();
        if (refreshed && refreshed.accessToken) {
          currentApiKey = refreshed.accessToken;
        }
      } else if (authConfig.accessToken) {
        // Use the latest token from config
        currentApiKey = authConfig.accessToken;
      }
    }
  } catch (error) {
    // If refresh fails, use the provided key and let the API call fail with a better error
    console.log(chalk.yellow('⚠️  Could not refresh authentication token. Using provided key.'));
  }
  
  const apiClient = new ApiClient({
    apiUrl,
    apiKey: currentApiKey,
    timeout: 120000, // Increased to 2 minutes for better reliability
    maxRetries: 3,
  });

  const rl = readline.createInterface({ input, output });
  let searchTerm: string | undefined;

  console.log(chalk.blue('☁️  Select a project to sync scan results with:'));
  if (projectInfo) {
    console.log(chalk.gray(`   Detected project: ${projectInfo.name}`));
    if (projectInfo.schemaType) {
      console.log(chalk.gray(`   Schema type: ${projectInfo.schemaType}`));
    }
    console.log();
  }

  try {
    while (true) {
      let projects;
      try {
        projects = await apiClient.listProjects(searchTerm);
      } catch (error) {
        const errorMessage = (error as Error).message;
        
        // Check if it's an authentication error
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
          console.log(chalk.red(`❌ Authentication failed. Please run \`devsync login\` again.`));
          console.log(chalk.gray(`   Your authentication token may have expired or is invalid.`));
          return null;
        }
        
        // Check if it's a network error
        if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
          console.log(chalk.red(`❌ Network error: ${errorMessage}`));
          console.log(chalk.gray(`   Please check your connection and try again.`));
          const retry = (await rl.question(chalk.cyan('Retry? (y/n): '))).trim().toLowerCase();
          if (retry === 'y' || retry === 'yes') {
            continue;
          }
          return null;
        }
        
        console.log(chalk.red(`❌ Failed to load projects: ${errorMessage}`));
        return null;
      }

      if (!projects.length) {
        console.log(chalk.yellow('\nNo projects found.'));
        const emptyAction = (await rl.question(
          chalk.cyan('Type (c) to create one, (s) to search again, or (q) to cancel: ')
        ))
          .trim()
          .toLowerCase();

        if (emptyAction === 'q') {
          return null;
        }

        if (emptyAction === 's') {
          const term = await rl.question(chalk.cyan('Enter search term (leave empty to show all): '));
          searchTerm = term.trim() || undefined;
          continue;
        }

        if (emptyAction === 'c') {
          console.log(chalk.blue(`\n➡️  Create a new project at ${apiUrl}/dashboard/projects/new`));
          console.log(chalk.gray('   After creating it, return here and choose search to refresh the list.\n'));
          await rl.question(chalk.cyan('Press Enter to continue...'));
          continue;
        }

        continue;
      }

      console.log(chalk.blue('\n📋 Your Projects:\n'));
      projects.forEach((project, index) => buildProjectLine(index, project));

      const createOption = projects.length + 1;
      const searchOption = projects.length + 2;
      const manualOption = projects.length + 3;
      const cancelOption = projects.length + 4;

      console.log(chalk.cyan(`  ${createOption}. Create new project...`));
      console.log(chalk.cyan(`  ${searchOption}. Search / filter projects...`));
      console.log(chalk.cyan(`  ${manualOption}. Enter project ID manually`));
      console.log(chalk.cyan(`  ${cancelOption}. Cancel`));

      const answer = (await rl.question(chalk.cyan('\nSelect an option: '))).trim();
      const choice = Number.parseInt(answer, 10);

      if (!Number.isNaN(choice)) {
        if (choice >= 1 && choice <= projects.length) {
          const selected = projects[choice - 1];
          console.log(chalk.green(`\n✅ Selected project: ${selected.name} (${selected.id})\n`));
          return selected.id;
        }

        if (choice === createOption) {
          console.log(chalk.blue(`\n➡️  Create a new project at ${apiUrl}/dashboard/projects/new`));
          console.log(chalk.gray('   After creating it, return here and choose search to refresh the list.\n'));
          await rl.question(chalk.cyan('Press Enter to continue...'));
          continue;
        }

        if (choice === searchOption) {
          const term = await rl.question(chalk.cyan('Enter search term (leave empty to show all): '));
          searchTerm = term.trim() || undefined;
          continue;
        }

        if (choice === manualOption) {
          const manualId = (await rl.question(chalk.cyan('Enter project ID: '))).trim();
          if (manualId) {
            console.log(chalk.green(`\n✅ Using project: ${manualId}\n`));
            return manualId;
          }
          continue;
        }

        if (choice === cancelOption) {
          return null;
        }
      } else {
        const normalized = answer.toLowerCase();
        if (normalized === 'c') {
          console.log(chalk.blue(`\n➡️  Create a new project at ${apiUrl}/dashboard/projects/new`));
          console.log(chalk.gray('   After creating it, return here and choose search to refresh the list.\n'));
          await rl.question(chalk.cyan('Press Enter to continue...'));
          continue;
        }

        if (normalized === 's') {
          const term = await rl.question(chalk.cyan('Enter search term (leave empty to show all): '));
          searchTerm = term.trim() || undefined;
          continue;
        }

        if (normalized === 'q') {
          return null;
        }
      }
    }
  } finally {
    rl.close();
  }
}

