'use client';

import { useCallback, useEffect, useState } from 'react';
import { Code2, FileWarning, Loader2, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function PatchBundleReview({ versionId, status }: { versionId: string; status: string }) {
  const [bundle, setBundle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();
  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/change-plan-versions/${versionId}/patches`);
    const body = await response.json();
    if (response.ok) setBundle(body.bundles?.[0] || null);
    setLoading(false);
  }, [versionId]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/change-plan-versions/${versionId}/patches`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Patch generation failed');
      setBundle(body.bundle);
      toast({ title: body.duplicate ? 'Patch bundle unchanged' : 'Patch bundle generated', description: 'Review every artifact before export or execution.' });
    } catch (error) {
      toast({ title: 'Patch generation blocked', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setGenerating(false); }
  };

  if (loading) return <div className="mt-4 h-20 animate-pulse rounded-xl border bg-muted/20" />;
  if (!bundle) return (
    <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed p-5 text-center">
      <PackageCheck className="h-6 w-6 text-primary" />
      <div className="mt-2 text-xs font-semibold">Reviewable patch bundle</div>
      <div className="mt-1 max-w-lg text-[10px] text-muted-foreground">
        Concrete SQL fixes become reviewable patches. Application changes remain instructions until full AST source context is available.
      </div>
      <Button className="mt-3" size="sm" onClick={generate} disabled={status !== 'approved' || generating}>
        {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Code2 className="mr-2 h-4 w-4" />}
        {status === 'approved' ? 'Generate patch bundle' : 'Approve this version first'}
      </Button>
    </div>
  );

  return (
    <div className="mt-4 rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold"><PackageCheck className="h-4 w-4 text-primary" /> Patch bundle</div>
        <div className="flex gap-2 text-[9px]">
          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-500">{bundle.summary?.executable || 0} executable SQL</span>
          <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-500">{bundle.summary?.reviewRequired || 0} require review</span>
          <span className="rounded-full bg-muted px-2 py-1 font-mono">{String(bundle.content_hash).slice(0, 10)}</span>
        </div>
      </div>
      <div className="space-y-2 p-4">
        {(bundle.artifacts || []).map((artifact: any) => (
          <details key={artifact.id} className="rounded-lg border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
              <span className="truncate font-mono text-[10px]">{artifact.file}</span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-semibold uppercase ${artifact.executable ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                {artifact.executable ? 'SQL patch · review' : 'instructions only'}
              </span>
            </summary>
            <div className="border-t p-3">
              {!artifact.executable && <div className="mb-2 flex items-center gap-2 text-[9px] text-amber-500"><FileWarning className="h-3 w-3" /> Automatic code changes withheld until AST context is available.</div>}
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-[10px] leading-relaxed text-slate-100">{artifact.content}</pre>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
