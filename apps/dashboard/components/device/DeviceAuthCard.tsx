'use client';

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Check, Copy, Loader2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';

const RAW_ANALYZER_URL = process.env.NEXT_PUBLIC_ANALYZER_URL;
const ANALYZER_BASE_URL = RAW_ANALYZER_URL && RAW_ANALYZER_URL.length > 0
  ? RAW_ANALYZER_URL
  : 'http://localhost:4000';
const USING_DEFAULT_ANALYZER = !RAW_ANALYZER_URL || RAW_ANALYZER_URL.length === 0;

type DeviceLookupResponse = {
  client_name: string;
  client_id: string;
  user_code: string;
  approved: boolean;
  expires_in: number;
  created_at: number;
};

type DeviceApproveResponse = {
  status: string;
  client_id: string;
  approved_at: number;
};

type StatusState = 'idle' | 'checking' | 'ready' | 'approving' | 'approved' | 'error';

interface DeviceAuthCardProps {
  initialCode?: string;
}

export function DeviceAuthCard({ initialCode }: DeviceAuthCardProps) {
  const supabase = useMemo(() => createClient(), []);
  const [rawCode, setRawCode] = useState<string>(() => sanitizeRawCode(initialCode));
  const [status, setStatus] = useState<StatusState>('idle');
  const [details, setDetails] = useState<DeviceLookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const displayCode = formatForDisplay(rawCode);
  const canApprove = !!details && !details.approved && status === 'ready';
  const hasFullCode = rawCode.length === 8;

  const ensureSessionToken = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(sessionError.message);
    }
    const token = data.session?.access_token;
    if (!token) {
      throw new Error('No active session. Please sign in again.');
    }
    return token;
  }, [supabase]);

  const callAnalyzer = useCallback(
    async <T,>(path: string, payload: Record<string, unknown>): Promise<T> => {
      const token = await ensureSessionToken();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(`${ANALYZER_BASE_URL}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            body?.error_description ??
            body?.error ??
            `Request failed with status ${response.status}`;
          throw new Error(message);
        }
        return body as T;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error('Request timed out. The analyzer service may be offline.');
        }
        throw err instanceof Error ? err : new Error('Request failed');
      } finally {
        clearTimeout(timeout);
      }
    },
    [ensureSessionToken]
  );

  const handleLookup = useCallback(async () => {
    setError(null);
    const user_code = toUserCode(rawCode);
    setStatus('checking');
    try {
      const response = await callAnalyzer<DeviceLookupResponse>('/api/auth/device/lookup', {
        user_code,
      });
      setDetails(response);
      setStatus(response.approved ? 'approved' : 'ready');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to check code.');
    }
  }, [callAnalyzer, rawCode]);

  const handleApprove = useCallback(async () => {
    if (!details) return;
    setError(null);
    const user_code = toUserCode(rawCode);
    setStatus('approving');
    try {
      await callAnalyzer<DeviceApproveResponse>('/api/auth/device/approve', { user_code });
      setDetails((current) =>
        current
          ? {
              ...current,
              approved: true,
            }
          : current
      );
      setStatus('approved');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Approval failed.');
    }
  }, [callAnalyzer, details, rawCode]);

  const handleCopy = useCallback(() => {
    if (!hasFullCode) return;
    navigator.clipboard.writeText(formatForDisplay(rawCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [hasFullCode, rawCode]);

  return (
    <div className="w-full max-w-xl rounded-2xl border border-border bg-card/80 shadow-2xl backdrop-blur p-8 relative">
      <div className="space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            {status === 'approved' ? (
              <ShieldCheck className="w-8 h-8 text-green-500" />
            ) : (
              <ShieldAlert className="w-8 h-8 text-primary" />
            )}
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground">
                Device Authorization
              </p>
              <h1 className="text-2xl font-semibold text-foreground">Approve CLI Login</h1>
            </div>
          </div>
          <p className="text-muted-foreground">
            Enter the code displayed in your CLI or VS Code extension to authorize this device.
            The terminal will update automatically once you approve.
          </p>
          {USING_DEFAULT_ANALYZER && (
            <p className="text-sm text-yellow-600 border border-yellow-500/40 bg-yellow-500/10 rounded-lg px-4 py-2">
              Using default analyzer URL ({ANALYZER_BASE_URL}). Set <code>NEXT_PUBLIC_ANALYZER_URL</code> in
              <code>.env.local</code> for production deployments.
            </p>
          )}
        </header>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center justify-between">
            Device code
            <span className="text-xs text-muted-foreground">{hasFullCode ? 'Code detected' : '8 characters'}</span>
          </label>
          <div className="flex gap-3">
            <Input
              value={displayCode}
              onChange={(event) => setRawCode(sanitizeRawCode(event.target.value))}
              placeholder="XXXX-XXXX"
              className="text-center tracking-[0.5rem] text-lg font-mono uppercase"
              maxLength={9}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              disabled={!hasFullCode}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={handleLookup}
            disabled={!hasFullCode || status === 'checking'}
          >
            {status === 'checking' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Checking…
              </>
            ) : (
              'Check code'
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleApprove}
            disabled={!canApprove}
          >
            {status === 'approving' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Approving…
              </>
            ) : (
              'Approve device'
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleLookup}
            disabled={status === 'checking'}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <section className="rounded-xl border border-border bg-muted/30 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              Status
              <StatusBadge status={status} approved={details?.approved ?? false} />
            </p>
            {details?.expires_in !== undefined && (
              <span className="text-xs text-muted-foreground">
                Expires in {formatDuration(details.expires_in)}
              </span>
            )}
          </div>

          {details && (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Client</dt>
                <dd className="font-medium text-foreground">{details.client_name || details.client_id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Approval</dt>
                <dd className="font-medium text-foreground">
                  {details.approved ? 'Approved' : 'Waiting for approval'}
                </dd>
              </div>
            </dl>
          )}

          {!details && (
            <p className="text-sm text-muted-foreground">
              Provide the code above and select <strong>Check code</strong> to view the pending device.
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive border border-destructive/40 bg-destructive/10 rounded-lg px-4 py-2">
              {error}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border/60 bg-background/60 p-5 space-y-2 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Tips</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Keep this tab open until the CLI reports success.</li>
            <li>If the code expires, return to the terminal and run <code>devsync login</code> again.</li>
            <li>Approvals happen instantly. If nothing changes, click “Refresh”.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function sanitizeRawCode(value?: string) {
  if (!value) {
    return '';
  }
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
}

function formatForDisplay(raw: string) {
  if (!raw) {
    return '';
  }
  if (raw.length <= 4) {
    return raw;
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function toUserCode(raw: string) {
  if (raw.length !== 8) {
    throw new Error('Enter the full 8-character code shown in your terminal.');
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function StatusBadge({ status, approved }: { status: StatusState; approved: boolean }) {
  const label = (() => {
    if (approved || status === 'approved') return 'Approved';
    if (status === 'ready') return 'Awaiting approval';
    if (status === 'checking') return 'Checking';
    if (status === 'approving') return 'Approving';
    if (status === 'error') return 'Error';
    return 'Idle';
  })();
  return (
    <span
      className={cn(
        'px-2 py-0.5 text-xs rounded-full border',
        approved || status === 'approved'
          ? 'bg-green-500/10 text-green-700 border-green-500/40'
          : status === 'error'
            ? 'bg-red-500/10 text-red-600 border-red-500/40'
            : 'bg-primary/10 text-primary border-primary/30'
      )}
    >
      {label}
    </span>
  );
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return '—';
  }
  const clamped = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(clamped / 60);
  const secs = clamped % 60;
  if (minutes <= 0) {
    return `${secs}s`;
  }
  return `${minutes}m ${secs.toString().padStart(2, '0')}s`;
}

