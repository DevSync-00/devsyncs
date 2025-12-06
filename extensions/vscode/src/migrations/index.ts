/**
 * Advanced migration management module.
 * 
 * Exports all migration management functionality including:
 * - Advanced migration manager
 * - Migration templates
 * - Type definitions
 */

export * from './types';
export * from './advancedMigrationManager';
export * from './templates';

export { AdvancedMigrationManager } from './advancedMigrationManager';
export { MigrationTemplateManager, DEFAULT_MIGRATION_TEMPLATES } from './templates';

