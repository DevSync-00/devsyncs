'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ShieldCheck, Terminal } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

const apiBaseUrl = process.env.NEXT_PUBLIC_ANALYZER_API_URL ?? 'http://localhost:4000';

const DeviceFormSchema = z.object({
  userCode: z
    .string()
    .min(1, 'Enter the code from your CLI or editor')
    .regex(/^[A-Za-z0-9]{4}[- ]?[A-Za-z0-9]{4}$/, 'Use the XXXX-YYYY format')
    .transform((value) => {
      const normalized = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
    }),
});

type DeviceFormValues = z.infer<typeof DeviceFormSchema>;

type DeviceLookupResponse = {
  client_id: 'cli' | 'vscode';
  client_name: string;
  user_code: string;
  approved: boolean;
  expires_in: number;
  created_at: number;
};

const ClientDescriptions: Record<DeviceLookupResponse['client_id'], { name: string; description: string }> = {
  cli: {
    name: 'DevSync CLI',
    description: 'Allows the DevSync CLI to sync & manage your projects.',
  },
  vscode: {
    name: 'DevSync VS Code Extension',
    description: 'Enables diagnostics and migrations directly from VS Code.',
  },
};

export function DevicePageInner() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [lookupResult, setLookupResult] = useState<DeviceLookupResponse | null>(null);
  const [isApproved, setIsApproved] = useState(false);

  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(DeviceFormSchema),
    defaultValues: {
      userCode: '',
    },
  });

  useEffect(() => {
    let mounted = true;

    const ensureSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }
      if (!data.session) {
        setCheckingSession(false);
        router.replace(`/auth/login?redirect=%2Fdevice`);
        return;
      }
      setSession(data.session);
      setCheckingSession(false);
    };

    ensureSession();

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) {
        return;
      }

      if (!newSession) {
        router.replace(`/auth/login?redirect=%2Fdevice`);
        return;
      }
      setSession(newSession);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router, supabase]);

  const callDeviceApi = async <T,>(path: string, body: Record<string, string>) => {
    if (!session?.access_token) {
      throw new Error('You must be signed in to approve a device.');
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string; error_description?: string } | null;
      const message = payload?.error_description ?? payload?.error ?? 'Request failed';
      throw new Error(message);
    }

    return (await response.json()) as T;
  };

  const lookupMutation = useMutation({
    mutationFn: async (values: DeviceFormValues) => {
      const result = await callDeviceApi<DeviceLookupResponse>('/api/auth/device/lookup', {
        user_code: values.userCode,
      });
      return result;
    },
    onSuccess: (result) => {
      setLookupResult(result);
      setIsApproved(false);
      toast({
        title: 'Device located',
        description: `${result.client_name} is waiting for approval.`,
      });
    },
    onError: (error: unknown) => {
      setLookupResult(null);
      const message = error instanceof Error ? error.message : 'Unable to look up device';
      toast({
        title: 'Lookup failed',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!lookupResult) {
        throw new Error('No device code loaded.');
      }
      return callDeviceApi<{ status: string }>('/api/auth/device/approve', {
        user_code: lookupResult.user_code,
      });
    },
    onSuccess: () => {
      setIsApproved(true);
      toast({
        title: 'Approved!',
        description: 'Your CLI/extension can now use the DevSync APIs.',
      });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to approve device';
      toast({
        title: 'Approval failed',
        description: message,
        variant: 'destructive',
      });
    },
  });

  const handleLookup = (values: DeviceFormValues) => {
    lookupMutation.mutate(values);
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 rounded-2xl border bg-card p-8 shadow-xl">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">Authorize a device</h1>
            <p className="text-muted-foreground">
              Paste the code shown in your CLI or VS Code extension to securely link it to your Supabase account.
            </p>
          </div>
        </div>

        <div className="space-y-6 rounded-xl border border-border bg-muted/10 p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLookup)} className="space-y-6">
              <FormField
                control={form.control}
                name="userCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        inputMode="text"
                        autoComplete="one-time-code"
                        placeholder="ABCD-EFGH"
                        className="text-lg uppercase tracking-[0.3em]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" size="lg" className="w-full" disabled={lookupMutation.isPending}>
                {lookupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lookup device
              </Button>
            </form>
          </Form>

          <div className="rounded-lg border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Terminal className="h-4 w-4" />
              Shown when you run <code className="rounded bg-muted px-1 py-0.5">devsync login</code> or activate the VS Code extension.
            </div>
            <p className="mt-2">Keep this window open while approving—device codes expire in about 10 minutes for your security.</p>
          </div>

          {lookupResult && (
            <div className="rounded-lg border bg-background/80 p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-wide text-muted-foreground">Requested client</p>
                  <h2 className="text-xl font-semibold">{ClientDescriptions[lookupResult.client_id].name}</h2>
                  <p className="text-sm text-muted-foreground">{ClientDescriptions[lookupResult.client_id].description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Device code</p>
                  <p className="text-2xl font-mono font-bold tracking-wider">{lookupResult.user_code}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Expires in <span className="font-semibold text-foreground">{lookupResult.expires_in}s</span>
                </p>
                <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending || isApproved} size="lg">
                  {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isApproved ? 'Approved' : 'Approve access'}
                </Button>
              </div>

              {isApproved && (
                <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600">
                  ✅ All set! Your device received an access token and can continue automatically.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DevicePageClient() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <DevicePageInner />
    </QueryClientProvider>
  );
}

