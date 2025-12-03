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

    // Create a new document with the fix
    const doc = await vscode.workspace.openTextDocument({
      content: mismatch.suggestedFix,
      language: 'sql'
    });

    await vscode.window.showTextDocument(doc);
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

