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
    // Validate template
    const templateResult = InputValidator.validateString(template, {
      maxLength: 10000,
      minLength: 1,
      blockedPatterns: InputValidator.getSqlInjectionPatterns(),
    });

    if (!templateResult.valid) {
      throw new Error(`Invalid SQL template: ${templateResult.error}`);
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
      query: templateResult.sanitized!,
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
      // Validate string
      const stringResult = InputValidator.validateString(param, {
        maxLength: 10000,
        blockedPatterns: InputValidator.getSqlInjectionPatterns(),
      });

      if (!stringResult.valid) {
        throw new Error(`Parameter ${index}: ${stringResult.error}`);
      }

      return stringResult.sanitized!;
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
    // Validate identifier
    const validation = InputValidator.validateIdentifier(identifier, {
      maxLength: 255,
      minLength: 1,
    });

    if (!validation.valid) {
      throw new Error(`Invalid identifier: ${validation.error}`);
    }

    // Escape with backticks
    return `\`${validation.sanitized!.replace(/`/g, '``')}\``;
  }

  /**
   * Validate SQL query for dangerous patterns
   * 
   * @param query - SQL query to validate
   * @returns True if query appears safe
   */
  static validateQuery(query: string): { valid: boolean; error?: string } {
    const validation = InputValidator.validateString(query, {
      maxLength: 100000,
      minLength: 1,
      blockedPatterns: InputValidator.getSqlInjectionPatterns(),
    });

    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error,
      };
    }

    // Check for dangerous SQL operations
    const dangerousPatterns = [
      /DROP\s+TABLE/gi,
      /DROP\s+DATABASE/gi,
      /TRUNCATE\s+TABLE/gi,
      /DELETE\s+FROM.*WHERE\s+1\s*=\s*1/gi, // DELETE without WHERE
      /UPDATE.*SET.*WHERE\s+1\s*=\s*1/gi, // UPDATE without proper WHERE
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
    const columnList = validatedColumns.map((col) => this.escapeIdentifier(col)).join(', ');
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

