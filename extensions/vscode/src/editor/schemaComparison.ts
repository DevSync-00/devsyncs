/**
 * Side-by-side comparison of code schema vs database schema.
 */

import * as vscode from 'vscode';
import { ScanReport } from '../api';
import { PrismaModel, DatabaseTable, PrismaField, DatabaseColumn } from '../types/schema';
import { EditorService } from '../ui/editor';

/**
 * Schema comparison manager for side-by-side views.
 */
export class SchemaComparisonManager {
  constructor(private editorService: EditorService) {}

  /**
   * Shows side-by-side comparison of code vs database schema.
   */
  async showComparison(scanReport: ScanReport): Promise<void> {
    const codeSchema = scanReport.codeSchema || [];
    const dbSchema = scanReport.dbSchema || [];
    
    const comparison = this.buildComparison(codeSchema, dbSchema);
    const content = this.formatComparison(comparison);
    
    await this.editorService.openDocument(
      'Schema Comparison: Code vs Database',
      content,
      'markdown'
    );
  }

  /**
   * Shows comparison for a specific model.
   */
  async showModelComparison(
    modelName: string,
    codeModel: PrismaModel | undefined,
    dbTable: DatabaseTable | undefined
  ): Promise<void> {
    const content = this.formatModelComparison(modelName, codeModel, dbTable);
    
    await this.editorService.openDocument(
      `Model Comparison: ${modelName}`,
      content,
      'markdown'
    );
  }

  /**
   * Builds comparison data structure.
   */
  private buildComparison(
    codeSchema: PrismaModel[],
    dbSchema: DatabaseTable[]
  ): SchemaComparison {
    const comparison: SchemaComparison = {
      codeOnly: [],
      dbOnly: [],
      both: [],
    };

    const codeModelMap = new Map(codeSchema.map(m => [m.name, m]));
    const dbTableMap = new Map(dbSchema.map(t => [t.name, t]));

    // Find models only in code
    for (const model of codeSchema) {
      if (!dbTableMap.has(model.name)) {
        comparison.codeOnly.push(model);
      } else {
        comparison.both.push({
          name: model.name,
          codeModel: model,
          dbTable: dbTableMap.get(model.name)!,
        });
      }
    }

    // Find tables only in database
    for (const table of dbSchema) {
      if (!codeModelMap.has(table.name)) {
        comparison.dbOnly.push(table);
      }
    }

    return comparison;
  }

  /**
   * Formats comparison as markdown.
   */
  private formatComparison(comparison: SchemaComparison): string {
    let markdown = `# Schema Comparison: Code vs Database\n\n`;
    
    markdown += `## Summary\n\n`;
    markdown += `- **Code-only models:** ${comparison.codeOnly.length}\n`;
    markdown += `- **Database-only tables:** ${comparison.dbOnly.length}\n`;
    markdown += `- **Common models/tables:** ${comparison.both.length}\n\n`;
    
    if (comparison.codeOnly.length > 0) {
      markdown += `## Models Only in Code\n\n`;
      comparison.codeOnly.forEach((model: PrismaModel) => {
        markdown += `### ${model.name}\n\n`;
        markdown += `**Fields:**\n`;
        model.fields.forEach((field: PrismaField) => {
          markdown += `- \`${field.name}\` (${field.type})\n`;
        });
        markdown += `\n`;
      });
    }
    
    if (comparison.dbOnly.length > 0) {
      markdown += `## Tables Only in Database\n\n`;
      comparison.dbOnly.forEach((table: DatabaseTable) => {
        markdown += `### ${table.name}\n\n`;
        markdown += `**Columns:**\n`;
        table.columns.forEach((column: DatabaseColumn) => {
          markdown += `- \`${column.name}\` (${column.type})\n`;
        });
        markdown += `\n`;
      });
    }
    
    if (comparison.both.length > 0) {
      markdown += `## Common Models/Tables\n\n`;
      comparison.both.forEach(({ name, codeModel, dbTable }) => {
        markdown += `### ${name}\n\n`;
        
        // Compare fields
        const codeFields = new Map(codeModel.fields.map((f: PrismaField) => [f.name, f]));
        const dbColumns = new Map(dbTable.columns.map((c: DatabaseColumn) => [c.name, c]));
        
        const codeOnlyFields = codeModel.fields.filter((f: PrismaField) => !dbColumns.has(f.name));
        const dbOnlyColumns = dbTable.columns.filter((c: DatabaseColumn) => !codeFields.has(c.name));
        const commonFields = codeModel.fields.filter((f: PrismaField) => dbColumns.has(f.name));
        
        if (codeOnlyFields.length > 0) {
          markdown += `**Fields only in code:**\n`;
          codeOnlyFields.forEach((field: PrismaField) => {
            markdown += `- \`${field.name}\` (${field.type})\n`;
          });
          markdown += `\n`;
        }
        
        if (dbOnlyColumns.length > 0) {
          markdown += `**Columns only in database:**\n`;
          dbOnlyColumns.forEach((column: DatabaseColumn) => {
            markdown += `- \`${column.name}\` (${column.type})\n`;
          });
          markdown += `\n`;
        }
        
        if (commonFields.length > 0) {
          markdown += `**Common fields:**\n`;
          commonFields.forEach((field: PrismaField) => {
            const dbColumn = dbColumns.get(field.name)!;
            const typeMatch = this.compareTypes(field.type, dbColumn.type);
            markdown += `- \`${field.name}\`: Code=\`${field.type}\` DB=\`${dbColumn.type}\` ${typeMatch ? '✓' : '⚠'}\n`;
          });
          markdown += `\n`;
        }
      });
    }
    
    return markdown;
  }

  /**
   * Formats model comparison.
   */
  private formatModelComparison(
    modelName: string,
    codeModel: PrismaModel | undefined,
    dbTable: DatabaseTable | undefined
  ): string {
    let markdown = `# Model Comparison: ${modelName}\n\n`;
    
    markdown += `## Code Schema\n\n`;
    if (codeModel) {
      markdown += `**Fields:**\n`;
      codeModel.fields.forEach((field: PrismaField) => {
        markdown += `- \`${field.name}\`: \`${field.type}\`\n`;
      });
    } else {
      markdown += `*Model not found in code*\n`;
    }
    
    markdown += `\n## Database Schema\n\n`;
    if (dbTable) {
      markdown += `**Columns:**\n`;
      dbTable.columns.forEach((column: DatabaseColumn) => {
        markdown += `- \`${column.name}\`: \`${column.type}\`\n`;
      });
    } else {
      markdown += `*Table not found in database*\n`;
    }
    
    return markdown;
  }

  /**
   * Compares Prisma and database types.
   */
  private compareTypes(prismaType: string, dbType: string): boolean {
    // Simple type comparison - could be enhanced
    const normalizedPrisma = prismaType.toLowerCase();
    const normalizedDb = dbType.toLowerCase();
    
    // Map common type equivalences
    const typeMap: Record<string, string[]> = {
      'string': ['varchar', 'text', 'char'],
      'int': ['integer', 'int4'],
      'bigint': ['bigint', 'int8'],
      'boolean': ['boolean', 'bool'],
      'datetime': ['timestamp', 'timestamptz'],
      'float': ['real', 'double precision'],
    };

    for (const [prisma, dbTypes] of Object.entries(typeMap)) {
      if (normalizedPrisma.includes(prisma)) {
        return dbTypes.some(db => normalizedDb.includes(db));
      }
    }

    return normalizedPrisma === normalizedDb;
  }
}

/**
 * Schema comparison result.
 */
interface SchemaComparison {
  codeOnly: PrismaModel[];
  dbOnly: DatabaseTable[];
  both: Array<{
    name: string;
    codeModel: PrismaModel;
    dbTable: DatabaseTable;
  }>;
}

