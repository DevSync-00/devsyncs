import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DevicePageInner } from '@/app/device/device-page-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

if (!(global as any).fetch) {
  (global as any).fetch = jest.fn();
}

const mockRouter = { replace: jest.fn() };
const mockAuth = {
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(),
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: mockAuth,
  }),
}));

describe('DevicePageInner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  test('renders approval panel when session is available', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });

    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <DevicePageInner />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Authorize a device/i)).toBeInTheDocument();
    });
  });

  test('submits lookup form and calls backend', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
    const fetchMock = jest
      .spyOn(global as any, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          client_id: 'cli',
          client_name: 'DevSync CLI',
          user_code: 'AAAA-BBBB',
          approved: false,
          expires_in: 600,
          created_at: Date.now(),
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'approved' }),
      } as any);

    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <DevicePageInner />
      </QueryClientProvider>
    );

    await screen.findByText(/Authorize a device/i);

    const input = screen.getByPlaceholderText(/ABCD-EFGH/i);
    fireEvent.change(input, { target: { value: 'ABCD-EFGH' } });
    fireEvent.click(screen.getByRole('button', { name: /Lookup device/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/lookup'), expect.any(Object)));

    fetchMock.mockRestore();
  });
});

