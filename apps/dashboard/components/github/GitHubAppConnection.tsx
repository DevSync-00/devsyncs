'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Github, Loader2, CheckCircle2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Installation {
  installation_id: number;
  account_login: string;
  repository_selection: string;
}

export default function GitHubAppConnection() {
  const searchParams = useSearchParams();
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const connectionStatus = searchParams.get('github');
  const connectionMessage = searchParams.get('github_message');

  useEffect(() => {
    fetch('/api/github/installations')
      .then((response) => response.ok ? response.json() : { installations: [] })
      .then((result) => setInstallations(result.installations || []))
      .catch(() => setInstallations([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-md border bg-muted/20 p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <Github className="h-4 w-4" />
            DevSync GitHub App
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Install DevSync on selected repositories to scan private code securely.
          </p>
        </div>
        <a
          href="/api/github/install?returnTo=/dashboard/projects/new"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          {installations.length > 0 ? 'Manage access' : 'Connect GitHub'}
        </a>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking GitHub connection…
        </div>
      ) : installations.length > 0 ? (
        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Connected to {installations.map((item) => item.account_login).join(', ')}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Public repositories work without connecting. Private repositories require installation access.
        </p>
      )}

      {connectionStatus === 'connected' && (
        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400" role="status">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          GitHub access connected. You can now scan the selected repositories.
        </div>
      )}

      {connectionStatus === 'error' && (
        <div className="flex items-start gap-2 text-xs text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{connectionMessage || 'GitHub access could not be connected. Please try again.'}</span>
        </div>
      )}
    </div>
  );
}
