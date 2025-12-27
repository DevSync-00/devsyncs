import React from 'react'
import type { SnapshotMeta } from '../snapshots/store'

export const TimelineView: React.FC<{
  snapshots: SnapshotMeta[]
  currentId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}> = ({ snapshots, currentId, onSelect, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--vscode-editorWidget-background)',
          border: '1px solid var(--vscode-editorWidget-border)',
          borderRadius: 8,
          padding: 20,
          maxWidth: '600px',
          maxHeight: '80%',
          overflow: 'auto',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'transparent',
            border: 'none',
            color: 'var(--vscode-editor-foreground)',
            cursor: 'pointer',
            fontSize: 20,
            padding: '4px 8px',
          }}
        >
          ×
        </button>

        <h2 style={{ marginTop: 0, marginBottom: 16 }}>Schema Timeline</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {snapshots.map((snapshot, idx) => {
            const isCurrent = snapshot.id === currentId
            const date = new Date(snapshot.createdAt)
            const dateStr = date.toLocaleString()
            return (
              <div
                key={snapshot.id}
                onClick={() => {
                  onSelect(snapshot.id)
                  onClose()
                }}
                style={{
                  padding: 12,
                  border: `2px solid ${
                    isCurrent
                      ? 'var(--vscode-button-background)'
                      : 'var(--vscode-editorWidget-border)'
                  }`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: isCurrent
                    ? 'var(--vscode-button-background)'
                    : 'var(--vscode-editor-background)',
                  opacity: isCurrent ? 1 : 0.8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                      {idx === 0 && '📌 '}
                      {snapshot.note || `Snapshot ${idx + 1}`}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>{dateStr}</div>
                    {snapshot.source && (
                      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
                        Source: {snapshot.source.split('/').pop()}
                      </div>
                    )}
                  </div>
                  {isCurrent && (
                    <span
                      style={{
                        padding: '2px 6px',
                        background: 'var(--vscode-button-foreground)',
                        color: 'var(--vscode-button-background)',
                        borderRadius: 4,
                        fontSize: 10,
                      }}
                    >
                      Current
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

