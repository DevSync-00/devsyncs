/**
 * Central export for configuration management
 */
export { ConfigurationManager } from './manager';
export type { ConfigChangeEvent } from './manager';
export { ConfigValidator, ConfigValidationError, ValidationResult } from './validation';
export { ConfigMigrator } from './migration';
export { DevSyncConfig, ConfigSource, CONFIG_SCHEMA, ConfigProperty, ConfigWithMetadata } from './schema';

