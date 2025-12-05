/**
 * Interactive tutorials system.
 * 
 * Provides step-by-step interactive tutorials for learning DevSync features.
 */

import * as vscode from 'vscode';
import { HelpContent } from './content';

/**
 * Tutorial step.
 */
export interface TutorialStep {
  /** Step title */
  title: string;
  /** Step description */
  description: string;
  /** Step instructions (markdown) */
  instructions: string;
  /** Optional action to perform */
  action?: {
    command: string;
    args?: any[];
  };
  /** Whether step is optional */
  optional?: boolean;
}

/**
 * Tutorial configuration.
 */
export interface TutorialConfig {
  /** Tutorial ID */
  id: string;
  /** Tutorial title */
  title: string;
  /** Tutorial description */
  description: string;
  /** Tutorial steps */
  steps: TutorialStep[];
  /** Estimated duration in minutes */
  duration?: number;
}

/**
 * Tutorial manager.
 */
export class TutorialManager {
  private static tutorials: Map<string, TutorialConfig> = new Map();
  private static activeTutorial: {
    tutorialId: string;
    currentStep: number;
    panel: vscode.WebviewPanel;
  } | null = null;

  /**
   * Registers a tutorial.
   */
  static registerTutorial(config: TutorialConfig): void {
    this.tutorials.set(config.id, config);
  }

  /**
   * Starts a tutorial.
   */
  static async startTutorial(
    context: vscode.ExtensionContext,
    tutorialId: string
  ): Promise<void> {
    const tutorial = this.tutorials.get(tutorialId);
    if (!tutorial) {
      vscode.window.showErrorMessage(`Tutorial "${tutorialId}" not found`);
      return;
    }

    // Close existing tutorial if any
    if (this.activeTutorial) {
      this.activeTutorial.panel.dispose();
    }

    // Create tutorial panel
    const panel = vscode.window.createWebviewPanel(
      'devsyncTutorial',
      tutorial.title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    // Initialize tutorial state
    this.activeTutorial = {
      tutorialId,
      currentStep: 0,
      panel,
    };

    // Show first step
    this.showStep(context, 0);

    // Handle messages
    panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'nextStep':
            this.showStep(context, this.activeTutorial!.currentStep + 1);
            break;
          case 'prevStep':
            this.showStep(context, this.activeTutorial!.currentStep - 1);
            break;
          case 'complete':
            this.completeTutorial();
            break;
          case 'executeAction':
            if (tutorial.steps[this.activeTutorial!.currentStep]?.action) {
              const action = tutorial.steps[this.activeTutorial!.currentStep].action!;
              vscode.commands.executeCommand(action.command, ...(action.args || []));
            }
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    // Clean up on dispose
    panel.onDidDispose(() => {
      this.activeTutorial = null;
    });
  }

  /**
   * Shows a tutorial step.
   */
  private static showStep(context: vscode.ExtensionContext, stepIndex: number): void {
    if (!this.activeTutorial) {
      return;
    }

    const tutorial = this.tutorials.get(this.activeTutorial.tutorialId)!;
    
    if (stepIndex < 0 || stepIndex >= tutorial.steps.length) {
      return;
    }

    this.activeTutorial.currentStep = stepIndex;
    const step = tutorial.steps[stepIndex];

    // Update panel content
    this.activeTutorial.panel.webview.html = this.getStepContent(tutorial, stepIndex);
  }

  /**
   * Completes the tutorial.
   */
  private static completeTutorial(): void {
    if (this.activeTutorial) {
      vscode.window.showInformationMessage('Tutorial completed! 🎉');
      this.activeTutorial.panel.dispose();
      this.activeTutorial = null;
    }
  }

  /**
   * Gets step HTML content.
   */
  private static getStepContent(tutorial: TutorialConfig, stepIndex: number): string {
    const step = tutorial.steps[stepIndex];
    const totalSteps = tutorial.steps.length;
    const progress = ((stepIndex + 1) / totalSteps) * 100;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${tutorial.title}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .progress {
            width: 100%;
            height: 8px;
            background-color: var(--vscode-progressBar-background);
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .progress-bar {
            height: 100%;
            background-color: var(--vscode-progressBar-foreground);
            border-radius: 4px;
            width: ${progress}%;
            transition: width 0.3s;
        }
        .step-info {
            color: var(--vscode-descriptionForeground);
            margin-bottom: 20px;
        }
        h1 {
            color: var(--vscode-textLink-foreground);
        }
        h2 {
            color: var(--vscode-textLink-foreground);
            margin-top: 20px;
        }
        .actions {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 10px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 3px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .action-button {
            background-color: var(--vscode-button-secondaryBackground);
        }
    </style>
</head>
<body>
    <h1>${tutorial.title}</h1>
    <div class="step-info">Step ${stepIndex + 1} of ${totalSteps}</div>
    <div class="progress">
        <div class="progress-bar"></div>
    </div>
    <h2>${step.title}</h2>
    <div>${this.markdownToHtml(step.description)}</div>
    <div>${this.markdownToHtml(step.instructions)}</div>
    ${step.action ? `<button class="action-button" onclick="executeAction()">▶️ ${step.action.command}</button>` : ''}
    <div class="actions">
        <button onclick="prevStep()" ${stepIndex === 0 ? 'disabled' : ''}>← Previous</button>
        <button onclick="nextStep()" ${stepIndex === totalSteps - 1 ? 'onclick="complete()"' : ''}>
            ${stepIndex === totalSteps - 1 ? '✓ Complete' : 'Next →'}
        </button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        function nextStep() {
            vscode.postMessage({ command: 'nextStep' });
        }
        function prevStep() {
            vscode.postMessage({ command: 'prevStep' });
        }
        function complete() {
            vscode.postMessage({ command: 'complete' });
        }
        function executeAction() {
            vscode.postMessage({ command: 'executeAction' });
        }
    </script>
</body>
</html>`;
  }

  /**
   * Converts markdown to HTML (simplified).
   */
  private static markdownToHtml(markdown: string): string {
    return markdown
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
      .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\n/g, '<br>');
  }

  /**
   * Initializes default tutorials.
   */
  static initializeDefaultTutorials(): void {
    // Getting Started Tutorial
    this.registerTutorial({
      id: 'getting-started',
      title: 'Getting Started with DevSync',
      description: 'Learn the basics of using DevSync',
      duration: 5,
      steps: [
        {
          title: 'Welcome',
          description: 'Welcome to DevSync!',
          instructions: 'This tutorial will guide you through the basics of using DevSync to detect and fix schema mismatches.',
        },
        {
          title: 'Run Your First Scan',
          description: 'Scan your Prisma schema',
          instructions: 'Click the "Scan Schema" button in the sidebar or use the command palette to run your first scan.',
          action: {
            command: 'devsync.scan',
          },
        },
        {
          title: 'Review Mismatches',
          description: 'View detected mismatches',
          instructions: 'After the scan completes, review the mismatches in the sidebar. Each mismatch shows the model, field, and type of issue.',
        },
        {
          title: 'Generate Migration',
          description: 'Create a migration',
          instructions: 'Click "Generate Migration" to create SQL migration files that will fix the detected mismatches.',
          action: {
            command: 'devsync.generateMigration',
          },
        },
      ],
    });
  }
}

