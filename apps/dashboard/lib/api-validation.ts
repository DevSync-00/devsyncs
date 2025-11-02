import { NextRequest, NextResponse } from 'next/server';

/**
 * Validate request body structure
 */
export function validateRequestBody<T extends Record<string, any>>(
  body: any,
  schema: { [K in keyof T]: (value: any) => boolean }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [key, validator] of Object.entries(schema)) {
    if (!(key in body)) {
      errors.push(`Missing required field: ${key}`);
      continue;
    }

    if (!validator(body[key])) {
      errors.push(`Invalid value for field: ${key}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate UUID format
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validate email format
 */
export function isValidEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Validate slug format
 */
export function isValidSlug(value: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(value);
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength?: number): string {
  let sanitized = input.trim();
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
  sanitized = sanitized.replace(/<[^>]+>/g, '');

  return sanitized;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(params: {
  page?: string;
  perPage?: string;
}): { valid: boolean; page: number; perPage: number; errors: string[] } {
  const errors: string[] = [];
  
  let page = 1;
  let perPage = 12;

  if (params.page) {
    const parsedPage = parseInt(params.page, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      errors.push('Invalid page parameter');
    } else {
      page = parsedPage;
    }
  }

  if (params.perPage) {
    const parsedPerPage = parseInt(params.perPage, 10);
    if (isNaN(parsedPerPage) || parsedPerPage < 1 || parsedPerPage > 100) {
      errors.push('Invalid perPage parameter (must be between 1 and 100)');
    } else {
      perPage = parsedPerPage;
    }
  }

  return {
    valid: errors.length === 0,
    page,
    perPage,
    errors,
  };
}

/**
 * Create standardized error response
 */
export function errorResponse(
  error: string | Error,
  status: number = 500,
  details?: Record<string, any>
): NextResponse {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return NextResponse.json(
    {
      error: errorMessage,
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && details && { details }),
    },
    { status }
  );
}

/**
 * Validate request size
 */
export async function validateRequestSize(
  request: NextRequest,
  maxSizeBytes: number = 1024 * 1024 // 1MB default
): Promise<{ valid: boolean; error?: string }> {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSizeBytes) {
      return {
        valid: false,
        error: `Request body too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB`,
      };
    }
  }

  return { valid: true };
}

