import { DevSyncConfig } from './schema';

/**
 * Configuration migration function
 */
export type MigrationFunction = (config: Record<string, unknown>) => Record<string, unknown>;

/**
 * Configuration migration
 */
export interface ConfigMigration {
  fromVersion: string;
  toVersion: string;
  migrate: MigrationFunction;
}

/**
 * Configuration migrator
 */
export class ConfigMigrator {
  private static migrations: ConfigMigration[] = [
    // Example migration: v0.1.0 -> v0.2.0
    {
      fromVersion: '0.1.0',
      toVersion: '0.2.0',
      migrate: (config: Record<string, unknown>) => {
        // Migrate old 'aiProvider' to new 'ai.provider'
        if (config.aiProvider && !config['ai.provider']) {
          config['ai.provider'] = config.aiProvider;
          delete config.aiProvider;
        }
        return config;
      },
    },
    // Add more migrations as needed
  ];

  /**
   * Get current configuration version
   */
  static getCurrentVersion(): string {
    // This would typically come from package.json or a version file
    return '0.2.0';
  }

  /**
   * Migrate configuration from one version to another
   */
  static migrate(config: Record<string, unknown>, fromVersion: string, toVersion: string): Record<string, unknown> {
    let migratedConfig = { ...config };

    // Find applicable migrations
    const applicableMigrations = this.migrations.filter(
      (migration) =>
        this.compareVersions(fromVersion, migration.fromVersion) >= 0 &&
        this.compareVersions(migration.toVersion, toVersion) <= 0
    );

    // Sort migrations by version
    applicableMigrations.sort((a, b) =>
      this.compareVersions(a.fromVersion, b.fromVersion)
    );

    // Apply migrations in order
    for (const migration of applicableMigrations) {
      migratedConfig = migration.migrate(migratedConfig);
    }

    return migratedConfig;
  }

  /**
   * Compare two version strings
   * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
   */
  private static compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }

    return 0;
  }

  /**
   * Check if migration is needed
   */
  static needsMigration(configVersion: string | undefined): boolean {
    if (!configVersion) {
      return true; // No version means old config
    }

    const currentVersion = this.getCurrentVersion();
    return this.compareVersions(configVersion, currentVersion) < 0;
  }
}

