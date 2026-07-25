'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Check, CreditCard, Download, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function EnterpriseControlCenter({ teamId }: { teamId: string }) {
  const [data, setData] = useState<any>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetch(`/api/teams/${teamId}/enterprise`).then((r) => r.json()).then(setData), [teamId]);
  useEffect(() => { load(); }, [load]);

  const act = async (url: string, body: any) => {
    setBusy(true); setMessage('');
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(result.error || 'Request failed.');
    if (result.url) window.location.href = result.url;
    if (result.token?.value) setMessage(`Copy this token now — it will not be shown again: ${result.token.value}`);
    await load();
  };
  const save = async () => {
    setBusy(true); setMessage('');
    const security = data.security || {};
    const response = await fetch(`/api/teams/${teamId}/enterprise`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ssoRequired: !!security.sso_required, ssoProviderId: security.sso_provider_id || null,
        verifiedDomains: String(security.verified_domains_text || (security.verified_domains || []).join(',')).split(',').map((x) => x.trim()).filter(Boolean),
        scimEnabled: !!security.scim_enabled, requireMfa: !!security.require_mfa,
        sessionMaxHours: Number(security.session_max_hours || 168), auditRetentionDays: Number(security.audit_retention_days || 90),
      }),
    });
    const result = await response.json(); setBusy(false);
    setMessage(response.ok ? 'Enterprise security settings saved.' : result.error);
    if (response.ok) await load();
  };
  if (!data) return <div className="rounded-xl border p-6 text-sm text-muted-foreground">Loading enterprise controls…</div>;
  const security = data.security || {};
  const plan = data.entitlements?.plan || 'free';
  const update = (patch: any) => setData({ ...data, security: { ...security, ...patch } });
  const Feature = ({ label, enabled }: any) => <div className="flex items-center gap-2 text-sm"><span className={`grid h-5 w-5 place-items-center rounded-full ${enabled ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'}`}><Check className="h-3 w-3" /></span>{label}</div>;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="border-b bg-gradient-to-r from-indigo-500/10 via-cyan-500/5 to-transparent p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="mb-2 flex items-center gap-2 text-sm font-medium text-indigo-600"><Building2 className="h-4 w-4" />Enterprise control center</div><h2 className="text-2xl font-semibold capitalize">{plan} workspace</h2><p className="mt-1 text-sm text-muted-foreground">Identity, security, compliance, usage, and billing in one place.</p></div>
          <span className="rounded-full border bg-background px-3 py-1 text-xs font-semibold uppercase tracking-wide">{data.entitlements.status}</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Feature label="SAML SSO" enabled={data.entitlements.features.sso} /><Feature label="SCIM" enabled={data.entitlements.features.scim} />
          <Feature label="Audit export" enabled={data.entitlements.features.auditExport} /><Feature label="Managed previews" enabled={data.entitlements.features.managedPreviews} />
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border p-5">
          <h3 className="flex items-center gap-2 font-semibold"><LockKeyhole className="h-4 w-4 text-indigo-500" />Identity and access</h3>
          <label className="block text-sm">Supabase SSO provider ID<Input className="mt-1" value={security.sso_provider_id || ''} onChange={(e) => update({ sso_provider_id: e.target.value })} placeholder="Provider UUID" /></label>
          <label className="block text-sm">Verified domains<Input className="mt-1" value={security.verified_domains_text ?? (security.verified_domains || []).join(', ')} onChange={(e) => update({ verified_domains_text: e.target.value })} placeholder="company.com, subsidiary.com" /></label>
          {[['sso_required', 'Require SSO'], ['require_mfa', 'Require MFA'], ['scim_enabled', 'Enable SCIM provisioning']].map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-lg bg-muted/40 p-3 text-sm"><span>{label}</span><input type="checkbox" checked={!!security[key]} onChange={(e) => update({ [key]: e.target.checked })} /></label>)}
          <div className="grid grid-cols-2 gap-3"><label className="text-sm">Session hours<Input type="number" value={security.session_max_hours || 168} onChange={(e) => update({ session_max_hours: e.target.value })} /></label><label className="text-sm">Audit retention days<Input type="number" value={security.audit_retention_days || 90} onChange={(e) => update({ audit_retention_days: e.target.value })} /></label></div>
          <Button disabled={busy} onClick={save}><ShieldCheck className="mr-2 h-4 w-4" />Save security policy</Button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border p-5"><h3 className="mb-3 flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-cyan-600" />SCIM provisioning</h3><p className="mb-3 text-sm text-muted-foreground">Use the bearer token with <code>/api/scim/v2/Users</code>. Tokens are hashed at rest.</p><Button variant="outline" disabled={busy || !data.entitlements.features.scim} onClick={() => act(`/api/teams/${teamId}/enterprise`, { action: 'create-token', name: 'Identity provider' })}>Generate token</Button><p className="mt-3 text-xs text-muted-foreground">{data.scimTokens.length} token{data.scimTokens.length === 1 ? '' : 's'} created</p></div>
          <div className="rounded-xl border p-5"><h3 className="mb-3 flex items-center gap-2 font-semibold"><CreditCard className="h-4 w-4 text-emerald-600" />Plan and usage</h3><div className="mb-4 grid grid-cols-2 gap-3">{Object.entries(data.usage || {}).map(([key, value]) => <div key={key} className="rounded-lg bg-muted/50 p-3"><div className="text-xl font-semibold">{String(value)}</div><div className="text-xs text-muted-foreground">{key}</div></div>)}</div><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => act('/api/billing/checkout', { teamId, plan: 'team' })}>Upgrade to Team</Button><Button variant="outline" disabled={busy} onClick={() => act('/api/billing/checkout', { teamId, plan: 'enterprise' })}>Get Enterprise</Button><Button variant="ghost" disabled={busy} onClick={() => act('/api/billing/portal', { teamId })}>Billing portal</Button></div></div>
          <a className="flex items-center justify-between rounded-xl border p-4 text-sm font-medium hover:bg-muted/40" href={`/api/teams/${teamId}/audit-export?format=csv`}><span><Download className="mr-2 inline h-4 w-4" />Export cryptographically chained audit log</span><span>CSV</span></a>
        </div>
      </div>
      {message && <div className="border-t bg-muted/30 px-6 py-4 text-sm">{message}</div>}
    </section>
  );
}
