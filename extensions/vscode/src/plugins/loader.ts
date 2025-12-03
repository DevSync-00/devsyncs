/**
 * Plugin loader for discovering and loading plugins.
 * 
 * Handles loading plugins from various sources:
 * - Built-in plugins
 * - User-installed plugins
 * - Third-party plugins
 */

import * as vscode from 'vscode';
import { PluginRegistry } from './registry';
import { IPlugin, PluginMetadata } from './interfaces';

/**
 * Plugin loader for discovering and loading plugins.
 * 
 * Supports loading plugins from:
 * - Built-in plugins (bundled with extension)
 * - User workspace plugins (`.devsync/plugins/`)
 * - VS Code extension contributions
 * 
 * @example
 * ```typescript
 * const loader = new PluginLoader(context);
 * await loader.loadPlugins(registry);
 * ```
 */
export class PluginLoader {
  /**
   * Creates a new plugin loader.
   * 
   * @param context - VS Code extension context
   */
  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Loads all available plugins into the registry.
   * 
   * @param registry - The plugin registry to load plugins into
   * @returns Promise that resolves when all plugins are loaded
   */
  async loadPlugins(registry: PluginRegistry): Promise<void> {
    // Load built-in plugins
    await this.loadBuiltInPlugins(registry);

    // Load workspace plugins
    await this.loadWorkspacePlugins(registry);

    // Load extension-contributed plugins
    await this.loadExtensionPlugins(registry);
  }

  /**
   * Loads built-in plugins.
   * 
   * @param registry - The plugin registry
   */
  private async loadBuiltInPlugins(registry: PluginRegistry): Promise<void> {
    // Built-in plugins can be imported and registered here
    // For now, we'll keep this empty as we don't have built-in plugins yet
  }

  /**
   * Loads plugins from the workspace `.devsync/plugins/` directory.
   * 
   * @param registry - The plugin registry
   */
  private async loadWorkspacePlugins(registry: PluginRegistry): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    for (const folder of workspaceFolders) {
      const pluginsDir = vscode.Uri.joinPath(folder.uri, '.devsync', 'plugins');
      
      try {
        const files = await vscode.workspace.fs.readDirectory(pluginsDir);
        
        for (const [file, type] of files) {
          if (type === vscode.FileType.File && file.endsWith('.js')) {
            await this.loadPluginFromFile(registry, vscode.Uri.joinPath(pluginsDir, file));
          }
        }
      } catch {
        // Plugins directory doesn't exist, skip
      }
    }
  }

  /**
   * Loads plugins contributed by other VS Code extensions.
   * 
   * @param registry - The plugin registry
   */
  private async loadExtensionPlugins(registry: PluginRegistry): Promise<void> {
    const extensions = vscode.extensions.all;
    
    for (const extension of extensions) {
      if (!extension.isActive) {
        continue;
      }

      const contributes = extension.packageJSON?.contributes;
      if (!contributes || !contributes['devsync.plugins']) {
        continue;
      }

      const pluginMetadata = contributes['devsync.plugins'] as PluginMetadata[];
      for (const metadata of pluginMetadata) {
        try {
          await this.loadPluginFromMetadata(registry, extension, metadata);
        } catch (error) {
          console.error(`Failed to load plugin "${metadata.id}" from extension "${extension.id}":`, error);
        }
      }
    }
  }

  /**
   * Loads a plugin from a file.
   * 
   * @param registry - The plugin registry
   * @param fileUri - URI of the plugin file
   */
  private async loadPluginFromFile(
    registry: PluginRegistry,
    fileUri: vscode.Uri
  ): Promise<void> {
    try {
      // In a real implementation, we would:
      // 1. Read the file
      // 2. Evaluate/import it
      // 3. Instantiate the plugin class
      // 4. Register it
      
      // For now, this is a placeholder
      console.log(`Loading plugin from file: ${fileUri.fsPath}`);
    } catch (error) {
      console.error(`Failed to load plugin from file "${fileUri.fsPath}":`, error);
    }
  }

  /**
   * Loads a plugin from extension metadata.
   * 
   * @param registry - The plugin registry
   * @param extension - The VS Code extension
   * @param metadata - Plugin metadata
   */
  private async loadPluginFromMetadata(
    registry: PluginRegistry,
    extension: vscode.Extension<unknown>,
    metadata: PluginMetadata
  ): Promise<void> {
    try {
      // Resolve the plugin class from the extension
      const pluginModule = await extension.activate();
      const pluginClass = (pluginModule as Record<string, unknown>)[metadata.entryPoint];
      
      if (!pluginClass || typeof pluginClass !== 'function') {
        throw new Error(`Plugin class "${metadata.entryPoint}" not found in extension "${extension.id}"`);
      }

      // Instantiate the plugin
      const plugin = new (pluginClass as new () => IPlugin)();
      
      // Verify metadata matches
      if (plugin.id !== metadata.id) {
        throw new Error(`Plugin ID mismatch: expected "${metadata.id}", got "${plugin.id}"`);
      }

      // Register the plugin
      await registry.registerPlugin(plugin);
    } catch (error) {
      console.error(`Failed to load plugin "${metadata.id}":`, error);
      throw error;
    }
  }
}

