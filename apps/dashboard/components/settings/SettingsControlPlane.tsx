'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  Bot,
  Check,
  ChevronRight,
  CircleDollarSign,
  Database,
  KeyRound,
  Laptop,
  Loader2,
  LockKeyhole,
  Monitor,
  Moon,
  Palette,
  PlugZap,
  Save,
  Shield,
  SlidersHorizontal,
  Sun,
  Terminal,
  Trash2,
  UserRound,
} from 'lucide-react';
import AccountProfileForm from '@/components/settings/AccountProfileForm';
import GitHubConnectionsManager from '@/components/github/GitHubConnectionsManager';
import { Button } from '@/components/ui/button';
import type { NotificationPreferences } from '@/lib/notifications';

type Team = { id: string; name: string; role: string };
type Project = { id: string; name: string; schema_type: string };

type LocalPreferences = {
  density: 'compact' | 'comfortable';
  timezone: 'local' | 'utc';
  defaultEnvironment: 'development' | 'staging' | 'production';
  requirePreview: boolean;
  generateRollback: boolean;
  blockDestructive: boolean;
  approvalRequired: boolean;
  aiExplanations: boolean;
  explanationDepth: 'concise' | 'detailed';
};

const defaults: LocalPreferences = {
  density: 'compact',
  timezone: 'local',
  defaultEnvironment: 'development',
  requirePreview: true,
  generateRollback: true,
  blockDestructive: true,
  approvalRequired: true,
  aiExplanations: true,
  explanationDepth: 'concise',
};

const sections = [
  { id: 'general', label: 'General', icon: UserRound },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'developer', label: 'Developer', icon: Terminal },
  { id: 'integrations', label: 'Integrations', icon: PlugZap },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'migrations', label: 'Migration defaults', icon: SlidersHorizontal },
  { id: 'environments', label: 'Environments', icon: Database },
  { id: 'ai', label: 'AI & analysis', icon: Bot },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'billing', label: 'Billing & usage', icon: CircleDollarSign },
  { id: 'danger', label: 'Danger zone', icon: Trash2 },
];

function SettingSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 overflow-hidden rounded-lg border bg-card">
      <div className="border-b px-5 py-4">
        <h2 className="font-mono text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div>
        <div className="text-xs font-medium">{label}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">{description}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-muted'}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function ResourceRow({ icon: Icon, title, meta, href, action = 'Configure' }: {
  icon: typeof Database;
  title: string;
  meta: string;
  href: string;
  action?: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 border-b py-3 first:pt-0 last:border-b-0 last:pb-0 hover:text-primary">
      <span className="rounded-md border bg-background p-2"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{title}</span>
        <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">{meta}</span>
      </span>
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">{action}<ChevronRight className="h-3 w-3" /></span>
    </Link>
  );
}

export default function SettingsControlPlane({
  userId,
  email,
  initialName,
  createdAt,
  lastSignInAt,
  notificationPreferences,
  teams,
  projects,
}: {
  userId: string;
  email: string;
  initialName: string;
  createdAt?: string;
  lastSignInAt?: string;
  notificationPreferences: NotificationPreferences;
  teams: Team[];
  projects: Project[];
}) {
  const [preferences, setPreferences] = useState<LocalPreferences>(defaults);
  const [localSaved, setLocalSaved] = useState(false);
  const [notifications, setNotifications] = useState(notificationPreferences);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('devsync:settings');
      if (stored) setPreferences({ ...defaults, ...JSON.parse(stored) });
    } catch {}
  }, []);

  const updatePreference = <K extends keyof LocalPreferences>(key: K, value: LocalPreferences[K]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    setLocalSaved(false);
  };

  const saveLocalPreferences = () => {
    window.localStorage.setItem('devsync:settings', JSON.stringify(preferences));
    setLocalSaved(true);
  };

  const updateNotifications = async (updates: Partial<NotificationPreferences>) => {
    const previous = notifications;
    const next = { ...notifications, ...updates };
    setNotifications(next);
    setSavingNotifications(true);
    setNotificationError(null);
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-preferences', preferences: updates }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update preferences');
      if (body.preferences) setNotifications(body.preferences);
    } catch (error) {
      setNotifications(previous);
      setNotificationError(error instanceof Error ? error.message : 'Unable to update preferences');
    } finally {
      setSavingNotifications(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <nav className="overflow-hidden rounded-lg border bg-card p-2" aria-label="Settings sections">
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`} className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs hover:bg-muted ${section.id === 'danger' ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}>
              <section.icon className="h-3.5 w-3.5" /> {section.label}
            </a>
          ))}
        </nav>
        <div className="mt-3 rounded-lg border bg-card p-3 font-mono text-[9px] text-muted-foreground">
          <div className="flex items-center gap-1.5 text-emerald-400"><Activity className="h-3 w-3" /> SETTINGS ONLINE</div>
          <div className="mt-2 truncate">user/{userId.slice(0, 8)}</div>
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        <SettingSection id="general" title="General" description="Identity and account-wide defaults.">
          <AccountProfileForm userId={userId} email={email} initialName={initialName} />
          <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2">
            <label className="space-y-2 text-xs">Timezone
              <select value={preferences.timezone} onChange={(event) => updatePreference('timezone', event.target.value as LocalPreferences['timezone'])} className="block h-9 w-full rounded-md border bg-background px-3 font-mono text-xs">
                <option value="local">Browser local time</option><option value="utc">UTC</option>
              </select>
            </label>
            <label className="space-y-2 text-xs">Default environment
              <select value={preferences.defaultEnvironment} onChange={(event) => updatePreference('defaultEnvironment', event.target.value as LocalPreferences['defaultEnvironment'])} className="block h-9 w-full rounded-md border bg-background px-3 font-mono text-xs">
                <option value="development">development</option><option value="staging">staging</option><option value="production">production</option>
              </select>
            </label>
          </div>
        </SettingSection>

        <SettingSection id="appearance" title="Appearance" description="Choose the visual mode and information density for this browser.">
          <div className="grid gap-3 sm:grid-cols-3">
            {[{ name: 'Light', icon: Sun }, { name: 'Dark', icon: Moon }, { name: 'System', icon: Monitor }].map((theme) => (
              <button key={theme.name} onClick={() => {
                const value = theme.name.toLowerCase();
                if (value === 'system') window.localStorage.removeItem('theme');
                else window.localStorage.setItem('theme', value);
                document.documentElement.classList.toggle('dark', value === 'dark' || (value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches));
              }} className="flex items-center gap-2 rounded-md border bg-background p-3 text-xs hover:border-primary/40">
                <theme.icon className="h-4 w-4 text-primary" /> {theme.name}
              </button>
            ))}
          </div>
          <div className="mt-5">
            <div className="mb-2 text-xs font-medium">Interface density</div>
            <div className="inline-flex rounded-md border bg-background p-1">
              {(['compact', 'comfortable'] as const).map((density) => (
                <button key={density} onClick={() => updatePreference('density', density)} className={`rounded px-3 py-1.5 font-mono text-[10px] capitalize ${preferences.density === density ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}>{density}</button>
              ))}
            </div>
          </div>
        </SettingSection>

        <SettingSection id="developer" title="Developer" description="CLI, API, editor, and project identifiers.">
          <div className="divide-y">
            <ResourceRow icon={KeyRound} title="Personal access and session token" meta="CLI and VS Code authentication" href="/dashboard/api-keys" action="Manage tokens" />
            <ResourceRow icon={Terminal} title="CLI quickstart" meta="dev-sync login · dev-sync init · dev-sync scan" href="/docs/user-guide" action="Open guide" />
            <ResourceRow icon={Laptop} title="VS Code configuration" meta="API URL, token, and project ID" href="/dashboard/api-keys" />
          </div>
          <div className="mt-5 rounded-md border bg-[#080c12] p-4 font-mono text-[10px] text-slate-400">
            <div><span className="text-cyan-400">$</span> dev-sync login</div>
            <div><span className="text-cyan-400">$</span> dev-sync projects list</div>
            <div><span className="text-cyan-400">$</span> dev-sync scan --check</div>
          </div>
        </SettingSection>

        <SettingSection id="integrations" title="Integrations" description="Connect source control and route change events to team tools.">
          <GitHubConnectionsManager />
          <div className="mt-6 border-t pt-5">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Team delivery integrations</div>
            {teams.length ? teams.map((team) => (
              <ResourceRow key={team.id} icon={PlugZap} title={team.name} meta={`Slack · Teams · webhooks · role:${team.role}`} href={`/dashboard/teams/${team.id}/settings`} />
            )) : <p className="text-xs text-muted-foreground">Create a team workspace to configure Slack, Teams, and generic webhooks.</p>}
          </div>
        </SettingSection>

        <SettingSection id="notifications" title="Notifications" description="Control the channels used for scan, migration, team, and system events.">
          <ToggleRow label="In-app notifications" description="Show real-time events in the dashboard notification center." checked={notifications.inAppEnabled} disabled={savingNotifications} onChange={(value) => updateNotifications({ inAppEnabled: value })} />
          <ToggleRow label="Email notifications" description="Send important migration and scan events to your account email." checked={notifications.emailEnabled} disabled={savingNotifications} onChange={(value) => updateNotifications({ emailEnabled: value })} />
          <ToggleRow label="Team digest" description="Receive a periodic summary of team database activity." checked={notifications.teamDigestEnabled} disabled={savingNotifications} onChange={(value) => updateNotifications({ teamDigestEnabled: value })} />
          {savingNotifications && <p className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Saving notification preferences</p>}
          {notificationError && <p className="mt-3 text-xs text-destructive">{notificationError}</p>}
        </SettingSection>

        <SettingSection id="migrations" title="Migration defaults" description="Safe defaults applied when starting new change workflows in this browser. Project policies remain authoritative.">
          <ToggleRow label="Require migration preview" description="Always generate and review SQL before execution." checked={preferences.requirePreview} onChange={(value) => updatePreference('requirePreview', value)} />
          <ToggleRow label="Generate rollback plan" description="Create reversal SQL alongside every proposed migration." checked={preferences.generateRollback} onChange={(value) => updatePreference('generateRollback', value)} />
          <ToggleRow label="Block destructive changes" description="Stop drops and lossy conversions until explicitly overridden." checked={preferences.blockDestructive} onChange={(value) => updatePreference('blockDestructive', value)} />
          <ToggleRow label="Require approval for production" description="Require an approval gate before production execution." checked={preferences.approvalRequired} onChange={(value) => updatePreference('approvalRequired', value)} />
          <div className="mt-5">
            <ResourceRow icon={Shield} title="Project change policies" meta="Thresholds, enforcement, environments, and approval rules" href={projects[0] ? `/dashboard/projects/${projects[0].id}` : '/dashboard/projects/new'} action={projects.length ? 'Configure' : 'Create project'} />
          </div>
        </SettingSection>

        <SettingSection id="environments" title="Environments" description="Database targets and preview providers are configured per project so credentials stay scoped.">
          {projects.length ? projects.slice(0, 8).map((project) => (
            <ResourceRow key={project.id} icon={Database} title={project.name} meta={`${project.schema_type} · development / staging / production`} href={`/dashboard/projects/${project.id}`} />
          )) : <ResourceRow icon={Database} title="Connect your first environment" meta="Create a project and add database targets" href="/dashboard/projects/new" action="Create project" />}
        </SettingSection>

        <SettingSection id="ai" title="AI & analysis" description="Control AI-assisted explanations. Provider credentials are managed by the deployment administrator.">
          <ToggleRow label="AI-assisted explanations" description="Generate structured explanations for drift and migration risk." checked={preferences.aiExplanations} onChange={(value) => updatePreference('aiExplanations', value)} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-xs">Explanation depth
              <select value={preferences.explanationDepth} onChange={(event) => updatePreference('explanationDepth', event.target.value as LocalPreferences['explanationDepth'])} className="block h-9 w-full rounded-md border bg-background px-3 font-mono text-xs">
                <option value="concise">Concise</option><option value="detailed">Detailed</option>
              </select>
            </label>
            <div className="rounded-md border bg-background p-3">
              <div className="flex items-center gap-2 text-xs"><Bot className="h-4 w-4 text-primary" /> Provider status</div>
              <div className="mt-2 font-mono text-[10px] text-muted-foreground">Server-managed · structured output enabled</div>
            </div>
          </div>
        </SettingSection>

        <SettingSection id="security" title="Security" description="Authentication, active session details, enterprise access, and audit controls.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border bg-background p-4"><div className="flex items-center gap-2 text-xs"><LockKeyhole className="h-4 w-4 text-emerald-400" /> Current session</div><div className="mt-3 font-mono text-[10px] text-muted-foreground">Last sign-in: {lastSignInAt ? new Date(lastSignInAt).toLocaleString() : 'Unavailable'}</div></div>
            <div className="rounded-md border bg-background p-4"><div className="flex items-center gap-2 text-xs"><UserRound className="h-4 w-4 text-primary" /> Account age</div><div className="mt-3 font-mono text-[10px] text-muted-foreground">Created: {createdAt ? new Date(createdAt).toLocaleDateString() : 'Unavailable'}</div></div>
          </div>
          <div className="mt-5 divide-y">
            <ResourceRow icon={KeyRound} title="Authentication tokens" meta="Inspect the current CLI and editor credential" href="/dashboard/api-keys" />
            {teams.map((team) => <ResourceRow key={team.id} icon={Shield} title={`${team.name} enterprise controls`} meta="SSO · SCIM · audit export · retention" href={`/dashboard/teams/${team.id}/settings`} />)}
          </div>
        </SettingSection>

        <SettingSection id="billing" title="Billing & usage" description="Plans and limits are owned by team workspaces.">
          {teams.length ? teams.map((team) => (
            <ResourceRow key={team.id} icon={CircleDollarSign} title={team.name} meta={`Plan, usage, invoices, and member limits · role:${team.role}`} href={`/dashboard/teams/${team.id}/settings`} action="Open billing" />
          )) : <p className="text-xs text-muted-foreground">Personal workspaces use the free plan. Create a team to manage shared billing and higher limits.</p>}
        </SettingSection>

        <SettingSection id="danger" title="Danger zone" description="Actions here affect access or data and may not be reversible.">
          <div className="divide-y rounded-md border border-destructive/30">
            <div className="flex items-center justify-between gap-4 p-4"><div><div className="text-xs font-medium">Disconnect external access</div><div className="mt-1 text-[11px] text-muted-foreground">Manage GitHub installations and API credentials.</div></div><Link href="#integrations" className="rounded border px-3 py-2 text-[10px]">Review access</Link></div>
            <div className="flex items-center justify-between gap-4 p-4"><div><div className="text-xs font-medium">Delete projects or teams</div><div className="mt-1 text-[11px] text-muted-foreground">Deletion is available from each resource with typed confirmation.</div></div><Link href="/dashboard" className="rounded border border-destructive/30 px-3 py-2 text-[10px] text-destructive">Manage resources</Link></div>
          </div>
        </SettingSection>

        <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-lg border bg-background/95 px-4 py-3 shadow-xl backdrop-blur">
          <div className="text-[10px] text-muted-foreground">{localSaved ? <span className="flex items-center gap-1.5 text-emerald-400"><Check className="h-3 w-3" /> Browser defaults saved</span> : 'Unsaved browser defaults may be pending'}</div>
          <Button size="sm" onClick={saveLocalPreferences} className="h-8 font-mono text-[10px]"><Save className="mr-2 h-3.5 w-3.5" /> Save defaults</Button>
        </div>
      </div>
    </div>
  );
}
