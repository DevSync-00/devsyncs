/**
 * Plugin registry and manager.
 * 
 * Manages plugin discovery, registration, activation, and lifecycle.
 */

import * as vscode from 'vscode';
import {
  IPlugin,
  IAiProviderPlugin,
  ICommandHandlerPlugin,
  IIntegrationPlugin,
  PluginMetadata,
  ExtensionPoint,
  ExtensionPointHandler,
} from './interfaces';

/**
 * Plugin registry for managing all registered plugins.
 * 
 * Handles plugin discovery, registration, activation, and provides
 * access to plugins by type.
 * 
 * @example
 * ```typescript
 * const registry = new PluginRegistry(context);
 * await registry.loadPlugins();
 * 
 * // Get AI provider
 * const aiProvider = registry.getAiProvider('openai-provider');
 * const result = await aiProvider.query('What are the mismatches?', context);
 * 
 * // Get command handlers
 * const commands = registry.getCommandHandlers();
 * commands.forEach(cmd => vscode.commands.registerCommand(cmd.command, cmd.handler));
 * ```
 */
export class PluginRegistry {
  private plugins: Map<string, IPlugin> = new Map();
  private aiProviders: Map<string, IAiProviderPlugin> = new Map();
  private commandHandlers: Map<string, ICommandHandlerPlugin> = new Map();
  private integrations: Map<string, IIntegrationPlugin> = new Map();
  private extensionPoints: Map<string, ExtensionPoint> = new Map();
  private extensionHandlers: Map<string, ExtensionPointHandler[]> = new Map();

  /**
   * Creates a new plugin registry.
   * 
   * @param context - VS Code extension context
   */
  constructor(private readonly context: vscode.ExtensionContext) {
    this.registerBuiltInExtensionPoints();
  }

  /**
   * Registers a plugin.
   * 
   * @param plugin - The plugin to register
   * @returns Promise that resolves when registration is complete
   */
  async registerPlugin(plugin: IPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin with ID "${plugin.id}" is already registered`);
    }

    this.plugins.set(plugin.id, plugin);

    // Categorize plugin
    if (this.isAiProvider(plugin)) {
      this.aiProviders.set(plugin.id, plugin);
    }
    if (this.isCommandHandler(plugin)) {
      this.commandHandlers.set(plugin.id, plugin);
    }
    if (this.isIntegration(plugin)) {
      this.integrations.set(plugin.id, plugin);
    }

    // Activate plugin
    try {
      await plugin.activate(this.context);
    } catch (error) {
      console.error(`Failed to activate plugin "${plugin.id}":`, error);
      this.plugins.delete(plugin.id);
      throw error;
    }
  }

  /**
   * Unregisters a plugin.
   * 
   * @param pluginId - The ID of the plugin to unregister
   * @returns Promise that resolves when unregistration is complete
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    try {
      await plugin.deactivate();
    } catch (error) {
      console.error(`Error deactivating plugin "${pluginId}":`, error);
    }

    this.plugins.delete(pluginId);
    this.aiProviders.delete(pluginId);
    this.commandHandlers.delete(pluginId);
    this.integrations.delete(pluginId);
  }

  /**
   * Gets a plugin by ID.
   * 
   * @param pluginId - The plugin ID
   * @returns The plugin, or undefined if not found
   */
  getPlugin(pluginId: string): IPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Gets all registered plugins.
   * 
   * @returns Array of all plugins
   */
  getAllPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Gets an AI provider plugin by ID.
   * 
   * @param providerId - The provider ID
   * @returns The AI provider plugin, or undefined if not found
   */
  getAiProvider(providerId: string): IAiProviderPlugin | undefined {
    return this.aiProviders.get(providerId);
  }

  /**
   * Gets all AI provider plugins.
   * 
   * @returns Array of all AI provider plugins
   */
  getAllAiProviders(): IAiProviderPlugin[] {
    return Array.from(this.aiProviders.values());
  }

  /**
   * Gets the default AI provider (first configured provider).
   * 
   * @returns The default AI provider, or undefined if none configured
   */
  getDefaultAiProvider(): IAiProviderPlugin | undefined {
    return this.getAllAiProviders().find((provider) => provider.isConfigured());
  }

  /**
   * Gets all command handlers from all command handler plugins.
   * 
   * @returns Array of all command handlers
   */
  getAllCommandHandlers(): import('./interfaces').CommandHandler[] {
    const handlers: import('./interfaces').CommandHandler[] = [];
    this.commandHandlers.forEach((plugin) => {
      handlers.push(...plugin.getCommands());
    });
    return handlers;
  }

  /**
   * Gets all integration plugins.
   * 
   * @returns Array of all integration plugins
   */
  getAllIntegrations(): IIntegrationPlugin[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Registers an extension point.
   * 
   * @param extensionPoint - The extension point to register
   */
  registerExtensionPoint(extensionPoint: ExtensionPoint): void {
    this.extensionPoints.set(extensionPoint.id, extensionPoint);
    if (!this.extensionHandlers.has(extensionPoint.id)) {
      this.extensionHandlers.set(extensionPoint.id, []);
    }
  }

  /**
   * Registers a handler for an extension point.
   * 
   * @param handler - The extension point handler
   */
  registerExtensionHandler(handler: ExtensionPointHandler): void {
    if (!this.extensionHandlers.has(handler.extensionPointId)) {
      this.extensionHandlers.set(handler.extensionPointId, []);
    }
    const handlers = this.extensionHandlers.get(handler.extensionPointId)!;
    handlers.push(handler);
    // Sort by priority (higher first)
    handlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Executes all handlers for an extension point.
   * 
   * Handlers are executed sequentially to respect priority ordering.
   * Errors in one handler don't stop execution of other handlers.
   * 
   * @param extensionPointId - The extension point ID
   * @param context - Context data to pass to handlers
   * @returns Promise that resolves when all handlers have executed
   */
  async executeExtensionPoint<T = unknown>(
    extensionPointId: string,
    context: T
  ): Promise<void> {
    const handlers = this.extensionHandlers.get(extensionPointId) || [];
    if (handlers.length === 0) {
      return;
    }

    // Execute handlers sequentially to respect priority ordering
    // This ensures higher priority handlers complete before lower priority ones
    for (const handler of handlers) {
      try {
        await handler.handler(context);
      } catch (error) {
        // Log error but continue with other handlers
        console.error(`Error executing extension handler for "${extensionPointId}":`, error);
      }
    }
  }

  /**
   * Gets all registered extension points.
   * 
   * @returns Array of all extension points
   */
  getExtensionPoints(): ExtensionPoint[] {
    return Array.from(this.extensionPoints.values());
  }

  /**
   * Disposes all plugins and cleans up resources.
   */
  async dispose(): Promise<void> {
    const disposePromises = Array.from(this.plugins.values()).map((plugin) =>
      plugin.deactivate().catch((error) => {
        console.error(`Error disposing plugin "${plugin.id}":`, error);
      })
    );
    await Promise.all(disposePromises);
    this.plugins.clear();
    this.aiProviders.clear();
    this.commandHandlers.clear();
    this.integrations.clear();
    this.extensionHandlers.clear();
  }

  /**
   * Type guard for AI provider plugins.
   */
  private isAiProvider(plugin: IPlugin): plugin is IAiProviderPlugin {
    return 'query' in plugin && typeof (plugin as IAiProviderPlugin).query === 'function';
  }

  /**
   * Type guard for command handler plugins.
   */
  private isCommandHandler(plugin: IPlugin): plugin is ICommandHandlerPlugin {
    return 'getCommands' in plugin && typeof (plugin as ICommandHandlerPlugin).getCommands === 'function';
  }

  /**
   * Type guard for integration plugins.
   */
  private isIntegration(plugin: IPlugin): plugin is IIntegrationPlugin {
    return (
      'onScanComplete' in plugin ||
      'onMigrationGenerated' in plugin ||
      'onError' in plugin
    );
  }

  /**
   * Registers built-in extension points.
   */
  private registerBuiltInExtensionPoints(): void {
    this.registerExtensionPoint({
      id: 'devsync.scan.complete',
      name: 'Scan Complete',
      description: 'Triggered when a scan completes',
      type: 'ScanReport',
    });

    this.registerExtensionPoint({
      id: 'devsync.migration.generated',
      name: 'Migration Generated',
      description: 'Triggered when a migration is generated',
      type: 'Migration',
    });

    this.registerExtensionPoint({
      id: 'devsync.error.occurred',
      name: 'Error Occurred',
      description: 'Triggered when an error occurs',
      type: 'Error',
    });
  }
}

