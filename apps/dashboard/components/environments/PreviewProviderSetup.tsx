'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Database, Eye, EyeOff, Loader2, RefreshCw, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function PreviewProviderSetup({
  environment,
  onClose,
  onConfigured,
}: {
  environment: { id: string; name: string; tier?: string };
  onClose: () => void;
  onConfigured: () => void;
}) {
  const [connectionString, setConnectionString] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<'postgres-transaction' | 'neon-branch'>('postgres-transaction');
  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [parentBranchId, setParentBranchId] = useState('');
  const [current, setCurrent] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/environments/${environment.id}/provider`)
      .then((response) => response.json())
      .then((body) => {
        setCurrent(body.provider || null);
        if (body.provider?.provider === 'neon-branch') setProvider('neon-branch');
      })
      .catch(() => undefined);
  }, [environment.id]);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/environments/${environment.id}/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provider === 'neon-branch'
          ? { provider, apiKey, projectId, parentBranchId: parentBranchId || undefined, expiresInHours: 24 }
          : { provider, connectionString }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.details || body.error || 'Connection verification failed');
      toast({ title: 'Database connection verified', description: 'Credentials were encrypted and the database connection succeeded.' });
      onConfigured();
    } catch (error) {
      toast({ title: 'Provider setup failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const lifecycle = async (action: 'refresh' | 'reset' | 'destroy') => {
    if (action === 'destroy' && !window.confirm('Destroy this managed preview branch? Existing connections will stop working.')) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/environments/${environment.id}/provider/lifecycle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.details || body.error);
      setCurrent(body.provider);
      toast({ title: `Managed preview ${action} complete`, description: body.provider.lifecycle_status });
    } catch (error) {
      toast({ title: 'Managed provider action failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b p-5">
          <div className="flex gap-3">
            <div className="rounded-xl bg-cyan-500/10 p-2.5"><Database className="h-5 w-5 text-cyan-500" /></div>
            <div>
              <h3 className="font-semibold">Configure {environment.name} database</h3>
              <p className="mt-1 text-xs text-muted-foreground">{environment.tier === 'preview' ? 'Used for isolated, transaction-wrapped rehearsals.' : 'Used only by explicitly approved, transaction-wrapped promotions.'}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-5 p-5">
          {current && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <div>
                <div className="text-xs font-medium text-emerald-500">{current.provider} · {current.lifecycle_status || 'ready'}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{current.connection_preview}</div>
                {current.expires_at && <div className="mt-1 text-[9px] text-muted-foreground">Expires {new Date(current.expires_at).toLocaleString()}</div>}
              </div>
            </div>
          )}
          {current?.provider === 'neon-branch' && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => lifecycle('refresh')} disabled={saving}><RefreshCw className="mr-2 h-3.5 w-3.5" />Refresh health</Button>
              <Button size="sm" variant="outline" onClick={() => lifecycle('reset')} disabled={saving}><RotateCcw className="mr-2 h-3.5 w-3.5" />Reset branch</Button>
              <Button size="sm" variant="destructive" onClick={() => lifecycle('destroy')} disabled={saving}><Trash2 className="mr-2 h-3.5 w-3.5" />Destroy</Button>
            </div>
          )}
          <div>
            <label className="text-xs font-medium">Provider</label>
            <select value={provider} onChange={(event) => setProvider(event.target.value as any)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-xs">
              <option value="postgres-transaction">Existing PostgreSQL connection</option>
              {environment.tier === 'preview' && <option value="neon-branch">Managed Neon branch</option>}
            </select>
          </div>
          {provider === 'postgres-transaction' ? <div>
            <label className="text-xs font-medium">PostgreSQL connection</label>
            <div className="relative mt-2">
              <Input
                type={show ? 'text' : 'password'}
                value={connectionString}
                onChange={(event) => setConnectionString(event.target.value)}
                placeholder="postgres://user:password@preview-host/database"
                className="pr-10 font-mono text-xs"
              />
              <button type="button" onClick={() => setShow((value) => !value)} className="absolute right-3 top-2.5 text-muted-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div> : <div className="grid gap-3">
            <div><label className="text-xs font-medium">Neon API key</label><Input className="mt-2 font-mono text-xs" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="napi_..." /></div>
            <div><label className="text-xs font-medium">Neon project ID</label><Input className="mt-2 font-mono text-xs" value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="project-id" /></div>
            <div><label className="text-xs font-medium">Parent branch ID (optional)</label><Input className="mt-2 font-mono text-xs" value={parentBranchId} onChange={(event) => setParentBranchId(event.target.value)} placeholder="br-main..." /></div>
            <p className="text-[10px] text-muted-foreground">DevSync creates a dedicated copy-on-write branch and read-write endpoint, then encrypts both management and database credentials.</p>
          </div>}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-500" />Safety boundary</div>
            <ul className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-muted-foreground">
              <li>• Protected targets can only be configured by an owner or administrator.</li>
              <li>• Credentials are AES-256-GCM encrypted before storage.</li>
              <li>• Migration execution is wrapped in a transaction with lock and statement timeouts.</li>
              <li>• The schema fingerprint must match after rollback.</li>
            </ul>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t bg-muted/20 p-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || (provider === 'postgres-transaction' ? !connectionString.trim() : !apiKey.trim() || !projectId.trim())}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify and encrypt
          </Button>
        </div>
      </div>
    </div>
  );
}
