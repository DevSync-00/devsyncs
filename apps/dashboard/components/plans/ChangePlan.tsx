'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, Code2, FileCheck2, GitCompare, History, Loader2, ShieldCheck, Sparkles, TestTube2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import PatchBundleReview from './PatchBundleReview';

export default function ChangePlan({ scanReportId }: { scanReportId: string }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const { toast } = useToast();
  const load = useCallback(async () => {
    const response = await fetch(`/api/scan-reports/${scanReportId}/change-plans`);
    const body = await response.json();
    if (response.ok) setPlans(body.plans || []);
    setLoading(false);
  }, [scanReportId]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/scan-reports/${scanReportId}/change-plans`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Plan generation failed');
      await load();
      toast({ title: 'Evidence-backed plan created', description: 'Review citations, patches, tests, and unresolved questions before approval.' });
    } catch (error) {
      toast({ title: 'Plan generation failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setGenerating(false); }
  };

  const plan = plans[0];
  const versions = [...(plan?.versions || [])].sort((a: any, b: any) => b.version - a.version);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const version = versions.find((item: any) => item.id === selectedVersionId) || versions[0];
  const previousVersion = versions.find((item: any) => item.version === version?.version - 1);
  if (loading) return <div className="h-24 animate-pulse rounded-2xl border bg-card" />;
  if (!version) return (
    <section className="flex flex-col items-center rounded-2xl border border-dashed bg-card p-8 text-center">
      <Sparkles className="h-8 w-8 text-violet-500" />
      <h2 className="mt-3 font-semibold">Prepare a safe change plan</h2>
      <p className="mt-1 max-w-lg text-xs text-muted-foreground">Generate an evidence-cited rollout, application patch list, compatibility tests, and approval boundary.</p>
      <Button className="mt-4" onClick={generate} disabled={generating}>
        {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Generate change plan
      </Button>
    </section>
  );

  const approve = async () => {
    const response = await fetch(`/api/change-plans/${version.id}/approve`, { method: 'POST' });
    const body = await response.json();
    if (!response.ok) return toast({ title: 'Approval blocked', description: body.error, variant: 'destructive' });
    await load();
    toast({ title: 'Plan approved', description: 'This immutable version is approved; execution remains separately gated.' });
  };

  const enrich = async () => {
    setEnriching(true);
    try {
      const response = await fetch(`/api/change-plans/${plan.id}/enrich`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.details || body.error);
      await load();
      toast({ title: 'AI-enriched version created', description: 'Safety facts and citations were preserved and the previous version was superseded.' });
    } catch (error) {
      toast({ title: 'Enrichment rejected', description: error instanceof Error ? error.message : 'Invalid model response', variant: 'destructive' });
    } finally { setEnriching(false); }
  };

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <button onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between border-b bg-gradient-to-r from-violet-500/10 to-primary/5 p-5 text-left">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/10 p-2.5"><Sparkles className="h-5 w-5 text-violet-500" /></div>
          <div><h2 className="font-semibold">Change plan · v{version.version}</h2><p className="text-xs text-muted-foreground">{version.objective}</p></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right"><div className="text-lg font-bold">{Math.round(Number(version.confidence) * 100)}%</div><div className="text-[9px] text-muted-foreground">confidence</div></div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${version.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{version.status}</span>
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && <div className="p-5">
        <div className="mb-5 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold">
              <History className="h-4 w-4 text-primary" /> Version history
            </div>
            <div className="flex flex-wrap gap-2">
              {versions.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedVersionId(item.id)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${item.id === version.id ? 'border-primary bg-primary/10' : 'bg-card hover:border-primary/40'}`}
                >
                  <div className="flex items-center gap-2 text-[10px] font-semibold">
                    v{item.version}
                    <span className={item.generated_by === 'ai-enriched' ? 'text-violet-500' : 'text-emerald-500'}>
                      {item.generated_by === 'ai-enriched' ? 'AI enriched' : 'Deterministic'}
                    </span>
                  </div>
                  <div className="mt-1 text-[9px] text-muted-foreground">{item.status}</div>
                </button>
              ))}
            </div>
          </div>
          <VersionComparison current={version} previous={previousVersion} />
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {(version.steps || []).map((step: any, index: number) => (
            <div key={step.id} className="relative rounded-xl border p-4">
              <div className="mb-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">{step.phase}</div>
              <div className="mt-1 text-sm font-semibold">{step.title}</div>
              <div className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{step.description}</div>
              <div className="mt-3 flex flex-wrap gap-1">{step.citations.map((id: string) => <span key={id} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[8px]">{id}</span>)}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <PlanList icon={Code2} title="Application patches" items={(version.patch_proposals || []).map((item: any) => `${item.file} — ${item.purpose}`)} />
          <PlanList icon={TestTube2} title="Tests to add" items={(version.test_proposals || []).map((item: any) => `${item.name} — ${item.description}`)} />
          <PlanList icon={FileCheck2} title="Unresolved questions" items={version.unresolved_questions || []} />
        </div>
        <PatchBundleReview versionId={version.id} status={version.status} />
        <details className="mt-4 rounded-xl border bg-muted/20">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold">{version.citations?.length || 0} evidence citations</summary>
          <div className="grid gap-2 border-t p-4 md:grid-cols-2">
            {(version.citations || []).map((item: any) => <div key={item.id} className="rounded-lg border bg-card p-3"><div className="font-mono text-[9px] text-primary">{item.id} · {item.type}</div><div className="mt-1 text-xs font-medium">{item.label}</div><div className="mt-1 text-[10px] text-muted-foreground">{item.detail}</div></div>)}
          </div>
        </details>
        <div className="mt-5 flex items-center justify-between rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-500" /><div><div className="text-xs font-semibold">Human approval boundary</div><div className="text-[10px] text-muted-foreground">Approval freezes this version but does not execute code or SQL.</div></div></div>
          <div className="flex gap-2">
            {version.status === 'proposed' && version.generated_by === 'deterministic' && (
              <Button size="sm" variant="outline" onClick={enrich} disabled={enriching}>
                {enriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Enrich with AI
              </Button>
            )}
            {version.status === 'proposed' ? <Button size="sm" onClick={approve}><Check className="mr-2 h-4 w-4" />Approve version</Button> : <span className="text-xs font-semibold text-emerald-500">Approved</span>}
          </div>
        </div>
      </div>}
    </section>
  );
}

function VersionComparison({ current, previous }: { current: any; previous?: any }) {
  const changedSteps = previous
    ? (current.steps || []).filter((step: any) => {
        const prior = (previous.steps || []).find((item: any) => item.id === step.id);
        return prior && (prior.title !== step.title || prior.description !== step.description);
      }).length
    : 0;
  const changedPatches = previous
    ? (current.patch_proposals || []).filter((patch: any) => {
        const prior = (previous.patch_proposals || []).find((item: any) => item.file === patch.file);
        return prior && prior.purpose !== patch.purpose;
      }).length
    : 0;

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <GitCompare className="h-4 w-4 text-violet-500" /> Provenance & changes
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase ${current.generated_by === 'ai-enriched' ? 'bg-violet-500/10 text-violet-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
          {current.generated_by === 'ai-enriched' ? `${current.model_provider || 'AI'} · ${current.model_name || 'configured model'}` : 'rules engine'}
        </span>
        <span className="font-mono text-[9px] text-muted-foreground">{String(current.content_hash || '').slice(0, 10)}</span>
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        {previous
          ? `${changedSteps} step${changedSteps === 1 ? '' : 's'} and ${changedPatches} patch description${changedPatches === 1 ? '' : 's'} changed from v${previous.version}. Evidence, risk, confidence, and safety gates are locked.`
          : 'Original evidence-backed version. No model-generated content is present.'}
      </p>
    </div>
  );
}

function PlanList({ icon: Icon, title, items }: { icon: typeof Code2; title: string; items: string[] }) {
  return <div className="rounded-xl border p-4"><div className="flex items-center gap-2 text-xs font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</div><div className="mt-3 space-y-2">{items.length ? items.slice(0, 8).map((item) => <div key={item} className="text-[10px] leading-relaxed text-muted-foreground">{item}</div>) : <div className="text-[10px] text-muted-foreground">None detected.</div>}</div></div>;
}
