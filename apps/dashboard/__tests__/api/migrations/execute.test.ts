/**
 * @jest-environment node
 */

/**
 * Integration tests for migration execution API
 * 
 * These tests verify the migration execution API endpoint behavior,
 * including authentication, authorization, validation, and execution.
 */

import { POST } from '@/app/api/migrations/[id]/execute/route'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { createSupabaseServerMock } from '../../helpers/supabase-server-mock'

// Mock Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

// Mock pg Pool
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    end: jest.fn(),
  })),
}))

describe('/api/migrations/[id]/execute', () => {
  let supabaseMock: ReturnType<typeof createSupabaseServerMock>
  let mockPool: { connect: jest.Mock; end: jest.Mock }
  let mockClient: { query: jest.Mock; release: jest.Mock }

  beforeEach(() => {
    jest.clearAllMocks()

    supabaseMock = createSupabaseServerMock()
    ;(createClient as jest.Mock).mockReturnValue(supabaseMock.client)

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    }

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn().mockResolvedValue(undefined),
    }

    const { Pool } = require('pg') as { Pool: jest.Mock }
    Pool.mockImplementation(() => mockPool)
  })

  describe('Authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      supabaseMock.client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      })

      const request = new NextRequest('http://localhost:3000/api/migrations/test-id/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: true, confirm: false }),
      })

      const response = await POST(request, { params: { id: 'test-id' } })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('allows authenticated users', async () => {
      const mockUser = { id: 'user-id', email: 'test@example.com' }
      supabaseMock.client.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      // Mock migration fetch
      supabaseMock.setSingleResult({
        data: {
          id: 'test-id',
          content: 'SELECT 1;',
          applied: false,
          execution_status: 'pending',
          scan_reports: {
            projects: {
              id: 'project-id',
              user_id: 'user-id',
              db_connection_string: 'postgresql://test',
            },
          },
        },
        error: null,
      })

      supabaseMock.mocks.updateEq.mockResolvedValue({ error: null })
      supabaseMock.mocks.insertSingle.mockResolvedValue({
        data: { id: 'history-id' },
        error: null,
      })

      mockClient.query.mockResolvedValue({ rowCount: 0 })

      const request = new NextRequest('http://localhost:3000/api/migrations/test-id/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: true, confirm: false }),
      })

      const response = await POST(request, { params: { id: 'test-id' } })

      expect(response.status).not.toBe(401)
    })
  })

  describe('Authorization', () => {
    it('returns 403 when user does not own the project', async () => {
      const mockUser = { id: 'user-id', email: 'test@example.com' }
      supabaseMock.client.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      supabaseMock.setSingleResult({
        data: {
          id: 'test-id',
          scan_reports: {
            projects: {
              user_id: 'different-user-id', // Different user
            },
          },
        },
        error: null,
      })

      const request = new NextRequest('http://localhost:3000/api/migrations/test-id/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: true, confirm: false }),
      })

      const response = await POST(request, { params: { id: 'test-id' } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Access denied')
    })
  })

  describe('Validation', () => {
    it('requires confirmation for production runs', async () => {
      const mockUser = { id: 'user-id' }
      supabaseMock.client.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      supabaseMock.setSingleResult({
        data: {
          id: 'test-id',
          scan_reports: {
            projects: {
              user_id: 'user-id',
              db_connection_string: 'postgresql://test',
            },
          },
        },
        error: null,
      })

      const request = new NextRequest('http://localhost:3000/api/migrations/test-id/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: false, confirm: false }), // No confirmation
      })

      const response = await POST(request, { params: { id: 'test-id' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Confirmation required')
    })

    it('prevents executing already applied migrations', async () => {
      const mockUser = { id: 'user-id' }
      supabaseMock.client.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      supabaseMock.setSingleResult({
        data: {
          id: 'test-id',
          applied: true, // Already applied
          execution_status: 'success',
          scan_reports: {
            projects: {
              user_id: 'user-id',
              db_connection_string: 'postgresql://test',
            },
          },
        },
        error: null,
      })

      const request = new NextRequest('http://localhost:3000/api/migrations/test-id/execute', {
        method: 'POST',
        body: JSON.stringify({ dryRun: false, confirm: true }),
      })

      const response = await POST(request, { params: { id: 'test-id' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('already been applied')
    })

    it('requires database connection string', async () => {
      const mockUser = { id: 'user-id' }
      supabaseMock.client.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      supabaseMock.setSingleResult({
        data: {
          id: 'test-id',
          applied: false,
          execution_status: 'pending',
          scan_reports: {
            projects: {
              user_id: 'user-id',
              db_connection_string: null, // No connection string
            },
          },
        },
        error: null,
      })

      const request = new NextRequest('http://localhost:3000/api/migrations/test-id/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: true, confirm: false }),
      })

      const response = await POST(request, { params: { id: 'test-id' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Database connection string')
    })
  })

  describe('Dry Run Execution', () => {
    it('validates SQL without executing (dry run)', async () => {
      const mockUser = { id: 'user-id' }
      supabaseMock.client.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const mockMigration = {
        id: 'test-id',
        content: 'SELECT 1;',
        applied: false,
        execution_status: 'pending',
        scan_reports: {
          projects: {
            user_id: 'user-id',
            db_connection_string: 'postgresql://test',
          },
        },
      }

      supabaseMock.setSingleResult({
        data: mockMigration,
        error: null,
      })

      supabaseMock.mocks.updateEq.mockResolvedValue({ error: null })
      supabaseMock.mocks.insertSingle.mockResolvedValue({
        data: { id: 'history-id' },
        error: null,
      })

      // Mock EXPLAIN query for validation
      mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 })

      const request = new NextRequest('http://localhost:3000/api/migrations/test-id/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: true, confirm: false }),
      })

      const response = await POST(request, { params: { id: 'test-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.dryRun).toBe(true)
      expect(data.message).toContain('validation successful')
    })
  })

  describe('Actual Execution', () => {
    it('executes SQL migration successfully', async () => {
      const mockUser = { id: 'user-id' }
      supabaseMock.client.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const mockMigration = {
        id: 'test-id',
        content: 'BEGIN; SELECT 1; COMMIT;',
        applied: false,
        execution_status: 'pending',
        scan_reports: {
          projects: {
            user_id: 'user-id',
            db_connection_string: 'postgresql://test',
          },
        },
      }

      supabaseMock.setSingleResult({
        data: mockMigration,
        error: null,
      })

      supabaseMock.mocks.updateEq.mockResolvedValue({ error: null })
      supabaseMock.mocks.insertSingle.mockResolvedValue({
        data: { id: 'history-id' },
        error: null,
      })

      mockClient.query.mockResolvedValue({ rowCount: 5 })

      const request = new NextRequest('http://localhost:3000/api/migrations/test-id/execute', {
        method: 'POST',
        body: JSON.stringify({ dryRun: false, confirm: true }),
      })

      const response = await POST(request, { params: { id: 'test-id' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.dryRun).toBe(false)
      expect(data.message).toContain('applied successfully')
      expect(data.affectedRows).toBe(5)
    })

    it('handles SQL execution errors', async () => {
      const mockUser = { id: 'user-id' }
      supabaseMock.client.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const mockMigration = {
        id: 'test-id',
        content: 'INVALID SQL;',
        applied: false,
        execution_status: 'pending',
        scan_reports: {
          projects: {
            user_id: 'user-id',
            db_connection_string: 'postgresql://test',
          },
        },
      }

      supabaseMock.setSingleResult({
        data: mockMigration,
        error: null,
      })

      supabaseMock.mocks.updateEq.mockResolvedValue({ error: null })
      supabaseMock.mocks.insertSingle.mockResolvedValue({
        data: { id: 'history-id' },
        error: null,
      })

      // Mock SQL error
      mockClient.query.mockRejectedValue(new Error('SQL syntax error'))

      const request = new NextRequest('http://localhost:3000/api/migrations/test-id/execute', {
        method: 'POST',
        body: JSON.stringify({ dryRun: false, confirm: true }),
      })

      const response = await POST(request, { params: { id: 'test-id' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('SQL syntax error')
    })
  })

  describe('Status Tracking', () => {
    it('updates migration status to running', async () => {
      const mockUser = { id: 'user-id' }
      supabaseMock.client.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const mockMigration = {
        id: 'test-id',
        content: 'SELECT 1;',
        applied: false,
        execution_status: 'pending',
        scan_reports: {
          projects: {
            user_id: 'user-id',
            db_connection_string: 'postgresql://test',
          },
        },
      }

      supabaseMock.setSingleResult({
        data: mockMigration,
        error: null,
      })

      supabaseMock.mocks.updateEq.mockResolvedValue({ error: null })
      supabaseMock.mocks.insertSingle.mockResolvedValue({
        data: { id: 'history-id' },
        error: null,
      })

      mockClient.query.mockResolvedValue({ rowCount: 0 })

      const request = new NextRequest('http://localhost:3000/api/migrations/test-id/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: true, confirm: false }),
      })

      await POST(request, { params: { id: 'test-id' } })

      expect(supabaseMock.mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          execution_status: 'running',
          dry_run: true,
        })
      )
    })

    it('creates migration history entry', async () => {
      const mockUser = { id: 'user-id' }
      supabaseMock.client.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      const mockMigration = {
        id: 'test-id',
        content: 'SELECT 1;',
        applied: false,
        execution_status: 'pending',
        scan_reports: {
          projects: {
            user_id: 'user-id',
            db_connection_string: 'postgresql://test',
          },
        },
      }

      supabaseMock.setSingleResult({
        data: mockMigration,
        error: null,
      })

      supabaseMock.mocks.updateEq.mockResolvedValue({ error: null })
      supabaseMock.mocks.insertSingle.mockResolvedValue({
        data: { id: 'history-id' },
        error: null,
      })

      mockClient.query.mockResolvedValue({ rowCount: 0 })

      const request = new NextRequest('http://localhost:3000/api/migrations/test-id/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: true, confirm: false }),
      })

      await POST(request, { params: { id: 'test-id' } })

      expect(supabaseMock.mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          migration_id: 'test-id',
          executed_by: 'user-id',
          execution_type: 'dry-run',
          status: 'running',
          sql_executed: 'SELECT 1;',
        })
      )
    })
  })
})

