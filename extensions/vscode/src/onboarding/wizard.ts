/**
 * Interactive setup wizard for DevSync onboarding.
 * 
 * Guides users through initial configuration with step-by-step setup,
 * automatic detection, and validation.
 */

import * as vscode from 'vscode';
import { IConfigurationManager } from '../interfaces';
import { PrismaSchemaDetector } from './schemaDetector';
import { DatabaseConnectionTester } from './connectionTester';

/**
 * Wizard step definition.
 */
export interface WizardStep {
  id: string;
  title: string;
  description: string;
  validate?: (data: WizardData) => Promise<ValidationResult>;
  execute: (data: WizardData) => Promise<WizardStepResult>;
}

/**
 * Validation result for wizard steps.
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Result from executing a wizard step.
 */
export interface WizardStepResult {
  success: boolean;
  data?: Partial<WizardData>;
  error?: string;
  nextStep?: string;
}

/**
 * Data collected during wizard execution.
 */
export interface WizardData {
  apiUrl?: string;
  projectId?: string;
  databaseConnection?: string;
  prismaSchemaPath?: string;
  autoScan?: boolean;
  enableDiagnostics?: boolean;
}

/**
 * Interactive setup wizard for DevSync.
 */
export class OnboardingWizard {
  private currentStepIndex = 0;
  private data: WizardData = {};
  private steps: WizardStep[] = [];

  constructor(
    private context: vscode.ExtensionContext,
    private configManager: IConfigurationManager,
    private schemaDetector: PrismaSchemaDetector,
    private connectionTester: DatabaseConnectionTester
  ) {
    this.initializeSteps();
  }

  /**
   * Initializes wizard steps.
   */
  private initializeSteps(): void {
    this.steps = [
      {
        id: 'welcome',
        title: 'Welcome to DevSync',
        description: 'Let\'s get you started with DevSync in a few simple steps.',
        execute: async () => this.executeWelcomeStep(),
      },
      {
        id: 'detect-schema',
        title: 'Detect Prisma Schema',
        description: 'We\'ll automatically detect your Prisma schema files.',
        execute: async () => this.executeDetectSchemaStep(),
      },
      {
        id: 'api-config',
        title: 'API Configuration',
        description: 'Configure your DevSync API connection.',
        validate: async (data) => this.validateApiConfig(data),
        execute: async () => this.executeApiConfigStep(),
      },
      {
        id: 'database-connection',
        title: 'Database Connection',
        description: 'Test your database connection.',
        validate: async (data) => this.validateDatabaseConnection(data),
        execute: async () => this.executeDatabaseConnectionStep(),
      },
      {
        id: 'features',
        title: 'Feature Selection',
        description: 'Choose which features to enable.',
        execute: async () => this.executeFeaturesStep(),
      },
      {
        id: 'complete',
        title: 'Setup Complete',
        description: 'Your DevSync setup is complete!',
        execute: async () => this.executeCompleteStep(),
      },
    ];
  }

  /**
   * Starts the onboarding wizard.
   */
  async start(): Promise<void> {
    this.currentStepIndex = 0;
    this.data = {};

    // Check if onboarding was already completed
    const onboardingCompleted = this.context.globalState.get<boolean>('devsync.onboarding.completed', false);
    if (onboardingCompleted) {
      const restart = await vscode.window.showInformationMessage(
        'Onboarding was already completed. Would you like to run it again?',
        'Restart Onboarding',
        'Skip'
      );
      if (restart !== 'Restart Onboarding') {
        return;
      }
    }

    await this.runWizard();
  }

  /**
   * Runs the wizard through all steps.
   */
  private async runWizard(): Promise<void> {
    while (this.currentStepIndex < this.steps.length) {
      const step = this.steps[this.currentStepIndex];
      
      try {
        // Show step UI
        const result = await this.showStep(step);
        
        if (result.cancelled) {
          const shouldCancel = await vscode.window.showWarningMessage(
            'Are you sure you want to cancel the setup? You can complete it later.',
            'Yes, Cancel',
            'Continue'
          );
          if (shouldCancel === 'Yes, Cancel') {
            return;
          }
          continue;
        }

        // Execute step
        const stepResult = await step.execute(this.data);
        
        if (!stepResult.success) {
          const retry = await vscode.window.showErrorMessage(
            stepResult.error || 'An error occurred. Would you like to retry?',
            'Retry',
            'Skip',
            'Cancel'
          );
          
          if (retry === 'Cancel') {
            return;
          }
          if (retry === 'Skip') {
            this.currentStepIndex++;
            continue;
          }
          // Retry current step
          continue;
        }

        // Merge step data
        if (stepResult.data) {
          this.data = { ...this.data, ...stepResult.data };
        }

        // Move to next step
        if (stepResult.nextStep) {
          const nextIndex = this.steps.findIndex(s => s.id === stepResult.nextStep);
          if (nextIndex >= 0) {
            this.currentStepIndex = nextIndex;
          } else {
            this.currentStepIndex++;
          }
        } else {
          this.currentStepIndex++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const action = await vscode.window.showErrorMessage(
          `Error in step "${step.title}": ${errorMessage}`,
          'Retry',
          'Skip',
          'Cancel'
        );
        
        if (action === 'Cancel') {
          return;
        }
        if (action === 'Skip') {
          this.currentStepIndex++;
        }
        // Retry on 'Retry'
      }
    }

    // Mark onboarding as completed
    await this.context.globalState.update('devsync.onboarding.completed', true);
  }

  /**
   * Shows a wizard step UI.
   */
  private async showStep(step: WizardStep): Promise<{ cancelled: boolean; data?: Partial<WizardData> }> {
    const panel = vscode.window.createWebviewPanel(
      'devsyncOnboarding',
      `DevSync Setup - ${step.title}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
      }
    );

    return new Promise((resolve) => {
      let resolved = false; // Track if promise has been resolved
      
      const safeResolve = (value: { cancelled: boolean; data?: Partial<WizardData> }) => {
        if (!resolved) {
          resolved = true;
          resolve(value);
        }
      };

      panel.webview.html = this.getStepHtml(step, panel.webview);

      panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
          case 'next':
            safeResolve({ cancelled: false, data: message.data });
            panel.dispose();
            break;
          case 'back':
            if (this.currentStepIndex > 0) {
              this.currentStepIndex--;
            }
            safeResolve({ cancelled: false });
            panel.dispose();
            break;
          case 'cancel':
            safeResolve({ cancelled: true });
            panel.dispose();
            break;
          case 'validate':
            if (step.validate) {
              const validation = await step.validate(message.data);
              panel.webview.postMessage({
                command: 'validation',
                result: validation,
              });
            }
            break;
        }
      });

      // Only resolve as cancelled if panel is disposed without a command being handled
      // This prevents race condition where dispose() is called after 'next' command
      panel.onDidDispose(() => {
        if (!resolved) {
          safeResolve({ cancelled: true });
        }
      });
    });
  }

  /**
   * Generates HTML for a wizard step.
   */
  private getStepHtml(step: WizardStep, webview: vscode.Webview): string {
    const stepNumber = this.currentStepIndex + 1;
    const totalSteps = this.steps.length;
    const progress = ((stepNumber / totalSteps) * 100).toFixed(0);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${step.title}</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    .header {
      margin-bottom: 30px;
    }
    .progress-bar {
      width: 100%;
      height: 4px;
      background-color: var(--vscode-progressBar-background);
      border-radius: 2px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background-color: var(--vscode-progressBar-foreground);
      width: ${progress}%;
      transition: width 0.3s ease;
    }
    .step-title {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .step-description {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 30px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
    }
    input, textarea, select {
      width: 100%;
      padding: 8px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      font-family: var(--vscode-font-family);
    }
    .error {
      color: var(--vscode-errorForeground);
      margin-top: 5px;
      font-size: 12px;
    }
    .suggestion {
      color: var(--vscode-descriptionForeground);
      margin-top: 5px;
      font-size: 12px;
      font-style: italic;
    }
    .buttons {
      display: flex;
      justify-content: space-between;
      margin-top: 30px;
    }
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-weight: 500;
    }
    .btn-primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-primary:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    .btn-secondary {
      background-color: transparent;
      color: var(--vscode-foreground);
      border: 1px solid var(--vscode-input-border);
    }
    .info-box {
      background-color: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textBlockQuote-border);
      padding: 12px;
      margin: 20px 0;
      border-radius: 2px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>
    <div class="step-title">${step.title}</div>
    <div class="step-description">${step.description}</div>
  </div>
  
  <div id="step-content">
    ${this.getStepContent(step)}
  </div>
  
  <div class="buttons">
    <div>
      ${this.currentStepIndex > 0 ? '<button class="btn-secondary" onclick="goBack()">Back</button>' : ''}
      <button class="btn-secondary" onclick="cancel()">Cancel</button>
    </div>
    <button class="btn-primary" onclick="next()">${this.currentStepIndex === this.steps.length - 1 ? 'Complete' : 'Next'}</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentData = ${JSON.stringify(this.data)};

    function next() {
      const data = collectData();
      vscode.postMessage({
        command: 'next',
        data: data
      });
    }

    function goBack() {
      vscode.postMessage({ command: 'back' });
    }

    function cancel() {
      vscode.postMessage({ command: 'cancel' });
    }

    function collectData() {
      const inputs = document.querySelectorAll('input, textarea, select');
      const data = {};
      inputs.forEach(input => {
        if (input.id) {
          if (input.type === 'checkbox') {
            data[input.id] = input.checked;
          } else {
            data[input.id] = input.value;
          }
        }
      });
      return { ...currentData, ...data };
    }

    function validate() {
      const data = collectData();
      vscode.postMessage({
        command: 'validate',
        data: data
      });
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'validation') {
        const errorEl = document.getElementById('error');
        const suggestionEl = document.getElementById('suggestion');
        if (message.result.valid) {
          if (errorEl) errorEl.textContent = '';
          if (suggestionEl) suggestionEl.textContent = '';
        } else {
          if (errorEl) errorEl.textContent = message.result.error || '';
          if (suggestionEl) suggestionEl.textContent = message.result.suggestion || '';
        }
      }
    });

    // Auto-validate on input
    document.addEventListener('input', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        validate();
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * Gets step-specific content HTML.
   */
  private getStepContent(step: WizardStep): string {
    switch (step.id) {
      case 'welcome':
        return this.getWelcomeContent();
      case 'detect-schema':
        return this.getDetectSchemaContent();
      case 'api-config':
        return this.getApiConfigContent();
      case 'database-connection':
        return this.getDatabaseConnectionContent();
      case 'features':
        return this.getFeaturesContent();
      case 'complete':
        return this.getCompleteContent();
      default:
        return '<p>Step content not implemented.</p>';
    }
  }

  /**
   * Welcome step content.
   */
  private getWelcomeContent(): string {
    return `
      <div class="info-box">
        <p>Welcome to DevSync! This wizard will help you:</p>
        <ul>
          <li>Detect your Prisma schema files</li>
          <li>Configure API connection</li>
          <li>Test database connection</li>
          <li>Enable features you need</li>
        </ul>
        <p>This should only take a few minutes.</p>
      </div>
    `;
  }

  /**
   * Detect schema step content.
   */
  private getDetectSchemaContent(): string {
    const detected = this.data.prismaSchemaPath || 'Not detected';
    return `
      <div class="form-group">
        <label>Detected Prisma Schema:</label>
        <input type="text" id="prismaSchemaPath" value="${detected}" readonly />
        <div class="suggestion">We'll automatically detect your schema. You can change this later in settings.</div>
      </div>
    `;
  }

  /**
   * API config step content.
   */
  private getApiConfigContent(): string {
    return `
      <div class="form-group">
        <label>API URL:</label>
        <input type="text" id="apiUrl" value="${this.data.apiUrl || 'http://localhost:3000'}" placeholder="http://localhost:3000" />
        <div id="error" class="error"></div>
        <div id="suggestion" class="suggestion"></div>
      </div>
      <div class="form-group">
        <label>Project ID (optional):</label>
        <input type="text" id="projectId" value="${this.data.projectId || ''}" placeholder="Your project ID" />
      </div>
    `;
  }

  /**
   * Database connection step content.
   */
  private getDatabaseConnectionContent(): string {
    return `
      <div class="form-group">
        <label>Database Connection String:</label>
        <textarea id="databaseConnection" rows="3" placeholder="postgresql://user:password@localhost:5432/dbname">${this.data.databaseConnection || ''}</textarea>
        <div id="error" class="error"></div>
        <div id="suggestion" class="suggestion"></div>
        <div class="suggestion">This will be tested before proceeding. You can skip this step and configure it later.</div>
      </div>
    `;
  }

  /**
   * Features step content.
   */
  private getFeaturesContent(): string {
    return `
      <div class="form-group">
        <label>
          <input type="checkbox" id="autoScan" ${this.data.autoScan !== false ? 'checked' : ''} />
          Enable automatic scanning on file save
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="enableDiagnostics" ${this.data.enableDiagnostics !== false ? 'checked' : ''} />
          Enable inline diagnostics for schema mismatches
        </label>
      </div>
    `;
  }

  /**
   * Complete step content.
   */
  private getCompleteContent(): string {
    return `
      <div class="info-box">
        <h3>🎉 Setup Complete!</h3>
        <p>Your DevSync extension is now configured and ready to use.</p>
        <p><strong>Next steps:</strong></p>
        <ul>
          <li>Run your first scan to detect schema mismatches</li>
          <li>Explore the sidebar to view results</li>
          <li>Use the chat assistant for help</li>
        </ul>
      </div>
    `;
  }

  /**
   * Executes welcome step.
   */
  private async executeWelcomeStep(): Promise<WizardStepResult> {
    return { success: true };
  }

  /**
   * Executes detect schema step.
   */
  private async executeDetectSchemaStep(): Promise<WizardStepResult> {
    const detected = await this.schemaDetector.detect();
    return {
      success: true,
      data: {
        prismaSchemaPath: detected || undefined,
      },
    };
  }

  /**
   * Executes API config step.
   */
  private async executeApiConfigStep(): Promise<WizardStepResult> {
    // Data is collected from the form
    return { success: true };
  }

  /**
   * Executes database connection step.
   */
  private async executeDatabaseConnectionStep(): Promise<WizardStepResult> {
    if (!this.data.databaseConnection) {
      // Skip if no connection string provided
      return { success: true };
    }

    const testResult = await this.connectionTester.test(this.data.databaseConnection);
    if (!testResult.success) {
      return {
        success: false,
        error: testResult.error || 'Database connection test failed',
      };
    }

    return { success: true };
  }

  /**
   * Executes features step.
   */
  private async executeFeaturesStep(): Promise<WizardStepResult> {
    // Data is collected from the form
    return { success: true };
  }

  /**
   * Executes complete step and saves configuration.
   */
  private async executeCompleteStep(): Promise<WizardStepResult> {
    // Save all configuration
    const config = this.configManager;
    
    if (this.data.apiUrl) {
      await config.update('apiUrl', this.data.apiUrl);
    }
    if (this.data.projectId) {
      await config.update('projectId', this.data.projectId);
    }
    if (this.data.databaseConnection) {
      await config.update('databaseConnection', this.data.databaseConnection);
    }
    if (this.data.autoScan !== undefined) {
      await config.update('autoScan', this.data.autoScan);
    }
    if (this.data.enableDiagnostics !== undefined) {
      await config.update('enableDiagnostics', this.data.enableDiagnostics);
    }

    return { success: true };
  }

  /**
   * Validates API configuration.
   */
  private async validateApiConfig(data: WizardData): Promise<ValidationResult> {
    if (!data.apiUrl) {
      return {
        valid: false,
        error: 'API URL is required',
        suggestion: 'Please enter a valid API URL',
      };
    }

    try {
      const url = new URL(data.apiUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return {
          valid: false,
          error: 'Invalid URL protocol',
          suggestion: 'URL must start with http:// or https://',
        };
      }
    } catch {
      return {
        valid: false,
        error: 'Invalid URL format',
        suggestion: 'Please enter a valid URL (e.g., http://localhost:3000)',
      };
    }

    return { valid: true };
  }

  /**
   * Validates database connection.
   */
  private async validateDatabaseConnection(data: WizardData): Promise<ValidationResult> {
    if (!data.databaseConnection) {
      return {
        valid: true, // Optional field
      };
    }

    // Basic validation - connection string should contain @
    if (!data.databaseConnection.includes('@')) {
      return {
        valid: false,
        error: 'Invalid connection string format',
        suggestion: 'Connection string should be in format: postgresql://user:password@host:port/database',
      };
    }

    return { valid: true };
  }
}

