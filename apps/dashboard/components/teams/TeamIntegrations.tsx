'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, PlugZap, Plus, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const eventLabels: Record<string, string> = {
  'approval.requested': 'Approval requested',
  'promotion.deployed': 'Promotion deployed',
  'promotion.failed': 'Promotion failed',
  'rehearsal.failed': 'Rehearsal failed',
  'drift.detected': 'Schema drift detected',
};

export default function TeamIntegrations({ teamId }: { teamId: string }) {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [events, setEvents] = useState<string[]>(Object.keys(eventLabels));
  const [provider, setProvider] = useState('slack');
  const [name, setName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['approval.requested', 'promotion.failed', 'rehearsal.failed']);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const load = useCallback(async () => {
    const response = await fetch(`/api/teams/${teamId}/integrations`);
    const body = await response.json();
    if (response.ok) { setIntegrations(body.integrations || []); setEvents(body.supportedEvents || Object.keys(eventLabels)); }
  }, [teamId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSaving(true);
    const response = await fetch(`/api/teams/${teamId}/integrations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, name: name || `${provider} notifications`, webhookUrl, events: selectedEvents }),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) return toast({ title: 'Integration failed', description: body.error, variant: 'destructive' });
    setName(''); setWebhookUrl(''); await load();
    toast({ title: 'Integration connected', description: 'Matching DevSync events will be delivered asynchronously.' });
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this team integration and its delivery history?')) return;
    const response = await fetch(`/api/teams/${teamId}/integrations?integrationId=${id}`, { method: 'DELETE' });
    if (response.ok) await load();
  };

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="border-b bg-gradient-to-r from-violet-500/10 to-cyan-500/10 p-5">
        <div className="flex items-center gap-3"><PlugZap className="h-5 w-5 text-violet-500" /><div><h2 className="font-semibold">Team integrations</h2><p className="text-xs text-muted-foreground">Deliver database-change events to the tools where your team works.</p></div></div>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={provider} onChange={(event) => setProvider(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="slack">Slack</option><option value="teams">Microsoft Teams</option><option value="generic">Generic webhook</option></select>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Integration name" />
          </div>
          <Input type="password" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://..." className="font-mono text-xs" />
          <div className="grid gap-2 sm:grid-cols-2">
            {events.map((event) => <label key={event} className="flex items-center gap-2 rounded-lg border p-2 text-[10px]"><input type="checkbox" checked={selectedEvents.includes(event)} onChange={() => setSelectedEvents((current) => current.includes(event) ? current.filter((item) => item !== event) : [...current, event])} />{eventLabels[event] || event}</label>)}
          </div>
          <Button onClick={create} disabled={saving || !webhookUrl || !selectedEvents.length}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Connect integration</Button>
        </div>
        <div className="space-y-3">
          {integrations.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">No outbound integrations configured.</div> : integrations.map((integration) => {
            const deliveries = [...(integration.deliveries || [])].sort((a: any, b: any) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 3);
            return <div key={integration.id} className="rounded-xl border p-3"><div className="flex items-center justify-between"><div><div className="text-xs font-semibold">{integration.name}</div><div className="text-[9px] uppercase text-muted-foreground">{integration.provider} · {integration.events.length} events</div></div><button onClick={() => remove(integration.id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button></div><div className="mt-3 space-y-1">{deliveries.map((delivery: any) => <div key={delivery.id} className="flex items-center gap-2 text-[9px] text-muted-foreground">{delivery.status === 'delivered' ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : delivery.status === 'failed' ? <XCircle className="h-3 w-3 text-red-500" /> : <Loader2 className="h-3 w-3 animate-spin" />}{delivery.event_type} · {delivery.status}{delivery.error_message ? ` · ${delivery.error_message}` : ''}</div>)}</div></div>;
          })}
        </div>
      </div>
    </section>
  );
}
