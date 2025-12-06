/**
 * Default custom prompts for AI features.
 */

import { CustomPrompt } from './types';

/**
 * Default custom prompts.
 */
export const DEFAULT_CUSTOM_PROMPTS: CustomPrompt[] = [
  {
    id: 'explain-mismatch',
    name: 'Explain Mismatch',
    description: 'Get a detailed explanation of a schema mismatch',
    template: `You are a database schema expert. Explain the following mismatch in detail:

Mismatch Type: {{mismatch_type}}
Model: {{model_name}}
Field: {{field_name}}
Code Value: {{code_value}}
Database Value: {{db_value}}

Provide:
1. What the mismatch means
2. Why it occurred
3. How to fix it
4. Potential risks`,
    placeholders: [
      {
        name: 'mismatch_type',
        description: 'Type of mismatch (e.g., missing_field, type_mismatch)',
        required: true,
        example: 'missing_field',
      },
      {
        name: 'model_name',
        description: 'Name of the model/table',
        required: true,
        example: 'User',
      },
      {
        name: 'field_name',
        description: 'Name of the field/column',
        required: false,
        example: 'email',
      },
      {
        name: 'code_value',
        description: 'Value expected in code',
        required: false,
        example: 'String',
      },
      {
        name: 'db_value',
        description: 'Value in database',
        required: false,
        example: 'VARCHAR(255)',
      },
    ],
    category: 'schema',
    active: true,
    usageCount: 0,
  },
  {
    id: 'generate-migration-help',
    name: 'Generate Migration Help',
    description: 'Get help generating a migration for specific mismatches',
    template: `You are a database migration expert. Help generate a migration for:

Mismatches:
{{mismatches}}

Database Type: {{database_type}}

Provide:
1. SQL migration statements
2. Explanation of each statement
3. Rollback SQL
4. Safety considerations`,
    placeholders: [
      {
        name: 'mismatches',
        description: 'JSON array of mismatches',
        required: true,
        example: '[{"type": "missing_field", "model": "User", "field": "email"}]',
      },
      {
        name: 'database_type',
        description: 'Database type (e.g., PostgreSQL, MySQL)',
        required: true,
        example: 'PostgreSQL',
      },
    ],
    category: 'migration',
    active: true,
    usageCount: 0,
  },
  {
    id: 'optimize-schema',
    name: 'Optimize Schema',
    description: 'Get suggestions for optimizing database schema',
    template: `You are a database performance expert. Analyze this schema and provide optimization suggestions:

Schema:
{{schema}}

Current Issues:
{{issues}}

Provide:
1. Performance optimization suggestions
2. Index recommendations
3. Normalization opportunities
4. Query optimization tips`,
    placeholders: [
      {
        name: 'schema',
        description: 'JSON representation of the schema',
        required: true,
        example: '{"tables": [...]}',
      },
      {
        name: 'issues',
        description: 'Known performance issues or concerns',
        required: false,
        example: 'Slow queries on user table',
      },
    ],
    category: 'optimization',
    active: true,
    usageCount: 0,
  },
  {
    id: 'debug-error',
    name: 'Debug Error',
    description: 'Get help debugging a database or migration error',
    template: `You are a database troubleshooting expert. Help debug this error:

Error Message: {{error_message}}
Error Code: {{error_code}}
Context: {{context}}
SQL (if applicable): {{sql}}

Provide:
1. Root cause analysis
2. Step-by-step solution
3. Prevention strategies
4. Related resources`,
    placeholders: [
      {
        name: 'error_message',
        description: 'The error message',
        required: true,
        example: 'Column does not exist',
      },
      {
        name: 'error_code',
        description: 'Error code (if available)',
        required: false,
        example: '42703',
      },
      {
        name: 'context',
        description: 'Context where error occurred',
        required: false,
        example: 'Running migration to add column',
      },
      {
        name: 'sql',
        description: 'SQL statement that caused error (if applicable)',
        required: false,
        example: 'ALTER TABLE users ADD COLUMN email VARCHAR(255);',
      },
    ],
    category: 'error',
    active: true,
    usageCount: 0,
  },
  {
    id: 'best-practices',
    name: 'Best Practices',
    description: 'Get best practices for database schema design',
    template: `You are a database architecture expert. Provide best practices for:

Topic: {{topic}}
Current Schema: {{schema}}
Requirements: {{requirements}}

Provide:
1. Best practices for this topic
2. Examples
3. Common pitfalls to avoid
4. Industry standards`,
    placeholders: [
      {
        name: 'topic',
        description: 'Topic to get best practices for',
        required: true,
        example: 'indexing strategy',
      },
      {
        name: 'schema',
        description: 'Current schema (optional)',
        required: false,
        example: '{"tables": [...]}',
      },
      {
        name: 'requirements',
        description: 'Specific requirements or constraints',
        required: false,
        example: 'High read performance, low write frequency',
      },
    ],
    category: 'general',
    active: true,
    usageCount: 0,
  },
];

