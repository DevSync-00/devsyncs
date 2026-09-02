import type { AppState } from '../state';
import type { AuthSessionState } from '../types';

export type CockpitView = 'overview' | 'projects' | 'scans' | 'environments' | 'visualizer' | 'teams' | 'analytics' | 'apiKeys' | 'documentation' | 'settings' | 'project' | 'home' | 'drift' | 'migrations' | 'assistant' | 'security';

export interface DashboardSnapshot {
  user: { id: string; email: string; fullName: string };
  projects: Array<{ id: string; name: string; slug?: string; schema_type?: string; created_at?: string; updated_at?: string; team_id?: string | null; config?: unknown }>;
  scans: Array<{ id: string; project_id: string; status: string; mismatches?: unknown[]; created_at: string; completed_at?: string | null }>;
  environments: Array<{ id: string; project_id: string; name: string; slug?: string; tier?: string; position?: number; protected?: boolean; requires_approval?: boolean }>;
  teams: Array<{ id: string; name: string; slug?: string; role: string; created_at?: string }>;
  notifications: Array<{ id: string; type?: string; title: string; message?: string; read: boolean; created_at: string; metadata?: unknown }>;
  analytics: { projectCount: number; scanCount: number; mismatchTotal: number; healthyScans: number };
  projectDetail?: {
    project: Record<string, unknown>; scans: Array<Record<string, unknown>>; policies: Array<Record<string, unknown>>;
    promotions: Array<Record<string, unknown>>; migrations: Array<Record<string, unknown>>; rehearsals: Array<Record<string, unknown>>;
    approvals: Array<Record<string, unknown>>; githubReviews: Array<Record<string, unknown>>; comments: Array<Record<string, unknown>>; activity: Array<Record<string, unknown>>;
  } | null;
  capabilities: Record<string, boolean>;
}

export interface CockpitSnapshot {
  state: AppState;
  session: AuthSessionState;
  project: { id: string; name?: string } | null;
  workspace: { name: string; configured: boolean } | null;
  queue: { isPaused: boolean; queueLength: number; runningTask: string | null };
  security: { readOnly: boolean; credentialsMasked: boolean; auditEntries: AuditEntry[] };
  dashboard: { status: 'idle' | 'loading' | 'ready' | 'error'; data?: DashboardSnapshot; error?: string };
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  outcome: 'success' | 'warning' | 'failure';
  detail?: string;
}

export type HostToWebview =
  | { type: 'host.ready'; payload: CockpitSnapshot }
  | { type: 'state.update'; payload: CockpitSnapshot }
  | { type: 'scan.progress'; payload: { percent: number; table?: string; message?: string } }
  | { type: 'chat.token'; payload: { messageId: string; delta: string } }
  | { type: 'navigation.open'; payload: { view: CockpitView; contextId?: string } }
  | { type: 'operation.error'; payload: { operation: string; message: string } };

export type WebviewToHost =
  | { type: 'webview.ready' }
  | { type: 'navigation.changed'; payload: { view: CockpitView } }
  | { type: 'scan.run'; payload: { local?: boolean } }
  | { type: 'fix.preview'; payload: { mismatchIndex: number } }
  | { type: 'fix.apply'; payload: { mismatchIndex: number; confirm: true } }
  | { type: 'promotion.action'; payload: { action: 'plan' | 'policies' | 'request' | 'monitor' | 'approve' | 'execute' | 'cancel' } }
  | { type: 'chat.open' }
  | { type: 'command.run'; payload: { command: CockpitCommand } }
  | { type: 'dashboard.refresh' }
  | { type: 'dashboard.mutate'; payload: { action: 'team.create' | 'profile.update' | 'notification.readAll'; values?: Record<string, string> } };

export type CockpitCommand =
  | 'devsync.onboarding.start' | 'devsync.selectProject' | 'devsync.createProject'
  | 'devsync.openERD' | 'devsync.captureSchemaSnapshot' | 'devsync.generateMigration'
  | 'devsync.showMigrationHistory' | 'devsync.batchApplyFixes' | 'devsync.viewReport'
  | 'devsync.sidebar.openConfig' | 'workbench.action.openSettings' | 'devsync.chat.login'
  | 'devsync.chat.logout' | 'devsync.openDashboard' | 'devsync.queue.pause' | 'devsync.queue.resume';

export function isWebviewMessage(value: unknown): value is WebviewToHost {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && WEBVIEW_MESSAGE_TYPES.has(type);
}

const WEBVIEW_MESSAGE_TYPES = new Set([
  'webview.ready', 'navigation.changed', 'scan.run', 'fix.preview', 'fix.apply',
  'promotion.action', 'chat.open', 'command.run', 'dashboard.refresh', 'dashboard.mutate',
]);
