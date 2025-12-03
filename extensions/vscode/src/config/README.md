# Configuration Management

This directory contains the unified configuration management implementation for the DevSync VS Code extension, addressing improvement 1.3 from the IMPROVEMENTS.md roadmap.

## Overview

The configuration management system provides:
- **Unified Configuration Manager** - Single source of truth for all configuration
- **Configuration Validation** - Schema validation and type checking
- **Workspace vs User Settings** - Support for settings hierarchy
- **Configuration Migration** - Automatic migration for version updates
- **Change Events** - Event-driven configuration updates

## Structure

### Schema (`schema.ts`)
- `DevSyncConfig` - Complete configuration type definition
- `CONFIG_SCHEMA` - Schema definitions with validation rules
- `ConfigSource` - Enumeration of configuration sources (default, user, workspace, workspaceFolder)
- `ConfigProperty` - Property definition with validation rules

### Validation (`validation.ts`)
- `ConfigValidator` - Validates configuration values against schema
- `ConfigValidationError` - Validation error class
- `ValidationResult` - Validation result with errors and warnings

### Migration (`migration.ts`)
- `ConfigMigrator` - Handles configuration migration between versions
- `MigrationFunction` - Migration function type
- Version comparison and migration application

### Manager (`manager.ts`)
- `ConfigurationManager` - Main configuration manager class
- Loads configuration from VS Code settings
- Tracks configuration source (user vs workspace)
- Emits change events
- Provides validation and migration

## Usage

### Basic Usage

```typescript
import { ConfigurationManager } from './config';

// Get configuration manager from DI container
const configManager = container.getConfigurationManager();

// Get a configuration value
const apiUrl = configManager.get('apiUrl');

// Get all configuration
const config = configManager.getAll();

// Update configuration
await configManager.update('apiUrl', 'https://api.example.com');
```

### Configuration Sources

The manager tracks where each configuration value comes from:

```typescript
const source = configManager.getSource('apiUrl');
// Returns: ConfigSource.USER, ConfigSource.WORKSPACE, etc.
```

### Validation

```typescript
// Validate current configuration
const validation = configManager.validate();
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}

// Check if configuration is valid
if (configManager.isValid()) {
  // Proceed with operations
}

// Get missing required fields
const missing = configManager.getMissingRequired();
```

### Configuration Changes

Listen to configuration changes:

```typescript
configManager.onDidChangeConfig((event) => {
  console.log(`Config changed: ${event.key} from ${event.oldValue} to ${event.newValue}`);
  console.log(`Source: ${event.source}`);
});
```

### Migration

Configuration migration is handled automatically when the extension loads. Migrations are defined in `migration.ts`:

```typescript
{
  fromVersion: '0.1.0',
  toVersion: '0.2.0',
  migrate: (config) => {
    // Transform config from old version to new version
    return transformedConfig;
  }
}
```

## Configuration Schema

All configuration properties are defined in `CONFIG_SCHEMA` with:
- Type information
- Default values
- Validation rules (pattern, enum, min/max, custom validators)
- Required flags
- Descriptions

## Features

### Workspace vs User Settings
The manager respects VS Code's settings hierarchy:
1. Workspace Folder (highest priority)
2. Workspace
3. User (global)
4. Default (lowest priority)

### Automatic Validation
All configuration values are validated when loaded, with helpful error messages.

### Type Safety
Full TypeScript type safety for all configuration values.

### Change Tracking
Tracks where each configuration value comes from and emits events when values change.

### Migration Support
Automatic migration of configuration between extension versions.

## Integration

The ConfigurationManager is integrated into:
- `DIContainer` - Available as a service
- `ContainerFactory` - Created during container initialization
- All components can access configuration through the manager

## Benefits

1. **Single Source of Truth** - All configuration in one place
2. **Type Safety** - TypeScript ensures correct configuration types
3. **Validation** - Catch configuration errors early
4. **Migration** - Smooth upgrades between versions
5. **Hierarchy Support** - Proper workspace vs user settings handling
6. **Change Events** - Reactive configuration updates

