'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FlaskConical,
  Loader2,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type Rehearsal = {
  id: string;
  status: 'queued' | 'provisioning' | 'running' | 'passed' | 'failed' | 'cancelled';
  strategy: string;
  execution_time_ms?: number | null;
  rollback_status?: 'not_tested' | 'passed' | 'failed' | null;
  lock_estimates?: Array<{
    statement: number;
    object: string;
    level: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    mitigation?: string;
  }>;
  test_results?: Array<{ id: string; label: string; status: 'passed' | 'warning' | 'failed'; detail: string }>;
  evidence?: string[];
  created_at: string;
  environment?: { id: string; name: string; tier: string } | null;
};

export default function MigrationRehearsal({ migrationId }: { migrationId: string }) {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [previewEnvironments, setPreviewEnvironments] = useState<Array<{ id: string; name: string; configured: boolean; connectionPreview?: string }>>([]);
  const [selectedPreview, setSelectedPreview] = useState('');
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/migrations/${migrationId}/rehearsals`);
      const body = await response.json();
      if (response.ok) {
        setRehearsals(body.rehearsals || []);
        setPreviewEnvironments(body.previewEnvironments || []);
        const configured = (body.previewEnvironments || []).find((environment: any) => environment.configured);
        if (configured) setSelectedPreview((current) => current || configured.id);
      }
    } finally {
      setLoading(false);
    }
  }, [migrationId]);

  useEffect(() => { load(); }, [load]);

  const run = async (real = false) => {
    setRunning(true);
    try {
      const response = await fetch(`/api/migrations/${migrationId}/rehearsals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(real
          ? { strategy: 'production-shaped', environmentId: selectedPreview }
          : { strategy: 'schema-only' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Rehearsal failed');
      setRehearsals((current) => [body.rehearsal, ...current]);
      setExpanded(true);
      toast({
        title: body.rehearsal.status === 'passed' ? `${real ? 'Preview' : 'Static'} rehearsal passed` : 'Rehearsal found a blocker',
        description: real
          ? 'The migration executed and rolled back against the isolated preview database.'
          : 'Lock risk, destructive operations, and rollback readiness were evaluated.',
        variant: body.rehearsal.status === 'passed' ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({
        title: 'Could not run rehearsal',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRunning(false);
    }
  };

  const latest = rehearsals[0];
  const passed = latest?.status === 'passed';

  return (
    <div className="rounded-xl border bg-muted/20">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <button className="flex items-center gap-3 text-left" onClick={() => latest && setExpanded((value) => !value)}>
          <div className={`rounded-lg p-2 ${latest ? passed ? 'bg-emerald-500/10' : 'bg-red-500/10' : 'bg-violet-500/10'}`}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> :
              latest ? passed ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" /> :
                <FlaskConical className="h-4 w-4 text-violet-500" />}
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              Migration rehearsal
              {latest && <span className={`rounded-full px-2 py-0.5 text-[9px] uppercase ${passed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{latest.status}</span>}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {latest ? `Latest ${latest.strategy} preflight · ${latest.execution_time_ms || 0}ms` : 'Estimate locks, validate rollback, and catch destructive SQL.'}
            </div>
          </div>
          {latest && <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${expanded ? 'rotate-180' : ''}`} />}
        </button>
        <div className="flex flex-col gap-2 sm:flex-row">
          {previewEnvironments.some((environment) => environment.configured) && (
            <>
              <select
                value={selectedPreview}
                onChange={(event) => setSelectedPreview(event.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-xs"
              >
                {previewEnvironments.filter((environment) => environment.configured).map((environment) => (
                  <option key={environment.id} value={environment.id}>{environment.name}</option>
                ))}
              </select>
              <Button size="sm" onClick={() => run(true)} disabled={running || !selectedPreview}>
                {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Run real preview
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => run(false)} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
            Static preflight
          </Button>
        </div>
      </div>

      {expanded && latest && (
        <div className="border-t p-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <MiniStat icon={Clock3} label="Analysis time" value={`${latest.execution_time_ms || 0} ms`} good />
            <MiniStat icon={LockKeyhole} label="High lock risks" value={String((latest.lock_estimates || []).filter((item) => ['high', 'critical'].includes(item.level)).length)} good={!(latest.lock_estimates || []).some((item) => ['high', 'critical'].includes(item.level))} />
            <MiniStat icon={RotateCcw} label="Rollback" value={(latest.rollback_status || 'not tested').replace('_', ' ')} good={latest.rollback_status === 'passed'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Safety checks</div>
              <div className="space-y-2">
                {(latest.test_results || []).map((check) => (
                  <div key={check.id} className="flex gap-2 rounded-lg border bg-card p-3">
                    {check.status === 'passed'
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      : <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${check.status === 'failed' ? 'text-red-500' : 'text-amber-500'}`} />}
                    <div>
                      <div className="text-xs font-medium">{check.label}</div>
                      <div className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{check.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lock estimates</div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {(latest.lock_estimates || []).map((estimate) => (
                  <div key={`${estimate.statement}-${estimate.object}`} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs">{estimate.object}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${
                        estimate.level === 'critical' ? 'bg-red-500/10 text-red-500' :
                          estimate.level === 'high' ? 'bg-orange-500/10 text-orange-500' :
                            estimate.level === 'medium' ? 'bg-amber-500/10 text-amber-500' :
                              'bg-emerald-500/10 text-emerald-500'
                      }`}>{estimate.level}</span>
                    </div>
                    <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{estimate.reason}</div>
                    {estimate.mitigation && <div className="mt-2 text-[10px] text-primary">Mitigation: {estimate.mitigation}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-[10px] text-muted-foreground">
            Static rehearsal analyzes SQL without touching a database. Configure a preview provider before treating lock duration, data checks, query replay, or rollback execution as verified.
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, good }: { icon: typeof Clock3; label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <Icon className={`h-4 w-4 ${good ? 'text-emerald-500' : 'text-amber-500'}`} />
      <div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold capitalize">{value}</div>
      </div>
    </div>
  );
}
