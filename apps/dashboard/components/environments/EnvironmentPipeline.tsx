'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDashed,
  CloudCog,
  GitCompareArrows,
  Loader2,
  Lock,
  Plus,
  Rocket,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import ReleasePromotionPanel from './ReleasePromotionPanel';
import PreviewProviderSetup from './PreviewProviderSetup';

type Environment = {
  id: string;
  name: string;
  slug: string;
  tier: 'local' | 'preview' | 'development' | 'staging' | 'production';
  position: number;
  status: 'unknown' | 'healthy' | 'drifted' | 'deploying' | 'failed';
  protected: boolean;
  requires_approval: boolean;
  schema_fingerprint?: string | null;
  current_scan_report?: {
    id: string;
    status: string;
    created_at: string;
    mismatches: unknown[];
    metadata?: Record<string, unknown>;
  } | null;
};

const previewTopology: Environment[] = [
  { id: 'preview-development', name: 'Development', slug: 'development', tier: 'development', position: 10, status: 'unknown', protected: false, requires_approval: false },
  { id: 'preview-preview', name: 'Preview', slug: 'preview', tier: 'preview', position: 15, status: 'unknown', protected: false, requires_approval: false },
  { id: 'preview-staging', name: 'Staging', slug: 'staging', tier: 'staging', position: 20, status: 'unknown', protected: true, requires_approval: true },
  { id: 'preview-production', name: 'Production', slug: 'production', tier: 'production', position: 30, status: 'unknown', protected: true, requires_approval: true },
];

export default function EnvironmentPipeline({ projectId }: { projectId: string }) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [providerEnvironment, setProviderEnvironment] = useState<Environment | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/environments`);
      const body = await response.json();
      setMigrationRequired(Boolean(body.migrationRequired));
      setEnvironments(body.environments || []);
    } catch {
      setEnvironments([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const initialize = async () => {
    setInitializing(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/environments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initializeDefaults: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Failed to create environment topology');
      await load();
      toast({ title: 'Environment pipeline created', description: 'Development, staging, and production are ready to configure.' });
    } catch (error) {
      toast({
        title: 'Could not create environments',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setInitializing(false);
    }
  };

  const displayed = environments.length ? environments : previewTopology;
  const configured = environments.length > 0;
  const healthy = environments.filter((environment) => environment.status === 'healthy').length;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="flex flex-col gap-4 border-b bg-gradient-to-br from-cyan-500/10 via-card to-blue-500/10 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-500">
            <Rocket className="h-4 w-4" />
            Release control
          </div>
          <h2 className="text-xl font-bold">Environment pipeline</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            See schema versions, drift, protection, and promotion readiness from development to production.
          </p>
        </div>
        {configured ? (
          <div className="flex items-center gap-3 rounded-xl border bg-background/70 px-4 py-2">
            <ShieldCheck className={`h-5 w-5 ${healthy === environments.length ? 'text-emerald-500' : 'text-amber-500'}`} />
            <div>
              <div className="text-sm font-semibold">{healthy}/{environments.length} healthy</div>
              <div className="text-[10px] text-muted-foreground">across all environments</div>
            </div>
          </div>
        ) : (
          <Button onClick={initialize} disabled={initializing || migrationRequired}>
            {initializing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create pipeline
          </Button>
        )}
      </div>

      {migrationRequired && (
        <div className="flex items-start gap-3 border-b border-amber-500/20 bg-amber-500/10 px-5 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <div className="font-medium text-amber-500">Platform migration required</div>
            <div className="text-xs text-muted-foreground">Apply migration 011_change_intelligence_platform.sql to enable persistent environments.</div>
          </div>
        </div>
      )}

      <div className={`relative p-6 ${!configured ? 'opacity-70' : ''}`}>
        {!configured && !loading && (
          <div className="mb-4 rounded-lg border border-dashed bg-muted/20 px-4 py-2 text-center text-xs text-muted-foreground">
            Preview topology — create the pipeline to begin tracking real environment state.
          </div>
        )}
        {loading ? (
          <div className="flex h-44 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex min-w-0 flex-col items-stretch gap-3 lg:flex-row lg:items-center">
            {displayed.map((environment, index) => (
              <div key={environment.id} className="contents">
                <EnvironmentNode environment={environment} onConfigureProvider={() => setProviderEnvironment(environment)} />
                {index < displayed.length - 1 && (
                  <div className="flex shrink-0 items-center justify-center lg:w-20">
                    <div className="relative h-10 w-px bg-border lg:h-px lg:w-full">
                      <ArrowRight className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-90 bg-card text-muted-foreground lg:rotate-0" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {configured && (
        <>
          <div className="grid border-t md:grid-cols-3">
            <PipelineInsight icon={GitCompareArrows} label="Schema comparison" value="Automatic between adjacent environments" />
            <PipelineInsight icon={Lock} label="Production protection" value={`${environments.filter((item) => item.protected).length} protected targets`} />
            <PipelineInsight icon={CloudCog} label="Promotion gates" value={`${environments.filter((item) => item.requires_approval).length} require approval`} />
          </div>
          <ReleasePromotionPanel projectId={projectId} />
        </>
      )}
      {providerEnvironment && (
        <PreviewProviderSetup
          environment={providerEnvironment}
          onClose={() => setProviderEnvironment(null)}
          onConfigured={() => {
            setProviderEnvironment(null);
            load();
          }}
        />
      )}
    </section>
  );
}

function EnvironmentNode({ environment, onConfigureProvider }: { environment: Environment; onConfigureProvider: () => void }) {
  const mismatches = Array.isArray(environment.current_scan_report?.mismatches)
    ? environment.current_scan_report!.mismatches.length
    : 0;
  const effectiveStatus = mismatches > 0 ? 'drifted' : environment.status;
  const appearance = {
    healthy: { icon: Check, text: 'Healthy', className: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' },
    drifted: { icon: AlertTriangle, text: `${mismatches || ''} Drift${mismatches === 1 ? '' : 's'}`.trim(), className: 'text-amber-500 border-amber-500/30 bg-amber-500/10' },
    deploying: { icon: Loader2, text: 'Deploying', className: 'text-blue-500 border-blue-500/30 bg-blue-500/10' },
    failed: { icon: AlertTriangle, text: 'Failed', className: 'text-red-500 border-red-500/30 bg-red-500/10' },
    unknown: { icon: CircleDashed, text: 'Not scanned', className: 'text-muted-foreground border-border bg-muted/30' },
  }[effectiveStatus];
  const StatusIcon = appearance.icon;

  return (
    <div className="min-w-0 flex-1 rounded-2xl border bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Server className="h-5 w-5 text-primary" />
        </div>
        {environment.protected && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>
      <div className="mt-4">
        <div className="truncate font-semibold">{environment.name}</div>
        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{environment.tier}</div>
      </div>
      <div className={`mt-4 flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${appearance.className}`}>
        <StatusIcon className={`h-3.5 w-3.5 ${effectiveStatus === 'deploying' ? 'animate-spin' : ''}`} />
        <span className="font-medium">{appearance.text}</span>
      </div>
      <div className="mt-3 truncate font-mono text-[9px] text-muted-foreground">
        {environment.schema_fingerprint ? `schema ${environment.schema_fingerprint.slice(0, 8)}` : 'schema version unavailable'}
      </div>
      <button onClick={onConfigureProvider} className="mt-3 text-[10px] font-medium text-primary hover:underline">
        Configure {environment.tier === 'preview' ? 'rehearsal provider' : 'target connection'}
      </button>
    </div>
  );
}

function PipelineInsight({ icon: Icon, label, value }: { icon: typeof GitCompareArrows; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-r p-4 last:border-r-0">
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <div>
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[10px] text-muted-foreground">{value}</div>
      </div>
    </div>
  );
}
