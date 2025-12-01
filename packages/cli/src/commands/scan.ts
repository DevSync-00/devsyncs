import { scanCodebase } from '../services/code-scanner.js';
import { scanDatabase, closeDatabaseConnections } from '../services/db-scanner.js';
import { compareSchemas } from '../services/diff-engine.js';
import { loadConfig } from '../utils/config.js';
import { ApiClient } from '../services/api-client.js';
import { saveScanResults, getScanExitCode } from '../utils/output.js';
import { detectProjectInfo, matchProject } from '../utils/project-detector.js';
import chalk from 'chalk';
import { resolve } from 'path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { ScanOptions, CodeSchema, DbSchema, Mismatch } from '../types/index.js';

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
    
    // API settings
    let projectId = options.projectId || config?.project?.id;
    const apiUrl = options.apiUrl || config?.api?.url;
    const apiKey = options.apiKey || config?.api?.key;

    // Auto-match with existing projects if API is configured
    if (!projectId && apiUrl && apiKey) {
      try {
        const apiClient = new ApiClient({
          apiUrl,
          apiKey,
          timeout: 10000,
          maxRetries: 2
        });
        
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
          const selectedProjectId = await promptForProjectSelection(apiUrl, apiKey, projectInfo);
          projectId = selectedProjectId || undefined;
        } else {
          console.log(chalk.yellow('⚠️  No project ID provided and interactive prompts are disabled.'));
          console.log(chalk.gray('   Use --project-id or set project.id in .devsync/config.json to sync with the dashboard.\n'));
        }
      } catch (error) {
        // If API call fails, fall back to manual selection
        if (process.stdout.isTTY) {
          console.log(chalk.yellow('⚠️  Could not auto-match project. Please select manually:\n'));
          const selectedProjectId = await promptForProjectSelection(apiUrl, apiKey, projectInfo);
          projectId = selectedProjectId || undefined;
        } else {
          console.log(chalk.yellow('⚠️  Could not auto-match project.'));
          console.log(chalk.gray('   Use --project-id or set project.id in .devsync/config.json to sync with the dashboard.\n'));
        }
      }
    }

    const shouldSync = options.sync !== false && projectId && apiUrl && apiKey;

    // 1. Scan codebase (extract schema - Prisma, TypeORM, Sequelize, Drizzle, or Raw SQL, or AI)
    console.log(chalk.gray('📁 Scanning codebase...'));
    // Check if AI analysis is requested
    const useAI = options.aiAnalysis || !!process.env.OPENAI_API_KEY || !!process.env.OLLAMA_URL || !!process.env.DEEPSEEK_API_KEY;
    const useOllama = options.useOllama || !!process.env.OLLAMA_URL;
    const useDeepSeek = options.useDeepSeek || !!process.env.DEEPSEEK_API_KEY;
    const openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
    const deepseekApiKey = options.deepseekApiKey || process.env.DEEPSEEK_API_KEY;
    const ollamaUrl = options.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    const ollamaModel = options.ollamaModel || process.env.OLLAMA_MODEL || 'llama3.2:3b';
    const deepseekUrl = options.deepseekUrl || process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
    const deepseekModel = options.deepseekModel || process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    
    // Prefer Ollama (free, local) if enabled
    if (useAI && useOllama) {
      console.log(chalk.blue('🤖 Using Ollama (local, free) for AI analysis...'));
      console.log(chalk.gray(`   Model: ${ollamaModel}`));
      console.log(chalk.gray(`   URL: ${ollamaUrl}\n`));
    } else if (useAI && useDeepSeek && deepseekApiKey) {
      console.log(chalk.blue('🤖 Using DeepSeek for AI analysis...'));
      console.log(chalk.gray(`   Model: ${deepseekModel}`));
      console.log(chalk.gray(`   URL: ${deepseekUrl}\n`));
    } else if (useAI && openaiApiKey) {
      console.log(chalk.blue('🤖 Using AI-powered code analysis (OpenAI)...'));
    } else if (useAI && !openaiApiKey && !useOllama && !useDeepSeek) {
      console.error(chalk.red('❌ Error: --ai-analysis requires either:'));
      console.error(chalk.gray('   --use-ollama (local, free)'));
      console.error(chalk.gray('   OR --use-deepseek --deepseek-api-key / DEEPSEEK_API_KEY'));
      console.error(chalk.gray('   OR --openai-api-key flag / OPENAI_API_KEY environment variable'));
      process.exit(1);
    }
    
    const codeSchema = await scanCodebase(absolutePath, {
      useAI: !!useAI,
      openaiApiKey: (useOllama || useDeepSeek) ? undefined : (openaiApiKey || undefined),
      useOllama: !!useOllama,
      ollamaModel: ollamaModel,
      ollamaUrl: ollamaUrl,
      useDeepSeek: !!useDeepSeek,
      deepseekApiKey: deepseekApiKey,
      deepseekModel: deepseekModel,
      deepseekUrl: deepseekUrl,
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
      if (shouldSync && projectId && apiUrl && apiKey) {
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
  const apiClient = new ApiClient({
    apiUrl,
    apiKey,
    timeout: 30000,
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
        console.log(chalk.red(`❌ Failed to load projects: ${(error as Error).message}`));
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

