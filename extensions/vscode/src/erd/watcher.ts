import * as vscode from 'vscode'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import { listSnapshots, loadSnapshot as loadSnapshotFile } from './snapshots/store'
import { ErdPanel } from './panel'

/**
 * Watch for new ERD snapshots created by CLI scans and auto-refresh the ERD panel.
 */
export class ErdSnapshotWatcher {
  private watcher: vscode.FileSystemWatcher | undefined
  private disposables: vscode.Disposable[] = []

  constructor(private workspaceRoot: string) {
    this.setupWatcher()
  }

  private setupWatcher() {
    const manifestPath = path.join(this.workspaceRoot, '.devsync', 'schemas', 'manifest.json')
    const manifestPattern = new vscode.RelativePattern(
      vscode.workspace.getWorkspaceFolder(vscode.Uri.file(this.workspaceRoot))!,
      '.devsync/schemas/manifest.json'
    )

    // Watch manifest file for changes
    this.watcher = vscode.workspace.createFileSystemWatcher(manifestPattern)
    
    this.watcher.onDidChange(async () => {
      // Debounce: wait a bit for file write to complete
      await new Promise(resolve => setTimeout(resolve, 500))
      await this.handleManifestChange()
    })

    this.watcher.onDidCreate(async () => {
      await new Promise(resolve => setTimeout(resolve, 500))
      await this.handleManifestChange()
    })

    this.disposables.push(this.watcher)
  }

  private async handleManifestChange() {
    try {
      const snapshots = await listSnapshots(this.workspaceRoot)
      if (snapshots.length === 0) return

      const latest = snapshots[0]
      const snapshot = await loadSnapshotFile(latest.id, this.workspaceRoot)
      
      // Check if this is a CLI-generated snapshot
      const isCliSnapshot = snapshot?.meta.source?.includes('CLI scan')
      
      // Check if ERD panel is open
      if (ErdPanel.currentPanel) {
        // Refresh the panel to load latest snapshot
        await ErdPanel.currentPanel.refresh()
        
        if (isCliSnapshot) {
          vscode.window.showInformationMessage(
            `📊 New ERD snapshot detected from CLI scan. ERD panel refreshed.`,
            'View ERD'
          ).then(selection => {
            if (selection === 'View ERD') {
              vscode.commands.executeCommand('devsync.openERD')
            }
          })
        }
      } else if (isCliSnapshot) {
        // Panel not open, offer to open it
        vscode.window.showInformationMessage(
          `📊 New ERD snapshot detected from CLI scan.`,
          'Open ERD'
        ).then(selection => {
          if (selection === 'Open ERD') {
            vscode.commands.executeCommand('devsync.openERD')
          }
        })
      }
    } catch (error) {
      // Silently fail - don't interrupt user workflow
      console.error('Failed to handle manifest change:', error)
    }
  }

  public dispose() {
    this.disposables.forEach(d => d.dispose())
    this.watcher?.dispose()
  }
}

