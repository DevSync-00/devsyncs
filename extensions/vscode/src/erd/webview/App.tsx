import React, { useEffect, useState } from 'react'
import type { SchemaDiff } from '../diff/types'
import type { LayoutState, NormalizedSchema, Table } from '../schema/types'
import type { SnapshotMeta } from '../snapshots/store'
import { GraphRenderer } from './GraphRenderer'
import { TableDetailModal } from './TableDetailModal'
import { TimelineView } from './TimelineView'

type LoadMessage = {
  type: 'loadSnapshot'
  schema: NormalizedSchema
  diff?: SchemaDiff[]
  layout?: LayoutState
  meta?: { id: string; createdAt: string; note?: string }
}

type StatusMessage = {
  type: 'status'
  message: string
}

type SnapshotListMessage = {
  type: 'snapshotList'
  snapshots: SnapshotMeta[]
}

declare function acquireVsCodeApi(): {
  postMessage: (data: unknown) => void
}

const vscode = acquireVsCodeApi()

export const App: React.FC = () => {
  const [status, setStatus] = useState<string>('Loading snapshot...')
  const [schema, setSchema] = useState<NormalizedSchema | null>(null)
  const [diff, setDiff] = useState<SchemaDiff[]>([])
  const [meta, setMeta] = useState<{ id: string; createdAt: string; note?: string } | null>(null)
  const [layout, setLayout] = useState<LayoutState | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [showTimeline, setShowTimeline] = useState(false)

  useEffect(() => {
    const handler = (event: MessageEvent<LoadMessage | StatusMessage | SnapshotListMessage>) => {
      const msg = event.data
      if (!msg) return
      if (msg.type === 'status') {
        setStatus(msg.message)
      } else if (msg.type === 'loadSnapshot') {
        setStatus('')
        setSchema(msg.schema)
        setDiff(msg.diff ?? [])
        setMeta(msg.meta ?? null)
        setLayout(msg.layout)
      } else if (msg.type === 'snapshotList') {
        setSnapshots(msg.snapshots)
      }
    }
    window.addEventListener('message', handler)
    vscode.postMessage({ type: 'ready' })
    return () => window.removeEventListener('message', handler)
  }, [])

  if (!schema) {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ opacity: 0.7 }}>{status || 'No schema loaded.'}</div>
      </div>
    )
  }

  const tables = schema.tables || []
  const rels = schema.relationships || []
  const enums = schema.enums || []
  const exts = schema.extensions || []
  const add = diff.filter((d) => d.action === 'add').length
  const remove = diff.filter((d) => d.action === 'remove').length
  const change = diff.filter((d) => d.action === 'change').length

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: 'var(--vscode-font-family)',
      }}
    >
      {/* Header with stats */}
      <div
        style={{
          borderBottom: '1px solid var(--vscode-editorWidget-border)',
          padding: 12,
          background: 'var(--vscode-editorWidget-background)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <strong>Snapshot:</strong> {meta?.id ?? 'n/a'}{' '}
            <span style={{ opacity: 0.7 }}>{meta?.createdAt ?? ''}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '4px 8px',
                border: '1px solid var(--vscode-input-border)',
                background: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                borderRadius: 4,
                fontSize: 12,
                width: 200,
              }}
            />
            <button
              onClick={() => setShowTimeline(true)}
              style={{
                padding: '4px 8px',
                background: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
              title="View timeline"
            >
              Timeline
            </button>
            <button
              onClick={() => {
                const svg = document.querySelector('svg')
                if (svg) {
                  const svgData = new XMLSerializer().serializeToString(svg)
                  const blob = new Blob([svgData], { type: 'image/svg+xml' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `schema-${meta?.id || 'export'}.svg`
                  link.click()
                  URL.revokeObjectURL(url)
                }
              }}
              style={{
                padding: '4px 8px',
                background: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
              title="Export as SVG"
            >
              Export SVG
            </button>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 8,
          }}
        >
          <Badge label="Tables" value={tables.length} />
          <Badge label="Relationships" value={rels.length} />
          <Badge label="Enums" value={enums.length} />
          <Badge label="Extensions" value={exts.length} />
          {add > 0 && <Badge label="Diff +" value={add} color="#4ade80" />}
          {remove > 0 && <Badge label="Diff -" value={remove} color="#f87171" />}
          {change > 0 && <Badge label="Diff ~" value={change} color="#fbbf24" />}
        </div>
      </div>

      {/* Graph canvas */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <GraphRenderer
          schema={schema}
          diffs={diff}
          width={window.innerWidth}
          height={window.innerHeight - 150}
          searchQuery={searchQuery}
          layout={layout}
          onTableClick={setSelectedTable}
          onLayoutChange={(newLayout) => {
            setLayout(newLayout)
            if (meta?.id) {
              vscode.postMessage({
                type: 'saveLayout',
                layout: newLayout,
                snapshotId: meta.id,
              })
            }
          }}
        />
      </div>

      {/* Table detail modal */}
      <TableDetailModal
        table={selectedTable}
        diffs={diff}
        onClose={() => setSelectedTable(null)}
      />

      {/* Timeline view */}
      {showTimeline && (
        <TimelineView
          snapshots={snapshots}
          currentId={meta?.id ?? null}
          onSelect={(id) => {
            vscode.postMessage({ type: 'requestSnapshot', id })
          }}
          onClose={() => setShowTimeline(false)}
        />
      )}
    </div>
  )
}

const Badge = ({ label, value, color }: { label: string; value: number; color?: string }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 6px',
      borderRadius: 8,
      background: color || 'var(--vscode-button-secondaryBackground)',
      color: color ? '#000' : 'var(--vscode-button-secondaryForeground)',
      fontSize: 11,
    }}
  >
    {label}: {value}
  </span>
)

