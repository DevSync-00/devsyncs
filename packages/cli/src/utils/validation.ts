/**
 * Validation utilities for configuration and inputs
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate database connection string
 */
export function validateConnectionString(connectionString: string): ValidationResult {
  const errors: string[] = [];

  if (!connectionString || !connectionString.trim()) {
    errors.push('Connection string is required');
    return { valid: false, errors };
  }

  // Check if it's a PostgreSQL connection string
  if (!connectionString.startsWith('postgresql://') && 
      !connectionString.startsWith('postgres://')) {
    errors.push('Connection string must start with postgresql:// or postgres://');
  }

  // Basic format validation
  try {
    const url = new URL(connectionString);
    if (!url.hostname) {
      errors.push('Connection string must include a hostname');
    }
  } catch {
    errors.push('Connection string is not a valid URL');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate project path
 */
export function validateProjectPath(path: string): ValidationResult {
  const errors: string[] = [];

  if (!path || !path.trim()) {
    errors.push('Project path is required');
    return { valid: false, errors };
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate API URL
 */
export function validateApiUrl(url: string): ValidationResult {
  const errors: string[] = [];

  if (!url || !url.trim()) {
    errors.push('API URL is required');
    return { valid: false, errors };
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors.push('API URL must use http:// or https://');
    }
  } catch {
    errors.push('API URL is not a valid URL');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate API key format (basic check)
 */
export function validateApiKey(apiKey: string): ValidationResult {
  const errors: string[] = [];

  if (!apiKey || !apiKey.trim()) {
    errors.push('API key is required');
    return { valid: false, errors };
  }

  if (apiKey.length < 10) {
    errors.push('API key appears to be too short');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

