/**
 * Quick start templates for DevSync.
 * 
 * Provides templates and examples to help users get started quickly.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Quick start template definition.
 */
export interface QuickStartTemplate {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'advanced' | 'integration';
  files: TemplateFile[];
}

/**
 * Template file definition.
 */
export interface TemplateFile {
  path: string;
  content: string;
  description?: string;
}

/**
 * Quick start template manager.
 */
export class QuickStartManager {
  /**
   * Available quick start templates.
   */
  private templates: QuickStartTemplate[] = [
    {
      id: 'basic-prisma',
      name: 'Basic Prisma Setup',
      description: 'Creates a basic Prisma schema with common models',
      category: 'basic',
      files: [
        {
          path: 'prisma/schema.prisma',
          content: `// This is your Prisma schema file
// Learn more: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`,
          description: 'Basic Prisma schema with User model',
        },
        {
          path: '.env',
          content: `# Database connection string
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
`,
          description: 'Environment file with database URL',
        },
      ],
    },
    {
      id: 'devsync-config',
      name: 'DevSync Configuration',
      description: 'Creates a DevSync configuration file',
      category: 'basic',
      files: [
        {
          path: '.devsync/config.json',
          content: `{
  "apiUrl": "https://dev-sync.dev",
  "projectId": "",
  "databaseConnection": "",
  "autoScan": true,
  "enableDiagnostics": true
}
`,
          description: 'DevSync configuration file',
        },
      ],
    },
    {
      id: 'full-stack',
      name: 'Full Stack Template',
      description: 'Complete setup with Prisma, DevSync, and example models',
      category: 'advanced',
      files: [
        {
          path: 'prisma/schema.prisma',
          content: `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`,
        },
        {
          path: '.devsync/config.json',
          content: `{
  "apiUrl": "https://dev-sync.dev",
  "autoScan": true,
  "enableDiagnostics": true
}
`,
        },
      ],
    },
  ];

  /**
   * Shows quick start template selection.
   */
  async showTemplateSelection(): Promise<QuickStartTemplate | null> {
    const items = this.templates.map(template => ({
      label: template.name,
      description: template.description,
      detail: `Category: ${template.category}`,
      template,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a quick start template',
      ignoreFocusOut: true,
    });

    return selected?.template || null;
  }

  /**
   * Applies a quick start template to the workspace.
   */
  async applyTemplate(template: QuickStartTemplate): Promise<{ success: boolean; error?: string }> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {
        success: false,
        error: 'No workspace folder found',
      };
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const createdFiles: string[] = [];
    const skippedFiles: string[] = [];

    try {
      for (const file of template.files) {
        const fullPath = path.join(rootPath, file.path);
        const dir = path.dirname(fullPath);

        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Check if file already exists
        if (fs.existsSync(fullPath)) {
          const overwrite = await vscode.window.showWarningMessage(
            `File ${file.path} already exists. Overwrite?`,
            'Overwrite',
            'Skip',
            'Cancel'
          );

          if (overwrite === 'Cancel') {
            return {
              success: false,
              error: 'Template application cancelled',
            };
          }

          if (overwrite === 'Skip') {
            skippedFiles.push(file.path);
            continue;
          }
        }

        // Write file
        fs.writeFileSync(fullPath, file.content, 'utf-8');
        createdFiles.push(file.path);
      }

      // Show summary
      const message = [
        `Template "${template.name}" applied successfully!`,
        `Created ${createdFiles.length} file(s)`,
        skippedFiles.length > 0 ? `Skipped ${skippedFiles.length} file(s)` : '',
      ].filter(Boolean).join('\n');

      await vscode.window.showInformationMessage(message);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply template',
      };
    }
  }

  /**
   * Gets all available templates.
   */
  getTemplates(): QuickStartTemplate[] {
    return this.templates;
  }

  /**
   * Gets templates by category.
   */
  getTemplatesByCategory(category: QuickStartTemplate['category']): QuickStartTemplate[] {
    return this.templates.filter(t => t.category === category);
  }

  /**
   * Creates a custom template from current workspace.
   */
  async createCustomTemplate(name: string, description: string): Promise<QuickStartTemplate | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length > 0) {
      return null;
    }

    // This would scan the workspace and create a template
    // For now, return null as this is an advanced feature
    return null;
  }
}

