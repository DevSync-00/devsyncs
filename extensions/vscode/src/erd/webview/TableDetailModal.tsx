import React from 'react'
import type { Table } from '../schema/types'
import type { SchemaDiff } from '../diff/types'

export const TableDetailModal: React.FC<{
  table: Table | null
  diffs: SchemaDiff[]
  onClose: () => void
}> = ({ table, diffs, onClose }) => {
  if (!table) return null

  const tableDiffs = diffs.filter((d) => {
    if (d.target === 'table') {
      const payload = d.payload as any
      return `${payload.schema ?? ''}:${payload.name}` === `${table.schema ?? ''}:${table.name}`
    }
    if (d.target === 'column' || d.target === 'index' || d.target === 'constraint') {
      const payload = d.payload as any
      return `${table.schema ?? ''}:${payload.table}` === `${table.schema ?? ''}:${table.name}`
    }
    return false
  })

  const getDiffColor = (action: 'add' | 'remove' | 'change') => {
    switch (action) {
      case 'add':
        return '#4ade80'
      case 'remove':
        return '#f87171'
      case 'change':
        return '#fbbf24'
    }
  }

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
          maxWidth: '80%',
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

        <h2 style={{ marginTop: 0, marginBottom: 16 }}>
          {table.schema ? `${table.schema}.` : ''}
          {table.name}
          {table.isView && <span style={{ opacity: 0.7, fontSize: 14 }}> (View)</span>}
          {table.isMaterializedView && (
            <span style={{ opacity: 0.7, fontSize: 14 }}> (Materialized View)</span>
          )}
        </h2>

        {table.comment && (
          <div style={{ marginBottom: 16, opacity: 0.8, fontStyle: 'italic' }}>
            {table.comment}
          </div>
        )}

        {tableDiffs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <strong>Changes:</strong>
            <div style={{ marginTop: 8 }}>
              {tableDiffs.map((diff) => (
                <div
                  key={diff.id}
                  style={{
                    padding: '4px 8px',
                    margin: '4px 0',
                    background: getDiffColor(diff.action),
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  {diff.action.toUpperCase()}: {diff.target} -{' '}
                  {diff.target === 'column' && (diff.payload as any).column}
                  {diff.target === 'index' && (diff.payload as any).index}
                  {diff.target === 'constraint' && (diff.payload as any).constraint}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Columns</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--vscode-editorWidget-border)' }}>
                <th style={{ textAlign: 'left', padding: '8px' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Nullable</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Default</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col) => {
                const colDiff = tableDiffs.find(
                  (d) =>
                    d.target === 'column' &&
                    (d.payload as any).column === col.name &&
                    (d.payload as any).table === table.name,
                )
                return (
                  <tr
                    key={col.id}
                    style={{
                      borderBottom: '1px solid var(--vscode-editorWidget-border)',
                      background: colDiff ? getDiffColor(colDiff.action) + '20' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '8px' }}>
                      {col.isPrimaryKey && '🔑 '}
                      {col.isUnique && '⭐ '}
                      {col.name}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {col.type.name}
                      {col.length && `(${col.length})`}
                      {col.precision && col.scale && `(${col.precision},${col.scale})`}
                      {col.isArray && '[]'}
                    </td>
                    <td style={{ padding: '8px' }}>{col.nullable ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '8px', opacity: 0.7 }}>
                      {col.default ?? col.isIdentity ? 'auto' : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {table.indexes && table.indexes.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Indexes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {table.indexes.map((idx) => (
                <div
                  key={idx.id}
                  style={{
                    padding: '8px',
                    background: 'var(--vscode-editor-background)',
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  <strong>{idx.name}</strong> ({idx.columns.map((c) => c.name).join(', ')})
                  {idx.unique && ' [UNIQUE]'}
                  {idx.type && ` [${idx.type}]`}
                </div>
              ))}
            </div>
          </div>
        )}

        {table.constraints && table.constraints.length > 0 && (
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Constraints</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {table.constraints.map((constraint) => (
                <div
                  key={constraint.id}
                  style={{
                    padding: '8px',
                    background: 'var(--vscode-editor-background)',
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  <strong>{constraint.name || constraint.kind}</strong> ({constraint.kind})
                  {constraint.kind === 'FOREIGN_KEY' && constraint.refTable && (
                    <span>
                      {' '}
                      → {constraint.refTable}({constraint.refColumns?.join(', ')})
                    </span>
                  )}
                  {constraint.columns && constraint.columns.length > 0 && (
                    <span> on ({constraint.columns.join(', ')})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

