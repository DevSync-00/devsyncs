/**
 * Prisma schema auto-detection utility.
 * 
 * Automatically detects Prisma schema files in the workspace.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Prisma schema detector.
 */
export class PrismaSchemaDetector {
  /**
   * Detects Prisma schema files in the workspace.
   * 
   * @returns Path to the detected schema file, or null if not found
   */
  async detect(): Promise<string | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    // Common Prisma schema locations
    const commonPaths = [
      'schema.prisma',
      'prisma/schema.prisma',
      'src/schema.prisma',
      'lib/schema.prisma',
    ];

    // Search in all workspace folders
    for (const folder of workspaceFolders) {
      const folderPath = folder.uri.fsPath;

      // Check common paths
      for (const relativePath of commonPaths) {
        const fullPath = path.join(folderPath, relativePath);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }

      // Search recursively for schema.prisma files
      const found = await this.searchRecursive(folderPath, 'schema.prisma');
      if (found) {
        return found;
      }
    }

    return null;
  }

  /**
   * Recursively searches for a file in a directory.
   */
  private async searchRecursive(dir: string, filename: string, maxDepth = 5, currentDepth = 0): Promise<string | null> {
    if (currentDepth >= maxDepth) {
      return null;
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip node_modules and other common ignore directories
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'dist') {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isFile() && entry.name === filename) {
          return fullPath;
        }

        if (entry.isDirectory()) {
          const found = await this.searchRecursive(fullPath, filename, maxDepth, currentDepth + 1);
          if (found) {
            return found;
          }
        }
      }
    } catch (error) {
      // Ignore permission errors
    }

    return null;
  }

  /**
   * Validates that a file is a valid Prisma schema.
   */
  async validateSchema(schemaPath: string): Promise<{ valid: boolean; error?: string }> {
    if (!fs.existsSync(schemaPath)) {
      return {
        valid: false,
        error: 'Schema file does not exist',
      };
    }

    try {
      const content = fs.readFileSync(schemaPath, 'utf-8');
      
      // Basic validation - check for Prisma schema markers
      if (!content.includes('datasource') && !content.includes('model')) {
        return {
          valid: false,
          error: 'File does not appear to be a valid Prisma schema',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Failed to read schema file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Gets all Prisma schema files in the workspace.
   */
  async getAllSchemas(): Promise<string[]> {
    const schemas: string[] = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return schemas;
    }

    for (const folder of workspaceFolders) {
      const found = await this.findAllSchemas(folder.uri.fsPath);
      schemas.push(...found);
    }

    return schemas;
  }

  /**
   * Finds all schema.prisma files recursively.
   */
  private async findAllSchemas(dir: string, maxDepth = 5, currentDepth = 0): Promise<string[]> {
    const schemas: string[] = [];

    if (currentDepth >= maxDepth) {
      return schemas;
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip node_modules and other common ignore directories
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'dist') {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isFile() && entry.name === 'schema.prisma') {
          schemas.push(fullPath);
        }

        if (entry.isDirectory()) {
          const found = await this.findAllSchemas(fullPath, maxDepth, currentDepth + 1);
          schemas.push(...found);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }

    return schemas;
  }
}

