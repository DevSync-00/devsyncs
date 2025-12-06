/**
 * Migration templates system.
 * 
 * Provides pre-built migration templates for common operations.
 */

import { MigrationTemplate } from './types';

/**
 * Default migration templates.
 */
export const DEFAULT_MIGRATION_TEMPLATES: MigrationTemplate[] = [
  {
    id: 'add_column',
    name: 'Add Column',
    description: 'Add a new column to an existing table',
    category: 'schema',
    sqlTemplate: 'ALTER TABLE {{table_name}} ADD COLUMN {{column_name}} {{column_type}} {{nullable}} {{default_value}};',
    placeholders: [
      {
        name: 'table_name',
        description: 'Name of the table',
        type: 'string',
        required: true,
        validation: '^[a-zA-Z_][a-zA-Z0-9_]*$',
      },
      {
        name: 'column_name',
        description: 'Name of the column',
        type: 'string',
        required: true,
        validation: '^[a-zA-Z_][a-zA-Z0-9_]*$',
      },
      {
        name: 'column_type',
        description: 'Column data type',
        type: 'enum',
        required: true,
        enumValues: ['VARCHAR(255)', 'INTEGER', 'BIGINT', 'BOOLEAN', 'TIMESTAMP', 'TEXT', 'UUID', 'JSONB'],
      },
      {
        name: 'nullable',
        description: 'Whether column is nullable',
        type: 'enum',
        required: false,
        defaultValue: 'NULL',
        enumValues: ['NULL', 'NOT NULL'],
      },
      {
        name: 'default_value',
        description: 'Default value (optional, e.g., DEFAULT \'\' or DEFAULT NOW())',
        type: 'string',
        required: false,
      },
    ],
    example: 'ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT \'\';',
  },
  {
    id: 'drop_column',
    name: 'Drop Column',
    description: 'Remove a column from a table',
    category: 'schema',
    sqlTemplate: 'ALTER TABLE {{table_name}} DROP COLUMN {{column_name}};',
    placeholders: [
      {
        name: 'table_name',
        description: 'Name of the table',
        type: 'string',
        required: true,
      },
      {
        name: 'column_name',
        description: 'Name of the column to drop',
        type: 'string',
        required: true,
      },
    ],
    example: 'ALTER TABLE users DROP COLUMN old_field;',
  },
  {
    id: 'alter_column_type',
    name: 'Alter Column Type',
    description: 'Change the data type of a column',
    category: 'schema',
    sqlTemplate: 'ALTER TABLE {{table_name}} ALTER COLUMN {{column_name}} TYPE {{new_type}} {{using_clause}};',
    placeholders: [
      {
        name: 'table_name',
        description: 'Name of the table',
        type: 'string',
        required: true,
      },
      {
        name: 'column_name',
        description: 'Name of the column',
        type: 'string',
        required: true,
      },
      {
        name: 'new_type',
        description: 'New data type',
        type: 'enum',
        required: true,
        enumValues: ['VARCHAR(255)', 'INTEGER', 'BIGINT', 'BOOLEAN', 'TIMESTAMP', 'TEXT', 'UUID', 'JSONB'],
      },
      {
        name: 'using_clause',
        description: 'USING clause for type conversion (optional)',
        type: 'string',
        required: false,
      },
    ],
    example: 'ALTER TABLE users ALTER COLUMN age TYPE INTEGER USING age::INTEGER;',
  },
  {
    id: 'create_table',
    name: 'Create Table',
    description: 'Create a new table',
    category: 'schema',
    sqlTemplate: 'CREATE TABLE {{table_name}} (\n  {{columns}}\n);',
    placeholders: [
      {
        name: 'table_name',
        description: 'Name of the table',
        type: 'string',
        required: true,
      },
      {
        name: 'columns',
        description: 'Column definitions (comma-separated, e.g., id UUID PRIMARY KEY, name VARCHAR(255) NOT NULL)',
        type: 'string',
        required: true,
      },
    ],
    example: 'CREATE TABLE users (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(255) UNIQUE,\n  created_at TIMESTAMP DEFAULT NOW()\n);',
  },
  {
    id: 'drop_table',
    name: 'Drop Table',
    description: 'Remove a table (WARNING: This will delete all data)',
    category: 'schema',
    sqlTemplate: 'DROP TABLE IF EXISTS {{table_name}} CASCADE;',
    placeholders: [
      {
        name: 'table_name',
        description: 'Name of the table to drop',
        type: 'string',
        required: true,
      },
    ],
    example: 'DROP TABLE IF EXISTS old_table CASCADE;',
  },
  {
    id: 'add_index',
    name: 'Add Index',
    description: 'Create an index on one or more columns',
    category: 'index',
    sqlTemplate: 'CREATE {{unique}} INDEX {{index_name}} ON {{table_name}} ({{columns}});',
    placeholders: [
      {
        name: 'unique',
        description: 'Whether index is unique',
        type: 'enum',
        required: false,
        defaultValue: '',
        enumValues: ['', 'UNIQUE'],
      },
      {
        name: 'index_name',
        description: 'Name of the index',
        type: 'string',
        required: true,
      },
      {
        name: 'table_name',
        description: 'Name of the table',
        type: 'string',
        required: true,
      },
      {
        name: 'columns',
        description: 'Column names (comma-separated)',
        type: 'string',
        required: true,
      },
    ],
    example: 'CREATE UNIQUE INDEX idx_users_email ON users (email);',
  },
  {
    id: 'drop_index',
    name: 'Drop Index',
    description: 'Remove an index',
    category: 'index',
    sqlTemplate: 'DROP INDEX IF EXISTS {{index_name}};',
    placeholders: [
      {
        name: 'index_name',
        description: 'Name of the index to drop',
        type: 'string',
        required: true,
      },
    ],
    example: 'DROP INDEX IF EXISTS idx_users_email;',
  },
  {
    id: 'add_foreign_key',
    name: 'Add Foreign Key',
    description: 'Add a foreign key constraint',
    category: 'constraint',
    sqlTemplate: 'ALTER TABLE {{table_name}} ADD CONSTRAINT {{constraint_name}} FOREIGN KEY ({{column_name}}) REFERENCES {{referenced_table}} ({{referenced_column}}) {{on_delete}} {{on_update}};',
    placeholders: [
      {
        name: 'table_name',
        description: 'Name of the source table',
        type: 'string',
        required: true,
      },
      {
        name: 'constraint_name',
        description: 'Name of the foreign key constraint',
        type: 'string',
        required: true,
      },
      {
        name: 'column_name',
        description: 'Name of the column in the source table',
        type: 'string',
        required: true,
      },
      {
        name: 'referenced_table',
        description: 'Name of the referenced table',
        type: 'string',
        required: true,
      },
      {
        name: 'referenced_column',
        description: 'Name of the referenced column',
        type: 'string',
        required: true,
      },
      {
        name: 'on_delete',
        description: 'ON DELETE action',
        type: 'enum',
        required: false,
        defaultValue: '',
        enumValues: ['', 'ON DELETE CASCADE', 'ON DELETE SET NULL', 'ON DELETE RESTRICT'],
      },
      {
        name: 'on_update',
        description: 'ON UPDATE action',
        type: 'enum',
        required: false,
        defaultValue: '',
        enumValues: ['', 'ON UPDATE CASCADE', 'ON UPDATE SET NULL', 'ON UPDATE RESTRICT'],
      },
    ],
    example: 'ALTER TABLE posts ADD CONSTRAINT fk_posts_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;',
  },
  {
    id: 'add_unique_constraint',
    name: 'Add Unique Constraint',
    description: 'Add a unique constraint to one or more columns',
    category: 'constraint',
    sqlTemplate: 'ALTER TABLE {{table_name}} ADD CONSTRAINT {{constraint_name}} UNIQUE ({{columns}});',
    placeholders: [
      {
        name: 'table_name',
        description: 'Name of the table',
        type: 'string',
        required: true,
      },
      {
        name: 'constraint_name',
        description: 'Name of the unique constraint',
        type: 'string',
        required: true,
      },
      {
        name: 'columns',
        description: 'Column names (comma-separated)',
        type: 'string',
        required: true,
      },
    ],
    example: 'ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);',
  },
  {
    id: 'rename_table',
    name: 'Rename Table',
    description: 'Rename a table',
    category: 'schema',
    sqlTemplate: 'ALTER TABLE {{old_table_name}} RENAME TO {{new_table_name}};',
    placeholders: [
      {
        name: 'old_table_name',
        description: 'Current name of the table',
        type: 'string',
        required: true,
      },
      {
        name: 'new_table_name',
        description: 'New name for the table',
        type: 'string',
        required: true,
      },
    ],
    example: 'ALTER TABLE old_users RENAME TO users;',
  },
  {
    id: 'rename_column',
    name: 'Rename Column',
    description: 'Rename a column',
    category: 'schema',
    sqlTemplate: 'ALTER TABLE {{table_name}} RENAME COLUMN {{old_column_name}} TO {{new_column_name}};',
    placeholders: [
      {
        name: 'table_name',
        description: 'Name of the table',
        type: 'string',
        required: true,
      },
      {
        name: 'old_column_name',
        description: 'Current name of the column',
        type: 'string',
        required: true,
      },
      {
        name: 'new_column_name',
        description: 'New name for the column',
        type: 'string',
        required: true,
      },
    ],
    example: 'ALTER TABLE users RENAME COLUMN old_name TO name;',
  },
];

/**
 * Migration template manager.
 */
export class MigrationTemplateManager {
  private templates: Map<string, MigrationTemplate> = new Map();

  constructor(templates: MigrationTemplate[] = DEFAULT_MIGRATION_TEMPLATES) {
    for (const template of templates) {
      this.templates.set(template.id, template);
    }
  }

  /**
   * Gets all templates.
   */
  getAllTemplates(): MigrationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Gets templates by category.
   */
  getTemplatesByCategory(category: MigrationTemplate['category']): MigrationTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  /**
   * Gets a template by ID.
   */
  getTemplate(id: string): MigrationTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Renders a template with provided values.
   */
  renderTemplate(templateId: string, values: Record<string, string>): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let sql = template.sqlTemplate;

    // Replace placeholders
    for (const placeholder of template.placeholders) {
      const value = values[placeholder.name];
      if (placeholder.required && !value) {
        throw new Error(`Required placeholder missing: ${placeholder.name}`);
      }

      // Validate enum values
      if (placeholder.type === 'enum' && placeholder.enumValues) {
        if (value && !placeholder.enumValues.includes(value)) {
          throw new Error(`Invalid value for ${placeholder.name}: ${value}. Must be one of: ${placeholder.enumValues.join(', ')}`);
        }
      }

      // Replace placeholder
      const regex = new RegExp(`\\{\\{${placeholder.name}\\}\\}`, 'g');
      sql = sql.replace(regex, value || placeholder.defaultValue || '');
    }

    // Clean up empty optional placeholders
    sql = sql.replace(/\s+/g, ' ').trim();

    return sql;
  }

  /**
   * Validates template values.
   */
  validateTemplateValues(templateId: string, values: Record<string, string>): {
    valid: boolean;
    errors: string[];
  } {
    const template = this.templates.get(templateId);
    if (!template) {
      return { valid: false, errors: [`Template not found: ${templateId}`] };
    }

    const errors: string[] = [];

    // Check required placeholders
    for (const placeholder of template.placeholders) {
      if (placeholder.required && !values[placeholder.name]) {
        errors.push(`Required placeholder missing: ${placeholder.name}`);
      }

      // Validate enum values
      if (placeholder.type === 'enum' && placeholder.enumValues && values[placeholder.name]) {
        if (!placeholder.enumValues.includes(values[placeholder.name])) {
          errors.push(`Invalid value for ${placeholder.name}: ${values[placeholder.name]}. Must be one of: ${placeholder.enumValues.join(', ')}`);
        }
      }

      // Validate against pattern if provided
      if (placeholder.validation && values[placeholder.name]) {
        const regex = new RegExp(placeholder.validation);
        if (!regex.test(values[placeholder.name])) {
          errors.push(`Invalid format for ${placeholder.name}: ${values[placeholder.name]}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

