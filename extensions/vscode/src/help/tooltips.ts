/**
 * Contextual tooltips system.
 * 
 * Provides tooltips for all UI elements with contextual information.
 */

import * as vscode from 'vscode';
import { HelpContent } from './content';

/**
 * Tooltip configuration.
 */
export interface TooltipConfig {
  /** Tooltip text */
  text: string;
  /** Optional markdown content */
  markdown?: string;
  /** Optional link to documentation */
  docLink?: string;
  /** Optional video guide link */
  videoLink?: string;
}

/**
 * Tooltip manager.
 */
export class TooltipManager {
  private static tooltips: Map<string, TooltipConfig> = new Map();

  /**
   * Registers a tooltip for a UI element.
   */
  static register(elementId: string, config: TooltipConfig): void {
    this.tooltips.set(elementId, config);
  }

  /**
   * Gets tooltip configuration for an element.
   */
  static getTooltip(elementId: string): TooltipConfig | undefined {
    return this.tooltips.get(elementId);
  }

  /**
   * Creates a VS Code tree item with tooltip.
   */
  static createTreeItemWithTooltip(
    label: string,
    tooltipId: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ): vscode.TreeItem {
    const item = new vscode.TreeItem(label, collapsibleState);
    const tooltip = this.getTooltip(tooltipId);
    
    if (tooltip) {
      if (tooltip.markdown) {
        const markdown = new vscode.MarkdownString(tooltip.markdown);
        markdown.isTrusted = true;
        if (tooltip.docLink) {
          markdown.appendMarkdown(`\n\n[📚 Documentation](${tooltip.docLink})`);
        }
        if (tooltip.videoLink) {
          markdown.appendMarkdown(`\n\n[🎥 Video Guide](${tooltip.videoLink})`);
        }
        item.tooltip = markdown;
      } else {
        item.tooltip = tooltip.text;
      }
    }

    return item;
  }

  /**
   * Shows a tooltip as a hover provider.
   */
  static createHoverProvider(): vscode.HoverProvider {
    return {
      provideHover: (document, position) => {
        // This would be used for editor hovers
        // Implementation would depend on specific use case
        return undefined;
      },
    };
  }

  /**
   * Initializes default tooltips.
   */
  static initializeDefaultTooltips(): void {
    // Scan command tooltip
    this.register('command.scan', {
      text: 'Scan your Prisma schema and database for mismatches',
      markdown: HelpContent.getTooltip('scan'),
      docLink: 'https://docs.Dev-Sync.dev/scanning',
      videoLink: 'https://docs.Dev-Sync.dev/videos/scanning',
    });

    // Migration command tooltip
    this.register('command.generateMigration', {
      text: 'Generate SQL migration from detected mismatches',
      markdown: HelpContent.getTooltip('migration'),
      docLink: 'https://docs.Dev-Sync.dev/migrations',
      videoLink: 'https://docs.Dev-Sync.dev/videos/migrations',
    });

    // Dashboard command tooltip
    this.register('command.openDashboard', {
      text: 'Open DevSync dashboard in browser',
      markdown: HelpContent.getTooltip('dashboard'),
      docLink: 'https://docs.Dev-Sync.dev/dashboard',
    });

    // Sidebar tooltips
    this.register('sidebar.mismatches', {
      text: 'View detected schema mismatches',
      markdown: HelpContent.getTooltip('mismatches'),
      docLink: 'https://docs.Dev-Sync.dev/mismatches',
    });

    this.register('sidebar.migrations', {
      text: 'View generated migration files',
      markdown: HelpContent.getTooltip('migrations'),
      docLink: 'https://docs.Dev-Sync.dev/migrations',
    });

    // Diagnostic tooltips
    this.register('diagnostic.mismatch', {
      text: 'Schema mismatch detected',
      markdown: HelpContent.getTooltip('diagnostic'),
      docLink: 'https://docs.Dev-Sync.dev/diagnostics',
    });
  }
}

