'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Building2, CheckCircle2, ExternalLink, Github, Loader2, RefreshCw, Unplug, User, X } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Installation {
  installation_id: number;
  account_login: string;
  account_type: string;
  repository_selection: string;
  github_login: string | null;
}

export default function GitHubConnectionsManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDisconnect, setPendingDisconnect] = useState<Installation | null>(null);
  const connectionStatus = searchParams.get('github');
  const connectionMessage = searchParams.get('github_message');

  const loadConnections = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/github/installations')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load GitHub connections.');
        return result;
      })
      .then((result) => setInstallations(result.installations || []))
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (!connectionStatus) return;
    const timeout = window.setTimeout(() => router.replace('/dashboard/settings'), 5000);
    return () => window.clearTimeout(timeout);
  }, [connectionStatus, router]);

  const disconnect = async (installation: Installation) => {
    setDisconnecting(installation.installation_id);
    setError(null);
    try {
      const response = await fetch('/api/github/installations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installationId: installation.installation_id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to disconnect GitHub.');
      setInstallations((current) => current.filter(
        (item) => item.installation_id !== installation.installation_id
      ));
      setPendingDisconnect(null);
    } catch (caught: any) {
      setError(caught.message);
    } finally {
      setDisconnecting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Github className="h-5 w-5" /> GitHub connections
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Repositories from these installations are available when creating a project.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={loadConnections} disabled={loading} title="Refresh GitHub connections">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            <span className="sr-only">Refresh GitHub connections</span>
          </Button>
          <a href="/api/github/install?returnTo=/dashboard/settings" className={cn(buttonVariants({ size: 'sm' }))}>
            <Github className="mr-2 h-4 w-4" /> Connect GitHub
          </a>
        </div>
      </div>

      {connectionStatus === 'connected' && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> GitHub was connected successfully.
        </div>
      )}

      {connectionStatus === 'error' && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {connectionMessage || 'GitHub could not be connected.'}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading connections...
        </div>
      ) : installations.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center">
          <Github className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No GitHub account connected</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect GitHub to use private repositories in DevSync projects.
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-md border">
          {installations.map((installation) => {
            const AccountIcon = installation.account_type === 'Organization' ? Building2 : User;
            return (
              <div key={installation.installation_id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    <AccountIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{installation.account_login}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Authorized by @{installation.github_login || 'GitHub user'} - {installation.repository_selection} repositories
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`https://github.com/settings/installations/${installation.installation_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
                    title={`Manage ${installation.account_login} access on GitHub`}
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="sr-only">Manage access on GitHub</span>
                  </a>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPendingDisconnect(installation)}>
                    <Unplug className="mr-2 h-4 w-4" /> Disconnect
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Disconnecting removes the installation from this DevSync account. To change repository access or uninstall the app, use{' '}
        <a href="https://github.com/settings/installations" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
          GitHub App settings
        </a>.
      </p>

      {pendingDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={() => setPendingDisconnect(null)}>
          <div className="w-full max-w-md rounded-md border bg-background p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="disconnect-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="disconnect-title" className="text-lg font-semibold">Disconnect {pendingDisconnect.account_login}?</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Its private repositories will no longer be available to your DevSync account. Existing projects are not deleted.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setPendingDisconnect(null)} title="Close">
                <X className="h-4 w-4" /><span className="sr-only">Close</span>
              </Button>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setPendingDisconnect(null)}>Cancel</Button>
              <Button type="button" variant="destructive" disabled={disconnecting !== null} onClick={() => disconnect(pendingDisconnect)}>
                {disconnecting !== null && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
