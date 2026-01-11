import * as vscode from 'vscode';
import { DevSyncSidebarProvider } from './sidebarProvider';
import { join } from 'path';
import { existsSync } from 'fs';
import { ICliRunner } from './interfaces';
import { getScanResultsPath, ensureMigrationsDir } from './utils/paths';
import { generateMigrationFilename } from './utils/id';

export class SidebarCommands {
  constructor(
    private sidebarProvider: DevSyncSidebarProvider,
    private cliRunner: ICliRunner
  ) {}

  async scan(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    // Check if CLI is available
    const cliAvailable = await this.cliRunner.checkCliAvailable();
    if (!cliAvailable) {
      const build = await vscode.window.showWarningMessage(
        'CLI not built. Would you like to build it now?',
        'Yes',
        'No'
      );
      
      if (build === 'Yes') {
        await this.buildCli();
        return;
      } else {
        return;
      }
    }

    // Get configuration
    const config = vscode.workspace.getConfiguration('devsync');
    const dbConnection = config.get<string>('databaseConnection', '');
    
    // Show input for database connection if not set
    let finalDbConnection = dbConnection;
    if (!finalDbConnection) {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter database connection string (optional)',
        placeHolder: 'postgresql://user:password@host:port/database',
        ignoreFocusOut: true
      });
      
      if (input === undefined) {
        return; // User cancelled
      }
      finalDbConnection = input;
    }

    // Show progress
    await this.sidebarProvider.setScanning(true);
    this.cliRunner.showOutput();

    try {
      const options: Record<string, any> = {};
      
      if (finalDbConnection) {
        options.db = finalDbConnection;
      }

      // Check for AI analysis options
      const useAI = config.get<boolean>('aiAnalysis', false);
      if (useAI) {
        options.aiAnalysis = true;
        const useOllama = config.get<boolean>('useOllama', false);
        if (useOllama) {
          options.useOllama = true;
          const ollamaModel = config.get<string>('ollamaModel', '');
          const ollamaUrl = config.get<string>('ollamaUrl', '');
          if (ollamaModel) options.ollamaModel = ollamaModel;
          if (ollamaUrl) options.ollamaUrl = ollamaUrl;
        } else {
          const openaiKey = config.get<string>('openaiApiKey', '');
          if (openaiKey) {
            options.openaiApiKey = openaiKey;
          }
        }
      }

      // Set output path
      const workspaceFolder = workspaceFolders[0];
      options.output = getScanResultsPath(workspaceFolder);

      const result = await this.cliRunner.executeCliCommand('scan', options);

      if (result.success) {
        vscode.window.showInformationMessage('✅ DevSync: Scan completed successfully!');
        this.sidebarProvider.refresh();
      } else {
        vscode.window.showErrorMessage(
          `❌ DevSync: Scan failed - ${result.error || 'Unknown error'}`
        );
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `❌ DevSync: Scan error - ${error.message || 'Unknown error'}`
      );
    } finally {
      await this.sidebarProvider.setScanning(false);
    }
  }

  async migrate(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    // Check if CLI is available
    const cliAvailable = await this.cliRunner.checkCliAvailable();
    if (!cliAvailable) {
      const build = await vscode.window.showWarningMessage(
        'CLI not built. Would you like to build it now?',
        'Yes',
        'No'
      );
      
      if (build === 'Yes') {
        await this.buildCli();
        return;
      } else {
        return;
      }
    }

    // Get database connection (required for migrate)
    const config = vscode.workspace.getConfiguration('devsync');
    let dbConnection = config.get<string>('databaseConnection', '');
    
    if (!dbConnection) {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter database connection string (required)',
        placeHolder: 'postgresql://user:password@host:port/database',
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (!value || value.trim() === '') {
            return 'Database connection string is required';
          }
          return null;
        }
      });
      
      if (!input) {
        return; // User cancelled
      }
      dbConnection = input;
    }

    // Ask for dry-run preference
    const dryRun = await vscode.window.showQuickPick(
      ['Yes (dry-run)', 'No (generate file)'],
      {
        placeHolder: 'Generate migration as dry-run?'
      }
    );

    if (dryRun === undefined) {
      return; // User cancelled
    }

    await this.sidebarProvider.setMigrating(true);
    this.cliRunner.showOutput();

    try {
      const workspaceFolder = workspaceFolders[0];
      const outputDir = ensureMigrationsDir(workspaceFolder);
      const outputPath = join(outputDir, generateMigrationFilename('sql'));

      const options: Record<string, any> = {
        db: dbConnection,
        output: outputPath,
        format: 'sql'
      };

      if (dryRun === 'Yes (dry-run)') {
        options.dryRun = true;
      }

      const result = await this.cliRunner.executeCliCommand('migrate', options);

      if (result.success) {
        if (dryRun === 'Yes (dry-run)') {
          vscode.window.showInformationMessage('✅ DevSync: Migration preview generated!');
        } else {
          vscode.window.showInformationMessage('✅ DevSync: Migration file generated!');
          // Open the migration file
          const doc = await vscode.workspace.openTextDocument(outputPath);
          await vscode.window.showTextDocument(doc);
        }
        this.sidebarProvider.refresh();
      } else {
        vscode.window.showErrorMessage(
          `❌ DevSync: Migration generation failed - ${result.error || 'Unknown error'}`
        );
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `❌ DevSync: Migration error - ${error.message || 'Unknown error'}`
      );
    } finally {
      await this.sidebarProvider.setMigrating(false);
    }
  }

  async init(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    // Check if CLI is available
    const cliAvailable = await this.cliRunner.checkCliAvailable();
    if (!cliAvailable) {
      const build = await vscode.window.showWarningMessage(
        'CLI not built. Would you like to build it now?',
        'Yes',
        'No'
      );
      
      if (build === 'Yes') {
        await this.buildCli();
        return;
      } else {
        return;
      }
    }

    this.cliRunner.showOutput();

    try {
      const result = await this.cliRunner.executeCliCommand('init', {});

      if (result.success) {
        vscode.window.showInformationMessage('✅ DevSync: Project initialized successfully!');
        this.sidebarProvider.refresh();
        
        // Open config file if created
        const { getConfigPath } = await import('./utils/paths');
        const configPath = getConfigPath(workspaceFolders[0]);
        const { existsSync } = await import('fs');
        if (existsSync(configPath)) {
          const doc = await vscode.workspace.openTextDocument(configPath);
          await vscode.window.showTextDocument(doc);
        }
      } else {
        vscode.window.showErrorMessage(
          `❌ DevSync: Initialization failed - ${result.error || 'Unknown error'}`
        );
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `❌ DevSync: Initialization error - ${error.message || 'Unknown error'}`
      );
    }
  }

  async viewFix(mismatch: import('./api').Mismatch): Promise<void> {
    if (!mismatch || !mismatch.suggestedFix) {
      vscode.window.showWarningMessage('No suggested fix available for this mismatch');
      return;
    }

    // Try to show inline diff preview if source file exists
    const sourceFile = await this.findSourceFile(mismatch);
    if (sourceFile) {
      await this.showInlineDiffPreview(mismatch, sourceFile);
      return;
    }

    // Fallback: Create a new document with the fix
    const doc = await vscode.workspace.openTextDocument({
      content: mismatch.suggestedFix,
      language: 'sql'
    });

    await vscode.window.showTextDocument(doc);
  }

  /**
   * Jump to source file for a mismatch (Prisma schema, TypeORM entity, etc.)
   */
  async jumpToSource(mismatch: import('./api').Mismatch): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    let sourceFile: { filePath: string; lineNumber?: number } | null = null;
    try {
      sourceFile = await this.findSourceFile(mismatch);
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to search for source file: ${error.message || 'Unknown error'}`
      );
      return;
    }

    if (!sourceFile) {
      vscode.window.showWarningMessage(
        `Could not find source file for model "${mismatch.model}". Try searching for schema files manually.`
      );
      return;
    }

    try {
      const doc = await vscode.workspace.openTextDocument(sourceFile.filePath);
      const editor = await vscode.window.showTextDocument(doc);
      
      // Try to navigate to the model/field
      if (sourceFile.lineNumber) {
        const line = Math.max(0, sourceFile.lineNumber - 1);
        const range = new vscode.Range(line, 0, line, 0);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(range.start, range.start);
      } else {
        // Search for the model name in the file
        const text = doc.getText();
        const escapedModel = this.escapeRegex(mismatch.model);
        const modelRegex = new RegExp(`(model|entity|table)\\s+${escapedModel}\\b`, 'i');
        const match = text.match(modelRegex);
        if (match && match.index !== undefined) {
          const position = doc.positionAt(match.index);
          const range = new vscode.Range(position, position);
          editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
          editor.selection = new vscode.Selection(range.start, range.start);
        }
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to open source file: ${error.message}`);
    }
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Find source file for a mismatch
   */
  private async findSourceFile(mismatch: import('./api').Mismatch): Promise<{ filePath: string; lineNumber?: number } | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    const root = workspaceFolders[0].uri.fsPath;
    const { glob } = await import('glob');
    const path = await import('path');
    const fs = await import('fs');

    // Escape the model name for safe regex use
    const escapedModel = this.escapeRegex(mismatch.model);

    try {
      // Search for Prisma schema files
      const prismaFiles = await glob('**/schema.prisma', { cwd: root, absolute: true });
      for (const file of prismaFiles) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const modelRegex = new RegExp(`model\\s+${escapedModel}\\b`, 'i');
          if (modelRegex.test(content)) {
            // Find line number
            const lines = content.split('\n');
            const lineIndex = lines.findIndex((line) => modelRegex.test(line));
            return { filePath: file, lineNumber: lineIndex >= 0 ? lineIndex + 1 : undefined };
          }
        } catch (error) {
          // Skip files that can't be read (permissions, etc.)
          continue;
        }
      }

      // Search for TypeORM entities
      const tsFiles = await glob('**/*.entity.ts', { cwd: root, absolute: true });
      for (const file of tsFiles) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const entityRegex = new RegExp(`(class|export\\s+class)\\s+${escapedModel}\\b`, 'i');
          if (entityRegex.test(content)) {
            const lines = content.split('\n');
            const lineIndex = lines.findIndex((line) => entityRegex.test(line));
            return { filePath: file, lineNumber: lineIndex >= 0 ? lineIndex + 1 : undefined };
          }
        } catch (error) {
          // Skip files that can't be read (permissions, etc.)
          continue;
        }
      }

      // Search for Drizzle schemas
      const drizzleFiles = await glob('**/*schema*.ts', { cwd: root, absolute: true });
      for (const file of drizzleFiles) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          if (content.includes('pgTable') || content.includes('mysqlTable')) {
            const tableRegex = new RegExp(`(pgTable|mysqlTable)\\s*\\(\\s*['"]${escapedModel}['"]`, 'i');
            if (tableRegex.test(content)) {
              const lines = content.split('\n');
              const lineIndex = lines.findIndex((line) => tableRegex.test(line));
              return { filePath: file, lineNumber: lineIndex >= 0 ? lineIndex + 1 : undefined };
            }
          }
        } catch (error) {
          // Skip files that can't be read (permissions, etc.)
          continue;
        }
      }
    } catch (error) {
      // Re-throw errors from glob operations or other failures
      throw error;
    }

    return null;
  }

  /**
   * Show inline diff preview for a fix
   */
  private async showInlineDiffPreview(mismatch: import('./api').Mismatch, sourceFile: { filePath: string; lineNumber?: number }): Promise<void> {
    try {
      const doc = await vscode.workspace.openTextDocument(sourceFile.filePath);
      const originalText = doc.getText();

      // Create a simple diff view by opening the original and suggested fix side by side
      // For now, show the fix in a new document with a note
      const fixDoc = await vscode.workspace.openTextDocument({
        content: `// Suggested Fix for ${mismatch.model}${'field' in mismatch ? `.${mismatch.field}` : ''}\n// Original file: ${sourceFile.filePath}\n\n${mismatch.suggestedFix || 'No fix available'}`,
        language: 'sql'
      });

      await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      await vscode.window.showTextDocument(fixDoc, vscode.ViewColumn.Two);

      vscode.window.showInformationMessage(
        `Fix preview opened. Review the suggested fix in the right panel.`
      );
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to show diff preview: ${error.message}`);
    }
  }

  async openConfig(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    const { getConfigPath } = await import('./utils/paths');
    const { existsSync } = await import('fs');
    const configPath = getConfigPath(workspaceFolders[0]);
    
    if (!existsSync(configPath)) {
      const create = await vscode.window.showWarningMessage(
        'Config file not found. Would you like to initialize the project?',
        'Yes',
        'No'
      );
      
      if (create === 'Yes') {
        await this.init();
      }
      return;
    }

    const doc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(doc);
  }

  async showOutput(): Promise<void> {
    this.cliRunner.showOutput();
  }

  /**
   * Execute the status command to check schema readiness and conflicts.
   */
  async status(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    // Check if CLI is available
    const cliAvailable = await this.cliRunner.checkCliAvailable();
    if (!cliAvailable) {
      const build = await vscode.window.showWarningMessage(
        'CLI not built. Would you like to build it now?',
        'Yes',
        'No'
      );
      
      if (build === 'Yes') {
        await this.buildCli();
        return;
      } else {
        return;
      }
    }

    // Get configuration
    const config = vscode.workspace.getConfiguration('devsync');
    const dbConnection = config.get<string>('databaseConnection', '');
    
    this.cliRunner.showOutput();

    try {
      const options: Record<string, any> = {
        format: 'json' // Always use JSON for structured output
      };
      
      if (dbConnection) {
        options.db = dbConnection;
      }

      const result = await this.cliRunner.executeCliCommand('status', options);

      if (result.success) {
        try {
          // Parse JSON output
          const statusData = JSON.parse(result.output);
          
          // Display summary
          const conflicts = statusData.conflicts || [];
          const errorCount = conflicts.filter((c: any) => c.risk === 'High').length;
          const warningCount = conflicts.filter((c: any) => c.risk === 'Medium').length;
          const infoCount = conflicts.filter((c: any) => c.risk === 'Low').length;

          if (conflicts.length === 0) {
            vscode.window.showInformationMessage('✅ DevSync: No conflicts detected. Schema is in sync!');
          } else {
            const message = `DevSync Status: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info`;
            const action = await vscode.window.showWarningMessage(
              message,
              'View Details',
              'Propose Fixes',
              'Dismiss'
            );
            
            if (action === 'View Details') {
              // Show detailed status in output channel
              this.cliRunner.showOutput();
            } else if (action === 'Propose Fixes') {
              await this.fix();
            }
          }
        } catch (parseError) {
          // If JSON parsing fails, show raw output
          vscode.window.showInformationMessage('✅ DevSync: Status check completed');
          this.cliRunner.showOutput();
        }
        this.sidebarProvider.refresh();
      } else {
        vscode.window.showErrorMessage(
          `❌ DevSync: Status check failed - ${result.error || 'Unknown error'}`
        );
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `❌ DevSync: Status error - ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Execute the fix command to propose AI-powered fixes for conflicts.
   * This command requires explicit opt-in for write operations.
   */
  async fix(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    // Check if CLI is available
    const cliAvailable = await this.cliRunner.checkCliAvailable();
    if (!cliAvailable) {
      const build = await vscode.window.showWarningMessage(
        'CLI not built. Would you like to build it now?',
        'Yes',
        'No'
      );
      
      if (build === 'Yes') {
        await this.buildCli();
        return;
      } else {
        return;
      }
    }

    // Get configuration
    const config = vscode.workspace.getConfiguration('devsync');
    let dbConnection = config.get<string>('databaseConnection', '');
    
    if (!dbConnection) {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter database connection string (required for fix)',
        placeHolder: 'postgresql://user:password@host:port/database',
        ignoreFocusOut: true,
        validateInput: (value) => {
          if (!value || value.trim() === '') {
            return 'Database connection string is required';
          }
          return null;
        }
      });
      
      if (!input) {
        return; // User cancelled
      }
      dbConnection = input;
    }

    // Safety: Ask for confirmation and mode
    const mode = await vscode.window.showQuickPick(
      [
        { label: 'Dry Run (Preview Only)', value: 'dry-run', description: 'Show proposed fixes without applying' },
        { label: 'Generate Fix Files', value: 'generate', description: 'Generate fix files for review' },
        { label: 'Apply Fixes (Dangerous)', value: 'apply', description: '⚠️ Apply fixes directly (requires explicit opt-in)' }
      ],
      {
        placeHolder: 'Select fix mode (default: Dry Run)'
      }
    );

    if (mode === undefined) {
      return; // User cancelled
    }

    // Additional safety check for apply mode
    if (mode.value === 'apply') {
      const confirm = await vscode.window.showWarningMessage(
        '⚠️ WARNING: This will apply fixes directly to your codebase and potentially your database. This action cannot be easily undone. Are you sure?',
        { modal: true },
        'Yes, Apply Fixes',
        'Cancel'
      );
      
      if (confirm !== 'Yes, Apply Fixes') {
        return; // User cancelled
      }

      // Final confirmation for database writes
      const dbConfirm = await vscode.window.showWarningMessage(
        '⚠️ CRITICAL: This will write to your database. Ensure you have backups. Continue?',
        { modal: true },
        'Yes, I have backups',
        'Cancel'
      );
      
      if (dbConfirm !== 'Yes, I have backups') {
        return; // User cancelled
      }
    }

    // Get AI configuration
    const useAI = config.get<boolean>('aiAnalysis', false);
    const aiProvider = config.get<'openai' | 'anthropic' | 'ollama'>('aiProvider', 'openai');
    const openaiKey = config.get<string>('openaiApiKey', '');
    const anthropicKey = config.get<string>('anthropicApiKey', '');
    const useOllama = config.get<boolean>('useOllama', false);
    const ollamaModel = config.get<string>('ollamaModel', '');
    const ollamaUrl = config.get<string>('ollamaUrl', '');

    this.cliRunner.showOutput();

    try {
      const options: Record<string, any> = {
        format: 'json',
        dbConnection: dbConnection
      };

      // Set AI options if configured
      if (useAI) {
        options.aiProvider = aiProvider;
        if (aiProvider === 'openai' && openaiKey) {
          options.openaiApiKey = openaiKey;
        } else if (aiProvider === 'anthropic' && anthropicKey) {
          options.anthropicApiKey = anthropicKey;
        } else if (aiProvider === 'ollama' && useOllama) {
          options.useOllama = true;
          if (ollamaModel) options.ollamaModel = ollamaModel;
          if (ollamaUrl) options.ollamaUrl = ollamaUrl;
        }
      }

      // Set mode flags
      if (mode.value === 'dry-run') {
        options.dryRun = true;
      } else if (mode.value === 'apply') {
        options.apply = true;
        options.allowWrites = true;
        options.allowDbWrites = true;
      }

      const result = await this.cliRunner.executeCliCommand('fix', options);

      if (result.success) {
        try {
          // Parse JSON output
          const fixData = JSON.parse(result.output);
          
          if (fixData.proposals && fixData.proposals.length > 0) {
            const proposalCount = fixData.proposals.length;
            const message = `✅ DevSync: Generated ${proposalCount} fix proposal${proposalCount === 1 ? '' : 's'}`;
            
            if (mode.value === 'dry-run') {
              const action = await vscode.window.showInformationMessage(
                message,
                'View Proposals',
                'Apply Fixes',
                'Dismiss'
              );
              
              if (action === 'View Proposals') {
                // Show proposals in output channel
                this.cliRunner.showOutput();
              } else if (action === 'Apply Fixes') {
                // Re-run with apply mode
                options.dryRun = false;
                options.apply = true;
                options.allowWrites = true;
                await this.cliRunner.executeCliCommand('fix', options);
              }
            } else if (mode.value === 'apply') {
              vscode.window.showInformationMessage('✅ DevSync: Fixes applied successfully');
            } else {
              vscode.window.showInformationMessage(message);
            }
          } else {
            vscode.window.showInformationMessage('✅ DevSync: No fixes needed. Schema is in sync!');
          }
        } catch (parseError) {
          // If JSON parsing fails, show raw output
          vscode.window.showInformationMessage('✅ DevSync: Fix command completed');
          this.cliRunner.showOutput();
        }
        this.sidebarProvider.refresh();
      } else {
        vscode.window.showErrorMessage(
          `❌ DevSync: Fix failed - ${result.error || 'Unknown error'}`
        );
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `❌ DevSync: Fix error - ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Execute the apply command to apply previously generated fixes.
   * This command is strictly blocked by default and requires explicit opt-in.
   */
  async apply(): Promise<void> {
    // Safety: This command is blocked by default
    const confirm = await vscode.window.showWarningMessage(
      '⚠️ WARNING: The apply command is currently blocked for safety. Use the fix command with --apply flag instead, which includes proper safety checks and previews.',
      { modal: true },
      'I Understand',
      'Cancel'
    );

    if (confirm !== 'I Understand') {
      return;
    }

    vscode.window.showInformationMessage(
      '💡 Tip: Use "DevSync: Propose Fixes" command instead, which includes safety previews and proper confirmation workflows.'
    );
  }

  private async buildCli(): Promise<void> {
    this.cliRunner.showOutput();
    
    const result = await this.cliRunner.buildCli();
    
    if (result.success) {
      vscode.window.showInformationMessage('✅ CLI built successfully!');
    } else {
      vscode.window.showErrorMessage(
        `❌ CLI build failed - ${result.error || 'Unknown error'}`
      );
    }
  }
}

