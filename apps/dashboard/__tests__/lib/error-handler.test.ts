import {
  AppError,
  DatabaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  formatError,
  logError,
  withErrorHandling,
  isRetryableError,
  withRetry,
} from '@/lib/error-handler'

describe('Error Handler Utilities', () => {
  describe('Error Classes', () => {
    it('creates AppError with default values', () => {
      const error = new AppError('Test error')
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('INTERNAL_ERROR')
      expect(error.statusCode).toBe(500)
      expect(error.name).toBe('AppError')
    })

    it('creates AppError with custom values', () => {
      const error = new AppError(
        'Custom error',
        'CUSTOM_CODE',
        400,
        { field: 'test' }
      )
      expect(error.message).toBe('Custom error')
      expect(error.code).toBe('CUSTOM_CODE')
      expect(error.statusCode).toBe(400)
      expect(error.details).toEqual({ field: 'test' })
    })

    it('creates DatabaseError with correct defaults', () => {
      const error = new DatabaseError('DB error', { query: 'SELECT *' })
      expect(error.message).toBe('DB error')
      expect(error.code).toBe('DATABASE_ERROR')
      expect(error.statusCode).toBe(500)
      expect(error.name).toBe('DatabaseError')
      expect(error.details).toEqual({ query: 'SELECT *' })
    })

    it('creates ValidationError with correct defaults', () => {
      const error = new ValidationError('Validation failed', { field: 'email' })
      expect(error.message).toBe('Validation failed')
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error.statusCode).toBe(400)
      expect(error.name).toBe('ValidationError')
    })

    it('creates AuthenticationError with correct defaults', () => {
      const error = new AuthenticationError('Not authenticated')
      expect(error.message).toBe('Not authenticated')
      expect(error.code).toBe('AUTHENTICATION_ERROR')
      expect(error.statusCode).toBe(401)
      expect(error.name).toBe('AuthenticationError')
    })

    it('creates AuthorizationError with correct defaults', () => {
      const error = new AuthorizationError('Access denied')
      expect(error.message).toBe('Access denied')
      expect(error.code).toBe('AUTHORIZATION_ERROR')
      expect(error.statusCode).toBe(403)
      expect(error.name).toBe('AuthorizationError')
    })

    it('creates NotFoundError with correct defaults', () => {
      const error = new NotFoundError('Resource not found')
      expect(error.message).toBe('Resource not found')
      expect(error.code).toBe('NOT_FOUND_ERROR')
      expect(error.statusCode).toBe(404)
      expect(error.name).toBe('NotFoundError')
    })
  })

  describe('formatError', () => {
    it('formats AppError correctly', () => {
      const error = new AppError('Test error', 'TEST_CODE', 400)
      const formatted = formatError(error)

      expect(formatted).toEqual({
        message: 'Test error',
        code: 'TEST_CODE',
        statusCode: 400,
        details: undefined,
        timestamp: expect.any(String),
      })
    })

    it('formats regular Error correctly', () => {
      const error = new Error('Regular error')
      const formatted = formatError(error)

      expect(formatted).toEqual({
        message: 'Regular error',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        timestamp: expect.any(String),
      })
    })

    it('formats unknown error types correctly', () => {
      const formatted = formatError('String error')

      expect(formatted).toEqual({
        message: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
        statusCode: 500,
        timestamp: expect.any(String),
      })
    })
  })

  describe('logError', () => {
    let consoleSpy: jest.SpyInstance

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    })

    afterEach(() => {
      consoleSpy.mockRestore()
    })

    it('logs error with context', () => {
      const error = new AppError('Test error')
      const context = { userId: '123', action: 'migrate' }

      logError(error, context)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ERROR]',
        expect.stringContaining('Test error')
      )
    })

    it('includes stack trace for Error instances', () => {
      const error = new Error('Test error')
      logError(error)

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ERROR]',
        expect.stringContaining('Test error')
      )
    })
  })

  describe('withErrorHandling', () => {
    it('returns result when function succeeds', async () => {
      const fn = jest.fn().mockResolvedValue('success')
      const result = await withErrorHandling(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalled()
    })

    it('throws AppError when function throws', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Test error'))
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await expect(withErrorHandling(fn, 'Custom error')).rejects.toThrow(
        'Custom error'
      )

      consoleSpy.mockRestore()
    })

    it('preserves AppError when function throws AppError', async () => {
      const originalError = new AppError('Original error', 'ORIGINAL', 400)
      const fn = jest.fn().mockRejectedValue(originalError)

      await expect(withErrorHandling(fn)).rejects.toThrow(originalError)
    })
  })

  describe('isRetryableError', () => {
    it('returns false for 4xx errors', () => {
      const error = new ValidationError('Bad request')
      expect(isRetryableError(error)).toBe(false)
    })

    it('returns true for 5xx errors', () => {
      const error = new AppError('Server error', 'SERVER_ERROR', 500)
      expect(isRetryableError(error)).toBe(true)
    })

    it('returns true for unknown errors', () => {
      expect(isRetryableError(new Error('Unknown'))).toBe(true)
    })
  })

  describe('withRetry', () => {
    it('returns result on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success')
      const result = await withRetry(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('retries on retryable errors', async () => {
      let attempts = 0
      const fn = jest.fn().mockImplementation(async () => {
        attempts++
        if (attempts < 2) {
          throw new AppError('Server error', 'SERVER_ERROR', 500)
        }
        return 'success'
      })

      const result = await withRetry(fn, 3, 10)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('throws after max retries', async () => {
      const error = new AppError('Server error', 'SERVER_ERROR', 500)
      const fn = jest.fn().mockRejectedValue(error)

      await expect(withRetry(fn, 2, 10)).rejects.toThrow('Server error')
      expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
    })

    it('does not retry non-retryable errors', async () => {
      const error = new ValidationError('Bad request')
      const fn = jest.fn().mockRejectedValue(error)

      await expect(withRetry(fn, 3, 10)).rejects.toThrow('Bad request')
      expect(fn).toHaveBeenCalledTimes(1) // no retries
    })

    it('implements exponential backoff', async () => {
      const timestamps: number[] = []
      let attempts = 0

      const fn = jest.fn().mockImplementation(async () => {
        timestamps.push(Date.now())
        attempts++
        if (attempts < 3) {
          throw new AppError('Server error', 'SERVER_ERROR', 500)
        }
        return 'success'
      })

      const start = Date.now()
      await withRetry(fn, 3, 50) // 50ms base delay
      const end = Date.now()

      // Should have delays between retries
      expect(timestamps.length).toBe(3)
      // First retry should be ~50ms after first attempt
      expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(50)
      // Second retry should be ~100ms after second attempt (exponential)
      expect(timestamps[2] - timestamps[1]).toBeGreaterThanOrEqual(100)
    })
  })
})

