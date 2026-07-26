/**
 * SQL query sanitization and parameterization utilities.
 * 
 * Provides safe SQL query construction using parameterized queries
 * to prevent SQL injection attacks.
 */

import { InputValidator } from './inputValidation';

/**
 * SQL parameter value
 */
export type SqlParameter = string | number | boolean | null | Date | Buffer;

/**
 * Parameterized SQL query
 */
export interface ParameterizedQuery {
  /**
   * SQL query with placeholders
   */
  query: string;

  /**
   * Parameter values
   */
  parameters: SqlParameter[];
}

/**
 * SQL sanitization service
 */
export class SqlSanitization {
  /**
   * Create a parameterized query
   * 
   * @param template - SQL template with ? placeholders
   * @param params - Parameter values
   * @returns Parameterized query
   * 
   * @example
   * ```typescript
   * const query = SqlSanitization.parameterize(
   *   'SELECT * FROM users WHERE id = ? AND name = ?',
   *   [1, 'John']
   * );
   * ```
   */
  static parameterize(template: string, params: SqlParameter[]): ParameterizedQuery {
    if (typeof template !== 'string' || template.trim().length === 0) {
      throw new Error('Invalid SQL template: Template must be a non-empty string');
    }

    if (template.length > 10000) {
      throw new Error('Invalid SQL template: Template is too long');
    }

    // Templates legitimately contain SQL operators, wildcards and placeholders.
    // Only reject clear statement chaining and SQL comment injection here.
    const dangerousTemplate = /;\s*(drop|truncate|alter|create|grant|revoke)\b|--|\/\*/i;
    if (dangerousTemplate.test(template)) {
      throw new Error('Invalid SQL template: Potentially dangerous SQL detected');
    }

    // Count placeholders
    const placeholderCount = (template.match(/\?/g) || []).length;
    if (placeholderCount !== params.length) {
      throw new Error(
        `Parameter count mismatch: template has ${placeholderCount} placeholders, but ${params.length} parameters provided`
      );
    }

    // Validate and sanitize parameters
    const sanitizedParams: SqlParameter[] = params.map((param, index) => {
      return this.sanitizeParameter(param, index);
    });

    return {
      query: template,
      parameters: sanitizedParams,
    };
  }

  /**
   * Sanitize a SQL parameter
   * 
   * @param param - Parameter value
   * @param index - Parameter index (for error messages)
   * @returns Sanitized parameter
   */
  static sanitizeParameter(param: SqlParameter, index: number = 0): SqlParameter {
    if (param === null || param === undefined) {
      return null;
    }

    if (typeof param === 'number') {
      // Validate number
      if (!isFinite(param)) {
        throw new Error(`Parameter ${index}: Invalid number value`);
      }
      return param;
    }

    if (typeof param === 'boolean') {
      return param;
    }

    if (param instanceof Date) {
      return param;
    }

    if (Buffer.isBuffer(param)) {
      return param;
    }

    if (typeof param === 'string') {
      if (param.length > 10000) {
        throw new Error(`Parameter ${index}: String too long`);
      }

      // Parameter values are passed separately to the database driver. Permit
      // normal punctuation and email addresses while rejecting obvious
      // attempts to chain statements or introduce SQL comments.
      const dangerousValue = /;\s*(drop|truncate|alter|create|grant|revoke)\b|--|\/\*|\*\//i;
      if (dangerousValue.test(param)) {
        throw new Error(`Parameter ${index}: Value contains invalid characters or patterns`);
      }

      return param;
    }

    throw new Error(`Parameter ${index}: Unsupported type ${typeof param}`);
  }

  /**
   * Escape a string for use in SQL (use parameterized queries instead when possible)
   * 
   * @param value - String to escape
   * @returns Escaped string
   * 
   * @deprecated Use parameterized queries instead
   */
  static escapeString(value: string): string {
    if (typeof value !== 'string') {
      throw new Error('Value must be a string');
    }

    // Validate input
    const validation = InputValidator.validateString(value, {
      blockedPatterns: InputValidator.getSqlInjectionPatterns(),
    });

    if (!validation.valid) {
      throw new Error(`Invalid string: ${validation.error}`);
    }

    // Escape special characters
    return validation.sanitized!
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "''")
      .replace(/"/g, '\\"')
      .replace(/\0/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\x1a/g, '\\Z');
  }

  /**
   * Escape an identifier (table name, column name, etc.)
   * 
   * @param identifier - Identifier to escape
   * @returns Escaped identifier
   */
  static escapeIdentifier(identifier: string): string {
    if (typeof identifier !== 'string' || identifier.length === 0 || identifier.length > 255) {
      throw new Error('Invalid identifier: Value does not match required pattern');
    }

    // Backticks are valid input because they are doubled below. Validate the
    // underlying identifier after removing those escapable delimiters.
    const unescaped = identifier.replace(/`/g, '');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(unescaped)) {
      throw new Error('Invalid identifier: Value does not match required pattern');
    }

    // Escape with backticks
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  /**
   * Validate SQL query for dangerous patterns
   * 
   * @param query - SQL query to validate
   * @returns True if query appears safe
   */
  static validateQuery(query: string): { valid: boolean; error?: string } {
    if (typeof query !== 'string' || query.trim().length === 0) {
      return {
        valid: false,
        error: 'Query must be a non-empty string',
      };
    }

    if (query.length > 100000) {
      return {
        valid: false,
        error: 'Query is too long',
      };
    }

    // Check for dangerous SQL operations
    const dangerousPatterns = [
      /--/,
      /\/\*/,
      /\bDROP\s+TABLE\b/i,
      /\bDROP\s+DATABASE\b/i,
      /\bTRUNCATE\s+TABLE\b/i,
      /\bDELETE\s+FROM.*WHERE\s+1\s*=\s*1/i, // DELETE without WHERE
      /\bUPDATE.*SET.*WHERE\s+1\s*=\s*1/i, // UPDATE without proper WHERE
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        return {
          valid: false,
          error: 'Query contains potentially dangerous operations',
        };
      }
    }

    return {
      valid: true,
    };
  }

  /**
   * Build a SELECT query safely
   * 
   * @param table - Table name
   * @param columns - Column names (optional, defaults to *)
   * @param where - WHERE clause parameters
   * @returns Parameterized query
   */
  static buildSelect(
    table: string,
    columns: string[] = ['*'],
    where?: Record<string, SqlParameter>
  ): ParameterizedQuery {
    // Validate table name
    const tableValidation = InputValidator.validateIdentifier(table);
    if (!tableValidation.valid) {
      throw new Error(`Invalid table name: ${tableValidation.error}`);
    }

    // Validate column names
    const validatedColumns = columns.map((col, index) => {
      if (col === '*') {
        return col;
      }
      const colValidation = InputValidator.validateIdentifier(col);
      if (!colValidation.valid) {
        throw new Error(`Invalid column name at index ${index}: ${colValidation.error}`);
      }
      return colValidation.sanitized!;
    });

    // Build query
    const columnList = validatedColumns
      .map((col) => (col === '*' ? '*' : this.escapeIdentifier(col)))
      .join(', ');
    let query = `SELECT ${columnList} FROM ${this.escapeIdentifier(tableValidation.sanitized!)}`;
    const parameters: SqlParameter[] = [];

    // Add WHERE clause
    if (where && Object.keys(where).length > 0) {
      const conditions: string[] = [];
      for (const [column, value] of Object.entries(where)) {
        const colValidation = InputValidator.validateIdentifier(column);
        if (!colValidation.valid) {
          throw new Error(`Invalid column name in WHERE: ${colValidation.error}`);
        }
        conditions.push(`${this.escapeIdentifier(colValidation.sanitized!)} = ?`);
        parameters.push(this.sanitizeParameter(value));
      }
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    return {
      query,
      parameters,
    };
  }

  /**
   * Build an INSERT query safely
   * 
   * @param table - Table name
   * @param data - Data to insert
   * @returns Parameterized query
   */
  static buildInsert(table: string, data: Record<string, SqlParameter>): ParameterizedQuery {
    // Validate table name
    const tableValidation = InputValidator.validateIdentifier(table);
    if (!tableValidation.valid) {
      throw new Error(`Invalid table name: ${tableValidation.error}`);
    }

    if (Object.keys(data).length === 0) {
      throw new Error('No data provided for INSERT');
    }

    // Validate and escape column names
    const columns: string[] = [];
    const values: SqlParameter[] = [];
    const placeholders: string[] = [];

    for (const [column, value] of Object.entries(data)) {
      const colValidation = InputValidator.validateIdentifier(column);
      if (!colValidation.valid) {
        throw new Error(`Invalid column name: ${colValidation.error}`);
      }
      columns.push(this.escapeIdentifier(colValidation.sanitized!));
      values.push(this.sanitizeParameter(value));
      placeholders.push('?');
    }

    const query = `INSERT INTO ${this.escapeIdentifier(tableValidation.sanitized!)} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;

    return {
      query,
      parameters: values,
    };
  }

  /**
   * Build an UPDATE query safely
   * 
   * @param table - Table name
   * @param data - Data to update
   * @param where - WHERE clause parameters
   * @returns Parameterized query
   */
  static buildUpdate(
    table: string,
    data: Record<string, SqlParameter>,
    where: Record<string, SqlParameter>
  ): ParameterizedQuery {
    // Validate table name
    const tableValidation = InputValidator.validateIdentifier(table);
    if (!tableValidation.valid) {
      throw new Error(`Invalid table name: ${tableValidation.error}`);
    }

    if (Object.keys(data).length === 0) {
      throw new Error('No data provided for UPDATE');
    }

    if (Object.keys(where).length === 0) {
      throw new Error('WHERE clause required for UPDATE');
    }

    const parameters: SqlParameter[] = [];

    // Build SET clause
    const setClauses: string[] = [];
    for (const [column, value] of Object.entries(data)) {
      const colValidation = InputValidator.validateIdentifier(column);
      if (!colValidation.valid) {
        throw new Error(`Invalid column name in SET: ${colValidation.error}`);
      }
      setClauses.push(`${this.escapeIdentifier(colValidation.sanitized!)} = ?`);
      parameters.push(this.sanitizeParameter(value));
    }

    // Build WHERE clause
    const whereClauses: string[] = [];
    for (const [column, value] of Object.entries(where)) {
      const colValidation = InputValidator.validateIdentifier(column);
      if (!colValidation.valid) {
        throw new Error(`Invalid column name in WHERE: ${colValidation.error}`);
      }
      whereClauses.push(`${this.escapeIdentifier(colValidation.sanitized!)} = ?`);
      parameters.push(this.sanitizeParameter(value));
    }

    const query = `UPDATE ${this.escapeIdentifier(tableValidation.sanitized!)} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;

    return {
      query,
      parameters,
    };
  }

  /**
   * Build a DELETE query safely
   * 
   * @param table - Table name
   * @param where - WHERE clause parameters (required)
   * @returns Parameterized query
   */
  static buildDelete(table: string, where: Record<string, SqlParameter>): ParameterizedQuery {
    // Validate table name
    const tableValidation = InputValidator.validateIdentifier(table);
    if (!tableValidation.valid) {
      throw new Error(`Invalid table name: ${tableValidation.error}`);
    }

    if (Object.keys(where).length === 0) {
      throw new Error('WHERE clause required for DELETE');
    }

    const parameters: SqlParameter[] = [];
    const whereClauses: string[] = [];

    for (const [column, value] of Object.entries(where)) {
      const colValidation = InputValidator.validateIdentifier(column);
      if (!colValidation.valid) {
        throw new Error(`Invalid column name in WHERE: ${colValidation.error}`);
      }
      whereClauses.push(`${this.escapeIdentifier(colValidation.sanitized!)} = ?`);
      parameters.push(this.sanitizeParameter(value));
    }

    const query = `DELETE FROM ${this.escapeIdentifier(tableValidation.sanitized!)} WHERE ${whereClauses.join(' AND ')}`;

    return {
      query,
      parameters,
    };
  }
}

