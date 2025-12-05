/**
 * Help content repository.
 * 
 * Centralized repository for all help content including tooltips, documentation links, etc.
 */

/**
 * Help content manager.
 */
export class HelpContent {
  private static content: Map<string, string> = new Map();

  /**
   * Gets tooltip content.
   */
  static getTooltip(key: string): string {
    return this.content.get(`tooltip.${key}`) || '';
  }

  /**
   * Gets documentation link.
   */
  static getDocLink(key: string): string {
    const baseUrl = 'https://docs.devsync.ai';
    const paths: Record<string, string> = {
      scanning: '/scanning',
      migrations: '/migrations',
      dashboard: '/dashboard',
      mismatches: '/mismatches',
      diagnostics: '/diagnostics',
      configuration: '/configuration',
      gettingStarted: '/getting-started',
    };
    return `${baseUrl}${paths[key] || ''}`;
  }

  /**
   * Gets video guide link.
   */
  static getVideoLink(key: string): string {
    const baseUrl = 'https://docs.devsync.ai/videos';
    const paths: Record<string, string> = {
      scanning: '/scanning',
      migrations: '/migrations',
      dashboard: '/dashboard',
      gettingStarted: '/getting-started',
    };
    return `${baseUrl}${paths[key] || ''}`;
  }

  /**
   * Gets community forum link.
   */
  static getForumLink(): string {
    return 'https://community.devsync.ai';
  }

  /**
   * Initializes help content.
   */
  static initialize(): void {
    // Tooltip content
    this.content.set('tooltip.scan', `
# Scan Schema

Scans your Prisma schema and database to detect mismatches.

**How it works:**
1. Compares your Prisma schema with the actual database
2. Detects missing tables, fields, type mismatches, and more
3. Displays results in the sidebar with severity indicators

**Tips:**
- Run a scan after making schema changes
- Enable auto-scan to scan automatically on file save
    `);

    this.content.set('tooltip.migration', `
# Generate Migration

Creates SQL migration files to fix detected mismatches.

**How it works:**
1. Analyzes detected mismatches
2. Generates SQL statements to synchronize database with schema
3. Opens migration file in editor for review

**Tips:**
- Review migrations before applying
- Test migrations in development first
    `);

    this.content.set('tooltip.dashboard', `
# Open Dashboard

Opens the DevSync web dashboard in your browser.

**Features:**
- Visual schema comparison
- Detailed mismatch analysis
- Migration history
- Team collaboration
    `);

    this.content.set('tooltip.mismatches', `
# Mismatches

View all detected schema mismatches grouped by severity.

**Severity Levels:**
- 🔴 **Error**: Critical issues requiring immediate attention
- 🟡 **Warning**: Issues that should be addressed
- 🔵 **Info**: Informational messages
    `);

    this.content.set('tooltip.migrations', `
# Migrations

View all generated migration files.

**Actions:**
- Click to open migration file
- Review SQL statements
- Apply migrations manually
    `);

    this.content.set('tooltip.diagnostic', `
# Schema Mismatch Diagnostic

This diagnostic indicates a mismatch between your Prisma schema and database.

**What to do:**
1. Review the mismatch details
2. Click "Quick Fix" to see suggested solution
3. Generate migration to fix the issue
    `);
  }
}

