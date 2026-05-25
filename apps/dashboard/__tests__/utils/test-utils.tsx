import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'

// Mock Supabase client for testing
export const mockSupabaseClient = {
  from: jest.fn(),
  auth: {
    getUser: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
  },
}

// Mock createClient
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}))

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Helper functions for common test scenarios
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  ...overrides,
})

export const createMockProject = (overrides = {}) => ({
  id: 'test-project-id',
  name: 'Test Project',
  slug: 'test-project',
  user_id: 'test-user-id',
  schema_type: 'prisma',
  created_at: new Date().toISOString(),
  ...overrides,
})

export const createMockScanReport = (overrides = {}) => ({
  id: 'test-scan-report-id',
  project_id: 'test-project-id',
  status: 'completed',
  mismatches: [],
  code_schema: {},
  db_schema: {},
  created_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
  ...overrides,
})

export const createMockMigration = (overrides = {}) => ({
  id: 'test-migration-id',
  scan_report_id: 'test-scan-report-id',
  filename: 'test_migration.sql',
  content: 'SELECT 1;',
  format: 'sql',
  applied: false,
  execution_status: 'pending',
  created_at: new Date().toISOString(),
  ...overrides,
})

export const mockFetchResponse = (
  data: unknown,
  options: { ok?: boolean; status?: number } = {}
) => {
  const status = options.status ?? (options.ok === false ? 400 : 200)
  const ok = options.ok ?? (status >= 200 && status < 300)
  const body = JSON.stringify(data)

  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type' ? 'application/json' : null,
    },
    json: async () => JSON.parse(body),
    text: async () => body,
  }
}
