/**
 * Plugin system interfaces.
 * 
 * Defines contracts for plugins that extend DevSync functionality,
 * including AI providers, command handlers, and third-party integrations.
 */

import * as vscode from 'vscode';
import { ScanReport } from '../api';
import { AiQueryResult } from '../types';

/**
 * Base interface for all DevSync plugins.
 * 
 * All plugins must implement this interface to be registered and used.
 * 
 * @example
 * ```typescript
 * class MyPlugin implements IPlugin {
 *   id = 'my-plugin';
 *   name = 'My Plugin';
 *   version = '1.0.0';
 *   
 *   async activate(context: vscode.ExtensionContext): Promise<void> {
 *     // Plugin initialization
 *   }
 *   
 *   async deactivate(): Promise<void> {
 *     // Plugin cleanup
 *   }
 * }
 * ```
 */
export interface IPlugin {
  /** Unique identifier for the plugin */
  readonly id: string;
  /** Human-readable name of the plugin */
  readonly name: string;
  /** Plugin version */
  readonly version: string;
  /** Optional description of the plugin */
  readonly description?: string;
  /** Optional author information */
  readonly author?: string;

  /**
   * Called when the plugin is activated.
   * 
   * @param context - VS Code extension context
   * @returns Promise that resolves when activation is complete
   */
  activate(context: vscode.ExtensionContext): Promise<void>;

  /**
   * Called when the plugin is deactivated.
   * 
   * @returns Promise that resolves when deactivation is complete
   */
  deactivate(): Promise<void>;
}

/**
 * Interface for AI provider plugins.
 * 
 * Allows plugins to provide custom AI implementations for chat queries.
 * This enables support for different AI backends (OpenAI, Anthropic, etc.)
 * or custom AI services.
 * 
 * @example
 * ```typescript
 * class OpenAIPlugin implements IAiProviderPlugin {
 *   id = 'openai-provider';
 *   name = 'OpenAI Provider';
 *   version = '1.0.0';
 *   
 *   async query(question: string, context: AiQueryContext): Promise<AiQueryResult> {
 *     // Call OpenAI API
 *     const response = await openai.chat.completions.create({
 *       model: 'gpt-4',
 *       messages: [{ role: 'user', content: question }]
 *     });
 *     return {
 *       answer: response.choices[0].message.content,
 *       question,
 *       scanReportId: context.scanReportId
 *     };
 *   }
 * }
 * ```
 */
export interface IAiProviderPlugin extends IPlugin {
  /**
   * Executes an AI query.
   * 
   * @param question - The user's question
   * @param context - Context for the query (scan report, project info, etc.)
   * @param signal - Optional abort signal for cancellation
   * @returns Promise resolving to the AI query result
   */
  query(
    question: string,
    context: AiQueryContext,
    signal?: AbortSignal
  ): Promise<AiQueryResult>;

  /**
   * Gets the display name for this AI provider.
   * 
   * @returns The provider's display name
   */
  getProviderName(): string;

  /**
   * Checks if the provider is configured and ready to use.
   * 
   * @returns True if the provider is ready, false otherwise
   */
  isConfigured(): boolean;

  /**
   * Gets configuration options for this provider.
   * 
   * @returns Array of configuration option definitions
   */
  getConfigurationOptions(): AiProviderConfigOption[];
}

/**
 * Context provided to AI queries.
 */
export interface AiQueryContext {
  /** The scan report ID to use as context */
  scanReportId: string;
  /** Optional project ID */
  projectId?: string;
  /** Optional workspace folder */
  workspaceFolder?: vscode.WorkspaceFolder;
  /** Optional additional context data */
  additionalContext?: Record<string, unknown>;
}

/**
 * Configuration option for an AI provider.
 */
export interface AiProviderConfigOption {
  /** Configuration key */
  key: string;
  /** Display label */
  label: string;
  /** Option description */
  description: string;
  /** Input type */
  type: 'string' | 'number' | 'boolean' | 'password';
  /** Whether this option is required */
  required: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Validation function */
  validate?: (value: unknown) => string | null;
}

/**
 * Interface for command handler plugins.
 * 
 * Allows plugins to register custom commands that can be invoked
 * from the command palette or other UI components.
 * 
 * @example
 * ```typescript
 * class CustomCommandPlugin implements ICommandHandlerPlugin {
 *   id = 'custom-commands';
 *   name = 'Custom Commands';
 *   version = '1.0.0';
 *   
 *   getCommands(): CommandHandler[] {
 *     return [
 *       {
 *         command: 'devsync.custom.action',
 *         title: 'Custom Action',
 *         handler: async () => {
 *           // Execute custom action
 *         }
 *       }
 *     ];
 *   }
 * }
 * ```
 */
export interface ICommandHandlerPlugin extends IPlugin {
  /**
   * Gets the commands provided by this plugin.
   * 
   * @returns Array of command handlers
   */
  getCommands(): CommandHandler[];

  /**
   * Gets command categories for organization.
   * 
   * @returns Map of category names to command IDs
   */
  getCommandCategories?(): Map<string, string[]>;
}

/**
 * Command handler definition.
 */
export interface CommandHandler {
  /** VS Code command ID */
  command: string;
  /** Command title for UI */
  title: string;
  /** Optional command category */
  category?: string;
  /** Command handler function */
  handler: (...args: unknown[]) => Promise<void> | void;
  /** Optional command icon */
  icon?: string;
  /** Optional command description */
  description?: string;
}

/**
 * Interface for integration plugins.
 * 
 * Allows third-party services to integrate with DevSync,
 * such as CI/CD systems, monitoring tools, etc.
 * 
 * @example
 * ```typescript
 * class GitHubIntegrationPlugin implements IIntegrationPlugin {
 *   id = 'github-integration';
 *   name = 'GitHub Integration';
 *   version = '1.0.0';
 *   
 *   async onScanComplete(report: ScanReport): Promise<void> {
 *     // Create GitHub issue for mismatches
 *   }
 * }
 * ```
 */
export interface IIntegrationPlugin extends IPlugin {
  /**
   * Called when a scan completes.
   * 
   * @param report - The completed scan report
   * @returns Promise that resolves when processing is complete
   */
  onScanComplete?(report: ScanReport): Promise<void>;

  /**
   * Called when a migration is generated.
   * 
   * @param migration - The generated migration
   * @returns Promise that resolves when processing is complete
   */
  onMigrationGenerated?(migration: { id: string; filename: string; content: string }): Promise<void>;

  /**
   * Called when an error occurs.
   * 
   * @param error - The error that occurred
   * @param context - Context about where the error occurred
   * @returns Promise that resolves when processing is complete
   */
  onError?(error: Error, context: { operation: string; [key: string]: unknown }): Promise<void>;
}

/**
 * Plugin metadata for discovery and registration.
 */
export interface PluginMetadata {
  /** Plugin ID */
  id: string;
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Plugin author */
  author?: string;
  /** Plugin entry point (class name or file path) */
  entryPoint: string;
  /** Plugin type */
  type: 'ai-provider' | 'command-handler' | 'integration' | 'custom';
  /** Dependencies (other plugin IDs) */
  dependencies?: string[];
  /** Optional configuration schema */
  configSchema?: Record<string, unknown>;
}

/**
 * Extension point for registering plugins.
 * 
 * Extension points allow plugins to hook into specific parts
 * of the DevSync lifecycle or functionality.
 */
export interface ExtensionPoint<T = unknown> {
  /** Unique identifier for the extension point */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this extension point does */
  description: string;
  /** Type of data/context passed to extensions */
  type: string;
}

/**
 * Extension point handler.
 */
export interface ExtensionPointHandler<T = unknown> {
  /** Extension point ID */
  extensionPointId: string;
  /** Handler function */
  handler: (context: T) => Promise<void> | void;
  /** Optional priority (higher = executed first) */
  priority?: number;
}

