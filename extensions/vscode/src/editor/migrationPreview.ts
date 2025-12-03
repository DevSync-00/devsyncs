/**
 * Preview migration impact before applying.
 */

import * as vscode from 'vscode';
import { Migration, ScanReport } from '../api';
import { EditorService } from '../ui/editor';

/**
 * Migration impact preview manager.
 */
export class MigrationPreviewManager {
  constructor(private editorService: EditorService) {}

  /**
   * Shows migration impact preview.
   */
  async previewMigrationImpact(
    migration: Migration,
    scanReport: ScanReport
  ): Promise<void> {
    const impact = this.analyzeMigrationImpact(migration, scanReport);
    
    const content = this.formatImpactReport(impact, migration);
    
    await this.editorService.openDocument(
      'Migration Impact Preview',
      content,
      'markdown'
    );
  }

  /**
   * Analyzes migration impact.
   */
  private analyzeMigrationImpact(migration: Migration, scanReport: ScanReport): MigrationImpact {
    const impact: MigrationImpact = {
      affectedModels: new Set(),
      affectedFields: new Set(),
      operations: [],
      risks: [],
      estimatedTime: 0,
    };

    // Parse migration SQL to extract operations
    const sql = migration.content;
    
    // Extract table names
    const tableMatches = sql.matchAll(/TABLE\s+"?(\w+)"?/gi);
    for (const match of tableMatches) {
      impact.affectedModels.add(match[1]);
    }

    // Extract column names
    const columnMatches = sql.matchAll(/COLUMN\s+"?(\w+)"?/gi);
    for (const match of columnMatches) {
      impact.affectedFields.add(match[1]);
    }

    // Detect operation types
    if (sql.includes('ADD COLUMN')) {
      impact.operations.push('add_column');
    }
    if (sql.includes('ALTER COLUMN')) {
      impact.operations.push('alter_column');
    }
    if (sql.includes('DROP COLUMN')) {
      impact.operations.push('drop_column');
      impact.risks.push('Data loss: Dropping columns will permanently delete data');
    }
    if (sql.includes('CREATE TABLE')) {
      impact.operations.push('create_table');
    }
    if (sql.includes('DROP TABLE')) {
      impact.operations.push('drop_table');
      impact.risks.push('Critical: Dropping tables will permanently delete all data');
    }

    // Estimate execution time (rough estimate)
    impact.estimatedTime = Math.max(1, impact.operations.length * 0.5);

    return impact;
  }

  /**
   * Formats impact report.
   */
  private formatImpactReport(impact: MigrationImpact, migration: Migration): string {
    let markdown = `# Migration Impact Preview\n\n`;
    markdown += `**Migration ID:** ${migration.id}\n`;
    markdown += `**Created:** ${new Date(migration.created_at).toLocaleString()}\n\n`;
    
    markdown += `## Affected Models\n\n`;
    if (impact.affectedModels.size > 0) {
      markdown += Array.from(impact.affectedModels)
        .map(model => `- \`${model}\``)
        .join('\n');
    } else {
      markdown += `- None detected\n`;
    }
    
    markdown += `\n\n## Affected Fields\n\n`;
    if (impact.affectedFields.size > 0) {
      markdown += Array.from(impact.affectedFields)
        .map(field => `- \`${field}\``)
        .join('\n');
    } else {
      markdown += `- None detected\n`;
    }
    
    markdown += `\n\n## Operations\n\n`;
    markdown += impact.operations
      .map(op => `- ${this.formatOperation(op)}`)
      .join('\n');
    
    if (impact.risks.length > 0) {
      markdown += `\n\n## ⚠️ Risks\n\n`;
      markdown += impact.risks
        .map(risk => `- **${risk}**`)
        .join('\n');
    }
    
    markdown += `\n\n## Estimated Execution Time\n\n`;
    markdown += `~${impact.estimatedTime.toFixed(1)} seconds\n\n`;
    
    markdown += `## Migration SQL\n\n`;
    markdown += `\`\`\`sql\n${migration.content}\n\`\`\`\n`;
    
    return markdown;
  }

  /**
   * Formats operation name.
   */
  private formatOperation(operation: string): string {
    return operation
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}

/**
 * Migration impact analysis result.
 */
interface MigrationImpact {
  affectedModels: Set<string>;
  affectedFields: Set<string>;
  operations: string[];
  risks: string[];
  estimatedTime: number; // seconds
}

