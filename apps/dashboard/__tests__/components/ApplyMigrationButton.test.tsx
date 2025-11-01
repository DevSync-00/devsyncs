import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { jest } from '@jest/globals'
import ApplyMigrationButton from '@/components/ApplyMigrationButton'
import {
  createMockMigration,
  mockFetchResponse,
} from '../utils/test-utils'

// Mock fetch globally
global.fetch = jest.fn()

describe('ApplyMigrationButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  it('renders "Applied" badge when migration is already applied', () => {
    render(
      <ApplyMigrationButton
        migrationId="test-id"
        applied={true}
      />
    )

    expect(screen.getByText('Applied')).toBeInTheDocument()
  })

  it('renders "Running..." when execution status is running', () => {
    render(
      <ApplyMigrationButton
        migrationId="test-id"
        applied={false}
        executionStatus="running"
      />
    )

    expect(screen.getByText('Running...')).toBeInTheDocument()
  })

  it('renders "Failed" when execution status is failed', () => {
    render(
      <ApplyMigrationButton
        migrationId="test-id"
        applied={false}
        executionStatus="failed"
      />
    )

    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('renders Validate and Apply buttons when migration is pending', () => {
    render(
      <ApplyMigrationButton
        migrationId="test-id"
        applied={false}
      />
    )

    expect(screen.getByText(/Validate \(Dry Run\)/)).toBeInTheDocument()
    expect(screen.getByText(/Apply Migration/)).toBeInTheDocument()
  })

  it('calls API with dryRun=true when Validate button is clicked', async () => {
    const mockResponse = {
      success: true,
      dryRun: true,
      message: 'Migration validation successful',
      executionTime: 100,
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(mockResponse)
    )

    render(
      <ApplyMigrationButton
        migrationId="test-id"
        applied={false}
      />
    )

    const validateButton = screen.getByText(/Validate \(Dry Run\)/)
    fireEvent.click(validateButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/migrations/test-id/execute',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dryRun: true,
            confirm: false,
          }),
        })
      )
    })
  })

  it('shows confirmation dialog when Apply button is clicked', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <ApplyMigrationButton
        migrationId="test-id"
        applied={false}
      />
    )

    const applyButton = screen.getByText(/Apply Migration/)
    fireEvent.click(applyButton)

    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to apply this migration? This action cannot be undone.'
    )

    confirmSpy.mockRestore()
  })

  it('calls API with confirm=true when Apply is confirmed', async () => {
    const mockResponse = {
      success: true,
      dryRun: false,
      message: 'Migration applied successfully',
      executionTime: 200,
      affectedRows: 5,
    }

    jest.spyOn(window, 'confirm').mockReturnValue(true)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(mockResponse)
    )

    render(
      <ApplyMigrationButton
        migrationId="test-id"
        applied={false}
      />
    )

    const applyButton = screen.getByText(/Apply Migration/)
    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/migrations/test-id/execute',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            dryRun: false,
            confirm: true,
          }),
        })
      )
    })
  })

  it('displays success message after successful validation', async () => {
    const mockResponse = {
      success: true,
      dryRun: true,
      message: 'Migration validation successful',
      executionTime: 100,
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(mockResponse)
    )

    render(
      <ApplyMigrationButton
        migrationId="test-id"
        applied={false}
      />
    )

    const validateButton = screen.getByText(/Validate \(Dry Run\)/)
    fireEvent.click(validateButton)

    await waitFor(() => {
      expect(screen.getByText(/Dry Run:/)).toBeInTheDocument()
      expect(screen.getByText(/Migration validation successful/)).toBeInTheDocument()
    })
  })

  it('displays error message when validation fails', async () => {
    const mockResponse = {
      success: false,
      error: 'SQL validation failed: syntax error',
      message: 'Validation failed: SQL validation failed: syntax error',
      executionTime: 50,
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(mockResponse, { ok: false, status: 500 })
    )

    const onError = jest.fn()
    render(
      <ApplyMigrationButton
        migrationId="test-id"
        applied={false}
        onError={onError}
      />
    )

    const validateButton = screen.getByText(/Validate \(Dry Run\)/)
    fireEvent.click(validateButton)

    await waitFor(() => {
      expect(screen.getByText(/SQL validation failed/)).toBeInTheDocument()
      expect(onError).toHaveBeenCalled()
    })
  })

  it('calls onSuccess callback when migration is successfully applied', async () => {
    const mockResponse = {
      success: true,
      dryRun: false,
      message: 'Migration applied successfully',
      executionTime: 200,
      affectedRows: 5,
    }

    jest.spyOn(window, 'confirm').mockReturnValue(true)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      mockFetchResponse(mockResponse)
    )

    const onSuccess = jest.fn()
    render(
      <ApplyMigrationButton
        migrationId="test-id"
        applied={false}
        onSuccess={onSuccess}
      />
    )

    const applyButton = screen.getByText(/Apply Migration/)
    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('disables buttons while loading', async () => {
    const mockResponse = {
      success: true,
      dryRun: true,
      message: 'Validation successful',
    }

    ;(global.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mockFetchResponse(mockResponse)), 100)
        )
    )

    render(
      <ApplyMigrationButton
        migrationId="test-id"
        applied={false}
      />
    )

    const validateButton = screen.getByText(/Validate \(Dry Run\)/)
    fireEvent.click(validateButton)

    // Buttons should be disabled while loading
    expect(screen.getByText(/Validating.../)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.queryByText(/Validating.../)).not.toBeInTheDocument()
    })
  })

  it('handles network errors gracefully', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    )

    const onError = jest.fn()
    render(
      <ApplyMigrationButton
        migrationId="test-id"
        applied={false}
        onError={onError}
      />
    )

    const validateButton = screen.getByText(/Validate \(Dry Run\)/)
    fireEvent.click(validateButton)

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Network error')
    })
  })
})

