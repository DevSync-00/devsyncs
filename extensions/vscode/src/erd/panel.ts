import * as vscode from 'vscode'

import type { NormalizedSchema } from './schema/types'
import type { LayoutState } from './schema/types'
import type { SchemaDiff } from './diff/types'
import { diffSchemas } from './diff/compare'
import type { FromWebviewMessage, ToWebviewMessage } from './messages'
import { listSnapshots, loadSnapshot as loadSnapshotFile, saveSnapshotLayout } from './snapshots/store'

export class ErdPanel {
  public static readonly viewType = 'devsync.erd'
  public static currentPanel: ErdPanel | undefined

  private readonly panel: vscode.WebviewPanel
  private readonly disposables: vscode.Disposable[] = []
  private readonly workspaceRoot?: string

  public static createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One

    if (ErdPanel.currentPanel) {
      ErdPanel.currentPanel.panel.reveal(column)
      ErdPanel.currentPanel.loadLatest()
      return
    }

    const panel = vscode.window.createWebviewPanel(
      ErdPanel.viewType,
      'DevSync ER Diagram',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    )

    ErdPanel.currentPanel = new ErdPanel(panel, context)
  }

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this.panel = panel
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables)
    this.panel.webview.onDidReceiveMessage(
      async (message: FromWebviewMessage) => {
        if (message.type === 'ready') {
          this.loadLatest()
        } else if (message.type === 'requestLatest') {
          this.loadLatest()
        } else if (message.type === 'requestSnapshot') {
          await this.loadSnapshotById(message.id)
        } else if (message.type === 'saveLayout') {
          if (message.snapshotId && message.layout) {
            void saveSnapshotLayout(message.snapshotId, message.layout, this.workspaceRoot ?? process.cwd())
          }
        }
      },
      null,
      this.disposables,
    )

    this.panel.webview.html = this.getHtml(this.panel.webview, context)
    this.loadLatest()
  }

  private async loadLatest() {
    const baseDir = this.workspaceRoot ?? process.cwd()
    const manifest = await listSnapshots(baseDir)
    
    // Send snapshot list to webview
    this.postMessage({ type: 'snapshotList', snapshots: manifest })
    
    const latest = manifest[0]
    if (!latest) {
      this.postMessage({ type: 'status', message: 'No snapshots found. Run a scan to generate schema snapshots.' })
      return
    }

    await this.loadSnapshotById(latest.id)
  }

  private async loadSnapshotById(id: string) {
    const baseDir = this.workspaceRoot ?? process.cwd()
    const manifest = await listSnapshots(baseDir)
    const snapshot = await loadSnapshotFile(id, baseDir)
    if (!snapshot) {
      this.postMessage({ type: 'status', message: 'Failed to load snapshot.' })
      return
    }

    // Find current snapshot index and compute diff vs previous
    const currentIdx = manifest.findIndex((s) => s.id === id)
    let diff: SchemaDiff[] = []
    if (currentIdx >= 0 && currentIdx < manifest.length - 1) {
      const previous = manifest[currentIdx + 1]
      const prevSnapshot = await loadSnapshotFile(previous.id, baseDir)
      if (prevSnapshot) {
        diff = diffSchemas(prevSnapshot.schema as NormalizedSchema, snapshot.schema as NormalizedSchema)
      }
    }

    this.postMessage({
      type: 'loadSnapshot',
      schema: snapshot.schema as NormalizedSchema,
      layout: snapshot.layout as LayoutState | undefined,
      diff,
      meta: {
        id: snapshot.meta.id,
        createdAt: snapshot.meta.createdAt,
        note: snapshot.meta.note,
      },
    })
  }

  public async refresh() {
    await this.loadLatest()
  }

  private postMessage(message: ToWebviewMessage) {
    this.panel.webview.postMessage(message)
  }

  private dispose() {
    ErdPanel.currentPanel = undefined
    while (this.disposables.length) {
      const d = this.disposables.pop()
      if (d) {
        d.dispose()
      }
    }
  }

  private getHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    const nonce = getNonce()
    const cspSource = webview.cspSource
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'out', 'erd', 'erd-webview.js'),
    )

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>
    `
  }
}

const getNonce = () => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let text = ''
  for (let i = 0; i < 16; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

