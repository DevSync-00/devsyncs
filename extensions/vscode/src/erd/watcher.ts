import * as vscode from 'vscode'
import * as path from 'node:path'
import { listSnapshots, loadSnapshot as loadSnapshotFile } from './snapshots/store'
import { ErdPanel } from './panel'

/**
 * Watch for new ERD snapshots created by CLI scans and auto-refresh the ERD panel.
 */
export class ErdSnapshotWatcher {
  private watcher: vscode.FileSystemWatcher | undefined
  private disposables: vscode.Disposable[] = []
  private lastKnownSnapshotId: string | undefined
  private readonly DEBUG = true // Set to false to disable debug logging

  constructor(private workspaceRoot: string) {
    this.debugLog(`[ERD Watcher] Initializing for workspace: ${this.workspaceRoot}`)
    this.initializeLastKnownSnapshot()
    this.setupWatcher()
  }

  private debugLog(message: string, ...args: any[]) {
    if (this.DEBUG) {
      console.log(`[ERD Watcher] ${message}`, ...args)
    }
  }

  private async initializeLastKnownSnapshot() {
    try {
      const manifestPath = path.join(this.workspaceRoot, '.devsync', 'schemas', 'manifest.json')
      this.debugLog(`[ERD Watcher] Initializing - checking manifest: ${manifestPath}`)
      
      const snapshots = await listSnapshots(this.workspaceRoot)
      this.debugLog(`[ERD Watcher] Found ${snapshots.length} existing snapshot(s)`)
      
      if (snapshots.length > 0) {
        this.lastKnownSnapshotId = snapshots[0].id
        this.debugLog(`[ERD Watcher] Last known snapshot ID: ${this.lastKnownSnapshotId}`)
        snapshots.forEach((s, i) => {
          this.debugLog(`  [${i}] ${s.id} - ${s.createdAt} - ${s.note || 'no note'}`)
        })
      } else {
        this.debugLog(`[ERD Watcher] No existing snapshots found`)
      }
    } catch (error) {
      this.debugLog(`[ERD Watcher] Error during initialization:`, error)
      console.error('[ERD Watcher] Failed to initialize last known snapshot:', error)
    }
  }

  private setupWatcher() {
    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(this.workspaceRoot))
      if (!workspaceFolder) {
        this.debugLog(`[ERD Watcher] WARNING: No workspace folder found for ${this.workspaceRoot}`)
        return
      }

      const manifestPattern = new vscode.RelativePattern(
        workspaceFolder,
        '.devsync/schemas/manifest.json'
      )
      const manifestPath = path.join(this.workspaceRoot, '.devsync', 'schemas', 'manifest.json')
      
      this.debugLog(`[ERD Watcher] Setting up file watcher for: ${manifestPath}`)

      // Watch manifest file for changes
      this.watcher = vscode.workspace.createFileSystemWatcher(manifestPattern)
      
      this.watcher.onDidChange(async (uri) => {
        this.debugLog(`[ERD Watcher] Manifest file changed: ${uri.fsPath}`)
        // Debounce: wait a bit for file write to complete
        await new Promise(resolve => setTimeout(resolve, 500))
        await this.handleManifestChange('changed')
      })

      this.watcher.onDidCreate(async (uri) => {
        this.debugLog(`[ERD Watcher] Manifest file created: ${uri.fsPath}`)
        await new Promise(resolve => setTimeout(resolve, 500))
        await this.handleManifestChange('created')
      })

      this.watcher.onDidDelete(async (uri) => {
        this.debugLog(`[ERD Watcher] Manifest file deleted: ${uri.fsPath}`)
        this.lastKnownSnapshotId = undefined
      })

      this.disposables.push(this.watcher)
      this.debugLog(`[ERD Watcher] File watcher successfully set up`)
    } catch (error) {
      this.debugLog(`[ERD Watcher] ERROR setting up watcher:`, error)
      console.error('[ERD Watcher] Failed to setup file watcher:', error)
    }
  }

  private async handleManifestChange(event: 'changed' | 'created' = 'changed') {
    try {
      this.debugLog(`[ERD Watcher] Handling manifest change event: ${event}`)
      
      const snapshots = await listSnapshots(this.workspaceRoot)
      this.debugLog(`[ERD Watcher] Current snapshot count: ${snapshots.length}`)
      
      if (snapshots.length === 0) {
        this.debugLog(`[ERD Watcher] No snapshots found, skipping`)
        return
      }

      const latest = snapshots[0]
      this.debugLog(`[ERD Watcher] Latest snapshot: ID=${latest.id}, CreatedAt=${latest.createdAt}, Note=${latest.note || 'none'}, Source=${latest.source || 'none'}`)
      this.debugLog(`[ERD Watcher] Last known snapshot ID: ${this.lastKnownSnapshotId || 'none'}`)
      
      // Check if this is a new snapshot (different from last known)
      const isNewSnapshot = this.lastKnownSnapshotId !== latest.id
      this.debugLog(`[ERD Watcher] Is new snapshot: ${isNewSnapshot}`)
      
      if (!isNewSnapshot) {
        this.debugLog(`[ERD Watcher] Snapshot unchanged, skipping notification`)
        return
      }

      // Update last known snapshot ID
      const previousId = this.lastKnownSnapshotId
      this.lastKnownSnapshotId = latest.id
      this.debugLog(`[ERD Watcher] Updated last known snapshot: ${previousId || 'none'} -> ${latest.id}`)

      const snapshot = await loadSnapshotFile(latest.id, this.workspaceRoot)
      if (!snapshot) {
        this.debugLog(`[ERD Watcher] WARNING: Failed to load snapshot file for ID: ${latest.id}`)
        return
      }

      const tableCount = Array.isArray(snapshot.schema?.tables) ? snapshot.schema.tables.length : 0
      const relationshipCount = Array.isArray(snapshot.schema?.relationships) ? snapshot.schema.relationships.length : 0
      this.debugLog(`[ERD Watcher] Snapshot loaded successfully. Tables: ${tableCount}, Relationships: ${relationshipCount}`)

      // Determine source type for better messaging
      const source = snapshot.meta.source || snapshot.meta.note || 'unknown'
      const isCliSnapshot = source.toLowerCase().includes('cli') || 
                           source.toLowerCase().includes('scan') ||
                           snapshot.meta.note?.toLowerCase().includes('cli')
      
      this.debugLog(`[ERD Watcher] Source: "${source}", Is CLI snapshot: ${isCliSnapshot}`)
      
      // Check if ERD panel is open
      const panelOpen = !!ErdPanel.currentPanel
      this.debugLog(`[ERD Watcher] ERD panel is ${panelOpen ? 'open' : 'closed'}`)
      
      if (ErdPanel.currentPanel) {
        // Refresh the panel to load latest snapshot
        this.debugLog(`[ERD Watcher] Refreshing ERD panel`)
        await ErdPanel.currentPanel.refresh()
        
        const message = isCliSnapshot 
          ? `📊 New ERD snapshot detected from CLI scan. ERD panel refreshed.`
          : `📊 New ERD snapshot detected. ERD panel refreshed.`
        
        this.debugLog(`[ERD Watcher] Showing notification: "${message}"`)
        vscode.window.showInformationMessage(message, 'View ERD')
          .then(selection => {
            if (selection === 'View ERD') {
              this.debugLog(`[ERD Watcher] User clicked "View ERD"`)
              vscode.commands.executeCommand('devsync.openERD')
            }
          })
      } else {
        // Panel not open, offer to open it
        const message = isCliSnapshot
          ? `📊 New ERD snapshot detected from CLI scan.`
          : `📊 New ERD snapshot detected.`
        
        this.debugLog(`[ERD Watcher] Showing notification to open ERD: "${message}"`)
        vscode.window.showInformationMessage(message, 'Open ERD')
          .then(selection => {
            if (selection === 'Open ERD') {
              this.debugLog(`[ERD Watcher] User clicked "Open ERD"`)
              vscode.commands.executeCommand('devsync.openERD')
            }
          })
      }
      
      this.debugLog(`[ERD Watcher] Successfully handled manifest change`)
    } catch (error) {
      this.debugLog(`[ERD Watcher] ERROR handling manifest change:`, error)
      console.error('[ERD Watcher] Failed to handle manifest change:', error)
      
      // Also log to output channel for better visibility
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      this.debugLog(`[ERD Watcher] Error details - Message: ${errorMessage}`, errorStack ? `Stack: ${errorStack}` : '')
    }
  }

  public dispose() {
    this.debugLog(`[ERD Watcher] Disposing watcher`)
    this.disposables.forEach(d => d.dispose())
    this.watcher?.dispose()
    this.lastKnownSnapshotId = undefined
  }
}

