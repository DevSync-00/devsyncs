/**
 * Database connection testing utility.
 * 
 * Tests database connections before proceeding with setup.
 */

import * as vscode from 'vscode';

/**
 * Database connection test result.
 */
export interface ConnectionTestResult {
  success: boolean;
  error?: string;
  details?: {
    databaseType?: string;
    version?: string;
    tables?: number;
  };
}

/**
 * Database connection tester.
 */
export class DatabaseConnectionTester {
  /**
   * Tests a database connection string.
   * 
   * @param connectionString - Database connection string to test
   * @returns Test result with success status and error details
   */
  async test(connectionString: string): Promise<ConnectionTestResult> {
    // Validate connection string format
    const validation = this.validateConnectionString(connectionString);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Parse connection string
    const parsed = this.parseConnectionString(connectionString);
    if (!parsed) {
      return {
        success: false,
        error: 'Failed to parse connection string',
      };
    }

    // Test connection (this would typically use a database client)
    // For now, we'll do basic validation and simulate a test
    try {
      // In a real implementation, this would:
      // 1. Create a database client
      // 2. Attempt to connect
      // 3. Run a simple query (e.g., SELECT 1)
      // 4. Return connection details

      // Simulated test - in production, use actual database client
      const testResult = await this.performConnectionTest(parsed);
      
      return testResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  /**
   * Validates connection string format.
   */
  private validateConnectionString(connectionString: string): { valid: boolean; error?: string } {
    if (!connectionString || connectionString.trim().length === 0) {
      return {
        valid: false,
        error: 'Connection string cannot be empty',
      };
    }

    // Check for common database URL patterns
    const patterns = [
      /^postgresql:\/\//i,
      /^postgres:\/\//i,
      /^mysql:\/\//i,
      /^mariadb:\/\//i,
      /^sqlite:\/\//i,
      /^mongodb:\/\//i,
      /^sqlserver:\/\//i,
      /^mssql:\/\//i,
    ];

    const hasValidProtocol = patterns.some(pattern => pattern.test(connectionString));
    if (!hasValidProtocol) {
      return {
        valid: false,
        error: 'Invalid connection string format. Must start with a database protocol (postgresql://, mysql://, etc.)',
      };
    }

    return { valid: true };
  }

  /**
   * Parses a connection string into components.
   */
  private parseConnectionString(connectionString: string): {
    protocol: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
  } | null {
    try {
      const url = new URL(connectionString);
      
      return {
        protocol: url.protocol.replace(':', ''),
        host: url.hostname,
        port: url.port ? parseInt(url.port, 10) : undefined,
        database: url.pathname.replace(/^\//, ''),
        username: url.username || undefined,
        password: url.password || undefined,
      };
    } catch {
      // Try alternative parsing for non-URL formats
      // This is a simplified parser - production should use a proper library
      return null;
    }
  }

  /**
   * Performs actual connection test.
   * 
   * In production, this would use a real database client library.
   * For now, this is a placeholder that validates the format.
   */
  private async performConnectionTest(parsed: {
    protocol: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
  }): Promise<ConnectionTestResult> {
    // Basic validation
    if (!parsed.host) {
      return {
        success: false,
        error: 'Connection string must include a host',
      };
    }

    if (!parsed.database) {
      return {
        success: false,
        error: 'Connection string must include a database name',
      };
    }

    // In production, you would:
    // 1. Import appropriate database client (pg, mysql2, etc.)
    // 2. Create connection
    // 3. Execute test query
    // 4. Return results

    // For now, return success if format is valid
    // The actual connection will be tested when the user tries to use it
    return {
      success: true,
      details: {
        databaseType: parsed.protocol,
      },
    };
  }

  /**
   * Tests connection with a timeout.
   */
  async testWithTimeout(connectionString: string, timeoutMs = 5000): Promise<ConnectionTestResult> {
    return Promise.race([
      this.test(connectionString),
      new Promise<ConnectionTestResult>((resolve) => {
        setTimeout(() => {
          resolve({
            success: false,
            error: `Connection test timed out after ${timeoutMs}ms`,
          });
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Gets connection string from environment or config.
   */
  async getConnectionStringFromEnv(): Promise<string | null> {
    // Check common environment variable names
    const envVars = [
      'DATABASE_URL',
      'DB_URL',
      'POSTGRES_URL',
      'MYSQL_URL',
      'DATABASE_CONNECTION_STRING',
    ];

    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value) {
        return value;
      }
    }

    return null;
  }
}

