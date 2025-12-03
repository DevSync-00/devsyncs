import * as vscode from 'vscode';
import { EventEmitter } from 'vscode';
import { DevSyncConfig, ConfigSource, CONFIG_SCHEMA } from './schema';
import { ConfigValidator, ValidationResult } from './validation';
import { ConfigMigrator } from './migration';

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  key: keyof DevSyncConfig;
  oldValue: unknown;
  newValue: unknown;
  source: ConfigSource;
}

/**
 * Unified Configuration Manager
 */
export class ConfigurationManager {
  private config: DevSyncConfig;
  private configSource: Record<string, ConfigSource> = {};
  private readonly onDidChangeConfigEmitter = new EventEmitter<ConfigChangeEvent>();
  public readonly onDidChangeConfig = this.onDidChangeConfigEmitter.event;

  constructor(private context: vscode.ExtensionContext) {
    this.config = this.loadConfiguration();
    this.setupConfigWatcher();
  }

  /**
   * Load configuration from VS Code settings
   */
  private loadConfiguration(): DevSyncConfig {
    const vscodeConfig = vscode.workspace.getConfiguration('devsync');
    const loaded: Partial<DevSyncConfig> = {};

    // Load each configuration property with source tracking
    for (const [key, property] of Object.entries(CONFIG_SCHEMA)) {
      const configKey = property.key;
      
      // Check workspace folder setting first (highest priority)
      const workspaceFolderValue = vscodeConfig.inspect(configKey);
      
      let value: unknown;
      let source: ConfigSource;

      if (workspaceFolderValue?.workspaceFolderValue !== undefined) {
        value = workspaceFolderValue.workspaceFolderValue;
        source = ConfigSource.WORKSPACE_FOLDER;
      } else if (workspaceFolderValue?.workspaceValue !== undefined) {
        value = workspaceFolderValue.workspaceValue;
        source = ConfigSource.WORKSPACE;
      } else if (workspaceFolderValue?.globalValue !== undefined) {
        value = workspaceFolderValue.globalValue;
        source = ConfigSource.USER;
      } else {
        value = property.default;
        source = ConfigSource.DEFAULT;
      }

      (loaded as Record<string, unknown>)[key] = value;
      this.configSource[key] = source;
    }

    // Validate configuration
    const validation = ConfigValidator.validate(loaded);
    if (!validation.valid) {
      console.warn('Configuration validation errors:', validation.errors);
      // Log warnings but continue with sanitized config
    }

    // Sanitize and apply defaults
    const sanitized = ConfigValidator.sanitize(loaded);

    // Check if migration is needed
    const configVersion = this.context.globalState.get<string>('configVersion');
    if (ConfigMigrator.needsMigration(configVersion)) {
      const migrated = ConfigMigrator.migrate(
        sanitized as unknown as Record<string, unknown>,
        configVersion || '0.1.0',
        ConfigMigrator.getCurrentVersion()
      );
      this.context.globalState.update('configVersion', ConfigMigrator.getCurrentVersion());
      // Re-validate after migration
      return ConfigValidator.sanitize(migrated as Partial<DevSyncConfig>);
    }

    return sanitized;
  }

  /**
   * Get configuration value
   */
  get<K extends keyof DevSyncConfig>(key: K): DevSyncConfig[K] {
    return this.config[key];
  }

  /**
   * Get all configuration
   */
  getAll(): DevSyncConfig {
    return { ...this.config };
  }

  /**
   * Get configuration source for a key
   */
  getSource(key: keyof DevSyncConfig): ConfigSource {
    return this.configSource[key] || ConfigSource.DEFAULT;
  }

  /**
   * Update configuration value
   */
  async update<K extends keyof DevSyncConfig>(
    key: K,
    value: DevSyncConfig[K],
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    const oldValue = this.config[key];
    const property = CONFIG_SCHEMA[key];

    // Validate new value
    const error = ConfigValidator.validateProperty(key, value);
    if (error) {
      throw error;
    }

    // Update VS Code configuration
    const config = vscode.workspace.getConfiguration('devsync');
    await config.update(property.key, value, target);

    // Update local config
    this.config[key] = value;

    // Update source tracking
    if (target === vscode.ConfigurationTarget.Global) {
      this.configSource[key] = ConfigSource.USER;
    } else if (target === vscode.ConfigurationTarget.Workspace) {
      this.configSource[key] = ConfigSource.WORKSPACE;
    } else {
      this.configSource[key] = ConfigSource.WORKSPACE_FOLDER;
    }

    // Emit change event
    this.onDidChangeConfigEmitter.fire({
      key,
      oldValue,
      newValue: value,
      source: this.configSource[key],
    });
  }

  /**
   * Validate current configuration
   */
  validate(): ValidationResult {
    return ConfigValidator.validate(this.config);
  }

  /**
   * Check if configuration is valid for basic operations
   */
  isValid(): boolean {
    const validation = this.validate();
    return validation.valid;
  }

  /**
   * Get missing required configuration keys
   */
  getMissingRequired(): string[] {
    const validation = this.validate();
    return validation.errors
      .filter((error) => error.reason.includes('Required'))
      .map((error) => error.key);
  }

  /**
   * Setup configuration change watcher
   */
  private setupConfigWatcher(): void {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('devsync')) {
        return;
      }

      // Reload configuration
      const oldConfig = { ...this.config };
      this.config = this.loadConfiguration();

      // Emit change events for modified keys
      for (const key of Object.keys(this.config) as Array<keyof DevSyncConfig>) {
        if (oldConfig[key] !== this.config[key]) {
          this.onDidChangeConfigEmitter.fire({
            key,
            oldValue: oldConfig[key],
            newValue: this.config[key],
            source: this.configSource[key],
          });
        }
      }
    });
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    const config = vscode.workspace.getConfiguration('devsync');
    
    for (const [, property] of Object.entries(CONFIG_SCHEMA)) {
      await config.update(property.key, undefined, vscode.ConfigurationTarget.Global);
    }

    this.config = this.loadConfiguration();
  }

  /**
   * Export configuration as JSON
   */
  export(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Get configuration summary
   */
  getSummary(): {
    total: number;
    configured: number;
    defaults: number;
    sources: Record<ConfigSource, number>;
  } {
    const sources: Record<ConfigSource, number> = {
      [ConfigSource.DEFAULT]: 0,
      [ConfigSource.USER]: 0,
      [ConfigSource.WORKSPACE]: 0,
      [ConfigSource.WORKSPACE_FOLDER]: 0,
    };

    let configured = 0;
    let defaults = 0;

    for (const [, source] of Object.entries(this.configSource)) {
      sources[source]++;
      if (source === ConfigSource.DEFAULT) {
        defaults++;
      } else {
        configured++;
      }
    }

    return {
      total: Object.keys(this.configSource).length,
      configured,
      defaults,
      sources,
    };
  }
}

