'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TeamRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl py-12">
      <div className="overflow-hidden rounded-lg border border-destructive/30 bg-card">
        <div className="border-b border-destructive/20 bg-destructive/10 p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <h1 className="font-mono text-sm font-semibold">Team workspace unavailable</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                The team data could not be rendered. Retry the request or return to your team list.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 p-5">
          <Button size="sm" onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
          <Link href="/dashboard/teams">
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> All teams
            </Button>
          </Link>
          {error.digest && (
            <code className="ml-auto font-mono text-[10px] text-muted-foreground">digest:{error.digest}</code>
          )}
        </div>
      </div>
    </div>
  );
}
