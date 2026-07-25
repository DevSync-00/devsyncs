'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, CircleDashed, FileLock2, Loader2, Plus, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const ruleLabels: Record<string, string> = {
  'no-breaking-changes': 'No breaking application changes',
  'require-owners': '100% ownership coverage',
  'require-tests': 'Relevant compatibility tests',
  'require-real-rehearsal': 'Real preview rehearsal',
  'require-rollback': 'Verified rollback',
  'max-risk-score': 'Maximum risk score',
  'required-approvals': 'Production approval quorum',
  'separation-of-duties': 'Independent approver required',
};

export default function PolicyCenter({ projectId }: { projectId: string }) {
  const [policies, setPolicies] = useState<any[]>([]);
  const [recommendedRules, setRecommendedRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/policies`);
      const body = await response.json();
      if (response.ok) {
        setPolicies(body.policies || []);
        setRecommendedRules(body.recommendedRules || []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const createPolicy = async () => {
    setCreating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enforcement: 'block', useRecommendedRules: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Policy creation failed');
      await load();
      toast({ title: 'Safety policy enabled', description: 'Unsafe pull requests and promotions will now be blocked.' });
    } catch (error) {
      toast({ title: 'Could not enable policy', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const policy = policies[0];
  const rules = policy?.rules || recommendedRules;
  const updatePolicy = async (changes: Record<string, unknown>) => {
    if (!policy) return;
    const response = await fetch(`/api/projects/${projectId}/policies`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policyId: policy.id, ...changes }),
    });
    const body = await response.json();
    if (!response.ok) return toast({ title: 'Policy update failed', description: body.error, variant: 'destructive' });
    setPolicies((current) => current.map((item) => item.id === policy.id ? body.policy : item));
    toast({ title: 'Policy updated', description: 'The new rules apply to future reviews and promotions.' });
  };
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-card">
      <div className="flex flex-col gap-4 border-b bg-gradient-to-br from-emerald-500/10 via-card to-cyan-500/10 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/10 p-2.5"><FileLock2 className="h-5 w-5 text-emerald-500" /></div>
          <div>
            <h2 className="font-semibold">Change policy</h2>
            <p className="text-xs text-muted-foreground">The same safety rules in PRs, rehearsals, approvals, and promotions.</p>
          </div>
        </div>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : policy ? (
          <div className="flex items-center gap-1 rounded-lg border bg-background/70 p-1">
            {['observe', 'warn', 'block'].map((mode) => (
              <button key={mode} onClick={() => updatePolicy({ enforcement: mode })} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold capitalize ${policy.enforcement === mode ? 'bg-emerald-500/10 text-emerald-500' : 'text-muted-foreground hover:bg-muted'}`}>
                {mode}
              </button>
            ))}
          </div>
        ) : (
          <Button size="sm" onClick={createPolicy} disabled={creating}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Enable recommended policy
          </Button>
        )}
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
        {rules.map((rule: any) => (
          <button key={rule.id} disabled={!policy} onClick={() => updatePolicy({ rules: rules.map((item: any) => item.id === rule.id ? { ...item, enabled: item.enabled === false } : item) })} className="flex items-start gap-3 bg-card p-4 text-left disabled:cursor-default">
            <div className={`mt-0.5 rounded-full p-1 ${policy ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
              {policy && rule.enabled !== false ? <Check className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
            </div>
            <div>
              <div className="text-xs font-medium">{ruleLabels[rule.id] || rule.id}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {rule.value !== undefined ? `Threshold: ${rule.value}` : rule.environments ? `For ${rule.environments.join(' and ')}` : 'Required for every change'}
              </div>
            </div>
          </button>
        ))}
      </div>
      {!policy && (
        <div className="flex items-center gap-2 border-t bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
          <Shield className="h-3.5 w-3.5" /> Preview only—enable the policy to enforce these rules.
        </div>
      )}
    </section>
  );
}
