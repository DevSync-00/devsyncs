import * as vscode from 'vscode';
import type { IApiClient, IAuthManager, ICommands, IStateStore } from '../interfaces';
import type { CockpitSnapshot, CockpitView, DashboardSnapshot, HostToWebview, WebviewToHost } from '../shared/protocol';
import { isWebviewMessage } from '../shared/protocol';

export class DevSyncPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = 'devsyncCockpit';
  private view?: vscode.WebviewView;
  private selectedView: CockpitView = 'overview';
  private dashboard: CockpitSnapshot['dashboard'] = { status: 'idle' };
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly stateStore: IStateStore,
    private readonly authManager: IAuthManager,
    private readonly commands: ICommands,
    private readonly apiClient: IApiClient,
  ) {
    this.disposables.push(
      stateStore.subscribe(() => this.publishSnapshot()),
      authManager.onDidChangeSession(() => { this.publishSnapshot(); void this.loadDashboard(); }),
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('devsync')) this.publishSnapshot();
      }),
      vscode.commands.registerCommand('devsync.cockpit.open', (view: CockpitView = 'overview', contextId?: string) => this.open(view, contextId)),
    );
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview')],
    };
    view.webview.html = this.html(view.webview);
    this.disposables.push(view.webview.onDidReceiveMessage(message => this.handleMessage(message)));
    view.onDidDispose(() => { if (this.view === view) this.view = undefined; });
  }

  async open(view: CockpitView, contextId?: string): Promise<void> {
    this.selectedView = view;
    await vscode.commands.executeCommand(`${DevSyncPanelProvider.viewType}.focus`);
    this.post({ type: 'navigation.open', payload: { view, contextId } });
  }

  private async handleMessage(raw: unknown): Promise<void> {
    if (!isWebviewMessage(raw)) return;
    const message: WebviewToHost = raw;
    try {
      switch (message.type) {
        case 'webview.ready': this.publishSnapshot(true); void this.loadDashboard(); return;
        case 'navigation.changed': this.selectedView = message.payload.view; return;
        case 'scan.run': await vscode.commands.executeCommand(message.payload.local ? 'devsync.scanLocal' : 'devsync.scan'); return;
        case 'fix.preview': await this.runMismatchCommand('devsync.previewFix', message.payload.mismatchIndex); return;
        case 'fix.apply': await this.runMismatchCommand('devsync.applyFix', message.payload.mismatchIndex); return;
        case 'chat.open': await vscode.commands.executeCommand('devsync.chat.focus'); return;
        case 'dashboard.refresh': await this.loadDashboard(true); return;
        case 'dashboard.mutate': await this.mutateDashboard(message.payload.action, message.payload.values || {}); return;
        case 'command.run':
          if (message.payload.command === 'workbench.action.openSettings') {
            await vscode.commands.executeCommand(message.payload.command, 'devsync');
          } else await vscode.commands.executeCommand(message.payload.command);
          return;
        case 'promotion.action':
          await vscode.commands.executeCommand(`devsync.platform.${({ plan: 'showPlan', policies: 'showPolicies', request: 'promotions', monitor: 'monitorPromotion', approve: 'approvePromotion', execute: 'executePromotion', cancel: 'cancelPromotion' } as const)[message.payload.action]}`);
          return;
      }
    } catch (error) {
      this.post({ type: 'operation.error', payload: { operation: message.type, message: error instanceof Error ? error.message : String(error) } });
    }
  }

  private async runMismatchCommand(command: string, index: number): Promise<void> {
    const mismatch = this.stateStore.getState().scan.lastScanReport?.mismatches[index];
    if (!mismatch) throw new Error('That mismatch is no longer available. Run a fresh scan.');
    await vscode.commands.executeCommand(command, mismatch);
  }

  private snapshot(): CockpitSnapshot {
    const configuration = vscode.workspace.getConfiguration('devsync');
    const projectId = configuration.get<string>('projectId', '').trim();
    const folder = vscode.workspace.workspaceFolders?.[0];
    return {
      state: this.stateStore.getState(),
      session: this.authManager.getSession(),
      project: projectId ? { id: projectId, name: this.context.workspaceState.get<string>('devsync.selectedProjectName') } : null,
      workspace: folder ? { name: folder.name, configured: Boolean(projectId || configuration.get<string>('databaseConnection', '').trim()) } : null,
      queue: this.commands.getQueueStatus(),
      security: { readOnly: true, credentialsMasked: true, auditEntries: [] },
      dashboard: this.dashboard,
    };
  }

  private publishSnapshot(initial = false): void {
    this.post({ type: initial ? 'host.ready' : 'state.update', payload: this.snapshot() });
  }

  private async loadDashboard(force = false): Promise<void> {
    if (!force && (this.dashboard.status === 'loading' || this.dashboard.status === 'ready')) return;
    if (this.authManager.getSession().status !== 'authenticated') {
      this.dashboard = { status: 'idle' };
      this.publishSnapshot();
      return;
    }
    this.dashboard = { ...this.dashboard, status: 'loading', error: undefined };
    this.publishSnapshot();
    try {
      const projectId = vscode.workspace.getConfiguration('devsync').get<string>('projectId', '').trim();
      const path = `/api/extension/dashboard${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`;
      const data = await this.apiClient.dashboardRequest<DashboardSnapshot>(path);
      this.dashboard = { status: 'ready', data };
    } catch (error) {
      this.dashboard = { status: 'error', error: error instanceof Error ? error.message : String(error) };
    }
    this.publishSnapshot();
  }

  private async mutateDashboard(action: 'team.create' | 'profile.update' | 'notification.readAll', values: Record<string, string>): Promise<void> {
    const payload = action === 'team.create'
      ? { action, name: values.name, slug: values.slug || undefined }
      : action === 'profile.update'
        ? { action, fullName: values.fullName }
        : { action };
    await this.apiClient.dashboardRequest('/api/extension/dashboard', 'POST', payload);
    this.dashboard = { status: 'idle' };
    await this.loadDashboard(true);
  }

  private post(message: HostToWebview): void { void this.view?.webview.postMessage(message); }

  private html(webview: vscode.Webview): string {
    const nonce = Array.from({ length: 32 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('');
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'cockpit.js'));
    return `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"></head><body><div id="root"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
  }

  dispose(): void { this.disposables.splice(0).forEach(item => item.dispose()); }
}
