import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Device from "../Device";

const unsubscribe = vi.fn();
const mockAuth = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe } },
  })),
  signInWithPassword: vi.fn(),
};

vi.mock("@/lib/supabase", () => ({
  createSupabaseClient: () => ({
    auth: mockAuth,
  }),
}));

const renderWithProviders = () => {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <Device />
    </QueryClientProvider>,
  );
};

describe("Device marketing page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockAuth.getSession.mockReset();
    mockAuth.signInWithPassword.mockReset();
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the sign-in panel when no Supabase session exists", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/Sign in to continue/i)).toBeInTheDocument();
    });
  });

  it("submits a lookup request when a valid session is present", async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: { access_token: "supabase-access-token" } },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        client_id: "cli",
        client_name: "DevSync CLI",
        user_code: "ABCD-EFGH",
        approved: false,
        expires_in: 600,
        created_at: Date.now(),
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithProviders();

    await screen.findByText(/Authorize a device/i);

    const input = screen.getByPlaceholderText(/ABCD-EFGH/i);
    fireEvent.change(input, { target: { value: "abcd efgh" } });
    fireEvent.click(screen.getByRole("button", { name: /Lookup device/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/auth/device/lookup");
    expect(options?.headers?.Authorization).toBe("Bearer supabase-access-token");
    expect(JSON.parse(options?.body as string).user_code).toBe("ABCD-EFGH");
  });
});

