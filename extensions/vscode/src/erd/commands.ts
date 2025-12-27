import * as vscode from 'vscode'
import { runExtraction } from './runExtraction'
import { saveSnapshot } from './snapshots/store'
import type { NormalizedSchema } from './schema/types'

/**
 * Capture a schema snapshot from the active editor's content.
 * Supports ChartDB smart-query JSON, Liam schema JSON, or DBML.
 */
export async function captureSchemaSnapshot(
  workspaceRoot?: string,
): Promise<void> {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    vscode.window.showErrorMessage('No active editor. Open a schema file first.')
    return
  }

  const content = editor.document.getText()
  if (!content.trim()) {
    vscode.window.showErrorMessage('Editor is empty.')
    return
  }

  try {
    // Try to parse as JSON first (for smart-query or Liam schema)
    let input: unknown = content
    try {
      input = JSON.parse(content)
    } catch {
      // Not JSON, treat as string (DBML, SQL, etc.)
      input = content
    }

    const result = await runExtraction(input)
    if (result.warnings && result.warnings.length > 0) {
      vscode.window.showWarningMessage(
        `Schema extracted with warnings: ${result.warnings.join('; ')}`,
      )
    }

    const baseDir = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!baseDir) {
      vscode.window.showErrorMessage('No workspace folder found.')
      return
    }

    const meta = await saveSnapshot({
      schema: result.schema as NormalizedSchema,
      layout: undefined,
      source: editor.document.fileName,
      note: `Captured from ${editor.document.fileName}`,
      baseDir,
    })

    vscode.window.showInformationMessage(
      `Schema snapshot saved: ${meta.id}. Run "DevSync: Open ERD" to view it.`,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    vscode.window.showErrorMessage(`Failed to capture schema: ${message}`)
  }
}

/**
 * Attempt to capture schema from database connection.
 * This would require executing a smart-query SQL script against the database.
 * For now, this is a placeholder that shows instructions.
 */
export async function captureSchemaFromDatabase(
  _workspaceRoot?: string,
): Promise<void> {
  const action = await vscode.window.showInformationMessage(
    'Database schema capture requires running a smart-query SQL script. ' +
      'Would you like to see instructions?',
    'Show Instructions',
    'Cancel',
  )

  if (action === 'Show Instructions') {
    const doc = await vscode.workspace.openTextDocument({
      content: `# Database Schema Capture Instructions

## For PostgreSQL/Supabase/TimescaleDB

1. Run the smart-query SQL script from ChartDB in your database
2. Copy the JSON output
3. Paste it into a new file (e.g., schema.json)
4. Run "DevSync: Capture Schema Snapshot" command

## Smart Query Scripts

Visit https://chartdb.io to get the smart-query script for your database type:
- PostgreSQL
- MySQL/MariaDB
- SQL Server
- SQLite
- CockroachDB
- ClickHouse

## Alternative: Use Migration Files

If you have migration files (e.g., Prisma migrations, Rails schema.rb), you can:
1. Open the migration/schema file
2. Run "DevSync: Capture Schema Snapshot"
`,
      language: 'markdown',
    })
    await vscode.window.showTextDocument(doc)
  }
}

/**
 * Register all ERD-related commands with VS Code.
 */
export function registerErdCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('devsync.captureSchemaSnapshot', () =>
      captureSchemaSnapshot(),
    ),
    vscode.commands.registerCommand('devsync.captureSchemaFromDatabase', () =>
      captureSchemaFromDatabase(),
    ),
  )
}
