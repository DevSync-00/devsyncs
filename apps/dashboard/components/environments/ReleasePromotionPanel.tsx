'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDashed,
  GitCommitHorizontal,
  Loader2,
  LockKeyhole,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type Gate = {
  id: string;
  label: string;
  status: 'passed' | 'failed' | 'required';
  reason: string;
};

type Target = {
  environment: {
    id: string;
    name: string;
    slug: string;
    tier: string;
    protected: boolean;
  };
  readiness: {
    score: number;
    decision: 'blocked' | 'approval_required' | 'ready';
    summary: string;
    gates: Gate[];
  };
  promotion?: {
    id: string;
    status: string;
    approved_by?: string | null;
    required_approvals?: number;
    confirmation_text?: string;
    approvals?: Array<{ id: string }>;
    execution_metrics?: Record<string, any>;
  } | null;
  executionJob?: {
    status: string;
    progress?: { stage?: string; percent?: number };
    last_error?: string | null;
    cancel_requested?: boolean;
  } | null;
};

export default function ReleasePromotionPanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [planning, setPlanning] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [migration, setMigration] = useState<{ id: string; filename?: string; name?: string } | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const { toast } = useToast();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/promotions`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Failed to evaluate release');
      setMigration(body.migration || null);
      const enriched = await Promise.all((body.targets || []).map(async (target: Target) => {
        if (!target.promotion || !['queued', 'deploying', 'failed', 'deployed', 'cancelled'].includes(target.promotion.status)) return target;
        const statusResponse = await fetch(`/api/promotions/${target.promotion.id}/execution`);
        const statusBody = await statusResponse.json();
        return statusResponse.ok ? { ...target, promotion: statusBody.promotion, executionJob: statusBody.job } : target;
      }));
      setTargets(enriched);
    } catch (error) {
      toast({
        title: 'Release evaluation unavailable',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);
  useEffect(() => {
    if (!open || !targets.some((target) => ['queued', 'deploying'].includes(target.promotion?.status || ''))) return;
    const timer = window.setInterval(() => load(true), 3000);
    return () => window.clearInterval(timer);
  }, [open, targets, load]);

  const plan = async (target: Target) => {
    if (!migration) return;
    setPlanning(target.environment.id);
    try {
      const response = await fetch(`/api/projects/${projectId}/promotions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEnvironmentId: target.environment.id,
          migrationId: migration.id,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Failed to create promotion plan');
      toast({
        title: body.readiness.decision === 'blocked' ? 'Promotion plan is blocked' : 'Promotion plan created',
        description: body.readiness.summary,
        variant: body.readiness.decision === 'blocked' ? 'destructive' : 'default',
      });
      await load();
    } catch (error) {
      toast({ title: 'Planning failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setPlanning(null);
    }
  };

  const approve = async (promotionId: string) => {
    setApproving(promotionId);
    try {
      const response = await fetch(`/api/promotions/${promotionId}/approve`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Approval failed');
      toast({ title: 'Promotion approved', description: 'Human approval was recorded in the release evidence.' });
      await load();
    } catch (error) {
      toast({ title: 'Approval failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setApproving(null);
    }
  };

  const execute = async (promotion: NonNullable<Target['promotion']>) => {
    const expected = promotion.confirmation_text || 'PROMOTE';
    const confirmationText = window.prompt(`Type "${expected}" to execute this promotion:`);
    if (confirmationText === null) return;
    setExecuting(promotion.id);
    try {
      const response = await fetch(`/api/promotions/${promotion.id}/execute`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmationText }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.details || body.error || 'Execution failed');
      toast({ title: 'Promotion queued', description: 'The worker will revalidate live evidence before connecting to the target.' });
      await load();
    } catch (error) {
      toast({ title: 'Execution blocked', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setExecuting(null); }
  };

  const cancel = async (promotionId: string) => {
    const response = await fetch(`/api/promotions/${promotionId}/execution`, { method: 'DELETE' });
    const body = await response.json();
    if (!response.ok) return toast({ title: 'Cancellation failed', description: body.error, variant: 'destructive' });
    toast({ title: 'Cancellation requested', description: 'The worker will stop at the next safe boundary.' });
    await load(true);
  };

  return (
    <div className="border-t">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-muted/30"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-violet-500/10 p-2">
            <Rocket className="h-4 w-4 text-violet-500" />
          </div>
          <div>
            <div className="text-sm font-semibold">Plan a release promotion</div>
            <div className="text-[11px] text-muted-foreground">Evaluate every gate before creating an explicit deployment plan.</div>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t bg-muted/10 p-5">
          {loading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !migration ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <GitCommitHorizontal className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              <div className="text-sm font-medium">No migration is ready to promote</div>
              <div className="text-xs text-muted-foreground">Generate a migration from a scan report first.</div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-3 rounded-xl border bg-card p-3">
                <GitCommitHorizontal className="h-4 w-4 text-primary" />
                <div>
                  <div className="text-xs font-semibold">{migration.filename || migration.name || 'Latest migration'}</div>
                  <div className="font-mono text-[9px] text-muted-foreground">{migration.id}</div>
                </div>
              </div>
              <div className="space-y-4">
                {targets.map((target) => (
                  <TargetReadiness
                    key={target.environment.id}
                    target={target}
                    planning={planning === target.environment.id}
                    approving={Boolean(target.promotion && approving === target.promotion.id)}
                    executing={Boolean(target.promotion && executing === target.promotion.id)}
                    onPlan={() => plan(target)}
                    onApprove={() => target.promotion && approve(target.promotion.id)}
                    onExecute={() => target.promotion && execute(target.promotion)}
                    onCancel={() => target.promotion && cancel(target.promotion.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TargetReadiness({
  target,
  planning,
  approving,
  executing,
  onPlan,
  onApprove,
  onExecute,
  onCancel,
}: {
  target: Target;
  planning: boolean;
  approving: boolean;
  executing: boolean;
  onPlan: () => void;
  onApprove: () => void;
  onExecute: () => void;
  onCancel: () => void;
}) {
  const blocked = target.readiness.decision === 'blocked';
  const approval = target.readiness.decision === 'approval_required';
  const tone = blocked ? 'text-red-500' : approval ? 'text-amber-500' : 'text-emerald-500';

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-full border-4 border-muted text-sm font-bold ${tone}`}>
            {target.readiness.score}
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {target.environment.name}
              {target.environment.protected && <LockKeyhole className="h-3 w-3 text-muted-foreground" />}
            </div>
            <div className="text-[11px] text-muted-foreground">{target.readiness.summary}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onPlan} disabled={planning}>
            {planning && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {target.promotion ? 'Refresh plan' : 'Create plan'}
          </Button>
          {target.promotion?.status === 'awaiting_approval' && (
            <Button size="sm" onClick={onApprove} disabled={approving}>
              {approving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-2 h-3.5 w-3.5" />}
              Approve
            </Button>
          )}
          {target.promotion?.status === 'approved' && (
            <Button size="sm" onClick={onExecute} disabled={executing}>
              {executing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-2 h-3.5 w-3.5" />}
              Execute
            </Button>
          )}
          {['queued', 'deploying'].includes(target.promotion?.status || '') && (
            <Button size="sm" variant="outline" onClick={onCancel} disabled={target.executionJob?.cancel_requested}>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              {target.executionJob?.cancel_requested ? 'Cancelling' : 'Cancel'}
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {target.readiness.gates.map((gate, index) => {
          const state = gate.status === 'passed'
            ? { icon: Check, classes: 'text-emerald-500 bg-emerald-500/10' }
            : gate.status === 'failed'
              ? { icon: AlertTriangle, classes: 'text-red-500 bg-red-500/10' }
              : { icon: CircleDashed, classes: 'text-amber-500 bg-amber-500/10' };
          const Icon = state.icon;
          return (
            <div key={gate.id} className="relative bg-card p-3">
              {index < target.readiness.gates.length - 1 && (
                <ArrowRight className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 bg-card text-muted-foreground lg:block" />
              )}
              <div className={`mb-2 inline-flex rounded-md p-1.5 ${state.classes}`}>
                <Icon className="h-3 w-3" />
              </div>
              <div className="text-[11px] font-medium">{gate.label}</div>
              <div className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-muted-foreground" title={gate.reason}>{gate.reason}</div>
            </div>
          );
        })}
      </div>
      {target.executionJob && (
        <div className="border-t bg-muted/20 p-3">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-medium capitalize">{target.executionJob.progress?.stage?.replace(/-/g, ' ') || target.executionJob.status}</span>
            <span>{target.executionJob.progress?.percent || (target.promotion?.status === 'deployed' ? 100 : 0)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${target.executionJob.progress?.percent || (target.promotion?.status === 'deployed' ? 100 : 0)}%` }} />
          </div>
          {(target.executionJob.last_error || target.promotion?.execution_metrics?.error) && (
            <div className="mt-2 text-[10px] text-red-500">{target.executionJob.last_error || target.promotion?.execution_metrics?.error}</div>
          )}
          {target.promotion?.status === 'deployed' && target.promotion.execution_metrics && (
            <div className="mt-2 flex flex-wrap gap-3 text-[9px] text-muted-foreground">
              <span>{target.promotion.execution_metrics.durationMs || 0} ms</span>
              <span>{target.promotion.execution_metrics.rowCount || 0} rows</span>
              <span>{target.promotion.execution_metrics.command || 'migration'} committed</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
