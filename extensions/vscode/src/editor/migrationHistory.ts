/**
 * Show migration history inline in the editor.
 */

import * as vscode from 'vscode';
import { Migration } from '../api';
import { EditorService } from '../ui/editor';
import { getMigrationsDir, getFilesInDir } from '../utils/paths';

/**
 * Migration history manager for inline display.
 */
export class MigrationHistoryManager {
  constructor(private editorService: EditorService) {}

  /**
   * Shows migration history for a model or field.
   */
  async showMigrationHistory(
    modelName?: string,
    fieldName?: string
  ): Promise<void> {
    const migrations = await this.loadMigrations();
    const relevantMigrations = this.filterRelevantMigrations(
      migrations,
      modelName,
      fieldName
    );

    const content = this.formatMigrationHistory(relevantMigrations, modelName, fieldName);
    
    await this.editorService.openDocument(
      'Migration History',
      content,
      'markdown'
    );
  }

  /**
   * Shows migration history inline as annotations.
   */
  async annotateWithMigrationHistory(
    editor: vscode.TextEditor,
    modelName: string,
    fieldName?: string
  ): Promise<void> {
    const migrations = await this.loadMigrations();
    const relevantMigrations = this.filterRelevantMigrations(
      migrations,
      modelName,
      fieldName
    );

    if (relevantMigrations.length === 0) {
      return;
    }

    // Create decoration for migration history
    const decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        contentText: ` (${relevantMigrations.length} migration${relevantMigrations.length !== 1 ? 's' : ''})`,
        color: new vscode.ThemeColor('descriptionForeground'),
        fontStyle: 'italic',
        margin: '0 0 0 1em',
      },
    });

    const range = this.findModelRange(editor.document, modelName);
    if (range) {
      editor.setDecorations(decorationType, [range]);
    }
  }

  /**
   * Loads migrations from workspace.
   */
  private async loadMigrations(): Promise<Migration[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const migrationsDir = getMigrationsDir(workspaceFolders[0]);
    const files = getFilesInDir(migrationsDir, /\.sql$/);
    
    const migrations: Migration[] = [];
    
    for (const file of files) {
      try {
        const content = await vscode.workspace.fs.readFile(vscode.Uri.file(file));
        const text = new TextDecoder().decode(content);
        
        // Extract metadata from filename or content
        const fileName = file.split(/[/\\]/).pop() || '';
        const timestamp = this.extractTimestamp(fileName);
        
        migrations.push({
          id: fileName,
          filename: fileName,
          content: text,
          format: 'sql',
          applied: false,
          created_at: timestamp || new Date().toISOString(),
        });
      } catch (error) {
        console.error(`Failed to load migration ${file}:`, error);
      }
    }

    return migrations.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  /**
   * Filters migrations relevant to model/field.
   */
  private filterRelevantMigrations(
    migrations: Migration[],
    modelName?: string,
    fieldName?: string
  ): Migration[] {
    if (!modelName) {
      return migrations;
    }

    return migrations.filter(migration => {
      const content = migration.content.toLowerCase();
      const modelLower = modelName.toLowerCase();
      
      if (fieldName) {
        const fieldLower = fieldName.toLowerCase();
        return content.includes(modelLower) && content.includes(fieldLower);
      }
      
      return content.includes(modelLower);
    });
  }

  /**
   * Formats migration history as markdown.
   */
  private formatMigrationHistory(
    migrations: Migration[],
    modelName?: string,
    fieldName?: string
  ): string {
    let markdown = `# Migration History\n\n`;
    
    if (modelName) {
      markdown += `**Model:** \`${modelName}\`\n`;
    }
    if (fieldName) {
      markdown += `**Field:** \`${fieldName}\`\n`;
    }
    
    markdown += `**Total Migrations:** ${migrations.length}\n\n`;
    markdown += `---\n\n`;

    if (migrations.length === 0) {
      markdown += `No migrations found.\n`;
      return markdown;
    }

    migrations.forEach((migration, index) => {
      const date = new Date(migration.created_at).toLocaleString();
      markdown += `## Migration ${index + 1}\n\n`;
      markdown += `**Date:** ${date}\n`;
      markdown += `**ID:** ${migration.id}\n\n`;
      markdown += `\`\`\`sql\n${migration.content}\n\`\`\`\n\n`;
      markdown += `---\n\n`;
    });

    return markdown;
  }

  /**
   * Finds range for a model in the document.
   */
  private findModelRange(document: vscode.TextDocument, modelName: string): vscode.Range | null {
    const text = document.getText();
    const lines = text.split('\n');

    const pattern = new RegExp(`^model\\s+${modelName}\\s*\\{`, 'i');
    
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        const line = document.lineAt(i);
        return line.range;
      }
    }

    return null;
  }

  /**
   * Extracts timestamp from filename.
   */
  private extractTimestamp(fileName: string): string | null {
    // Try to extract timestamp from common migration filename patterns
    const patterns = [
      /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, // YYYYMMDDHHmmss
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    ];

    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        if (match.length === 7) {
          // YYYYMMDDHHmmss
          const [, year, month, day, hour, minute, second] = match;
          return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
        } else if (match.length === 4) {
          // YYYY-MM-DD
          const [, year, month, day] = match;
          return `${year}-${month}-${day}T00:00:00Z`;
        }
      }
    }

    return null;
  }
}

