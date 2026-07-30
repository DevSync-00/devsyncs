'use client';

import React from 'react';
import type { Table, SchemaDiff } from './types';
import { X, Key, Shield, HelpCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface TableDetailModalProps {
  table: Table | null;
  diffs?: SchemaDiff[];
  onClose: () => void;
}

export const TableDetailModal: React.FC<TableDetailModalProps> = ({
  table,
  diffs = [],
  onClose,
}) => {
  if (!table) return null;

  const tableDiffs = diffs.filter((d) => {
    if (d.target === 'table') {
      const payload = d.payload as any;
      return `${payload.schema ?? ''}:${payload.name}` === `${table.schema ?? ''}:${table.name}`;
    }
    if (d.target === 'column' || d.target === 'index' || d.target === 'constraint') {
      const payload = d.payload as any;
      return `${table.schema ?? ''}:${payload.table}` === `${table.schema ?? ''}:${table.name}`;
    }
    return false;
  });

  const getDiffColorClass = (action: 'add' | 'remove' | 'change') => {
    switch (action) {
      case 'add':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
      case 'remove':
        return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400';
      case 'change':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto flex flex-col bg-card border border-border shadow-2xl rounded-2xl p-6 relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="mb-4 pr-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
              {table.isView ? 'View' : table.isMaterializedView ? 'Materialized View' : 'Table'}
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {table.schema && table.schema !== 'public' ? `${table.schema}.` : ''}
            {table.name}
          </h2>
          {table.comment && (
            <p className="mt-2 text-xs text-muted-foreground font-medium italic">
              "{table.comment}"
            </p>
          )}
        </div>

        {/* Diffs/Drift Warnings */}
        {tableDiffs.length > 0 && (
          <div className="mb-5 p-3 rounded-xl border border-border bg-muted/30">
            <h4 className="text-[11px] font-mono tracking-wider uppercase font-semibold text-muted-foreground mb-2">
              Detected Drift Changes
            </h4>
            <div className="flex flex-col gap-1.5">
              {tableDiffs.map((diff) => (
                <div
                  key={diff.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${getDiffColorClass(diff.action)}`}
                >
                  <span className="uppercase text-[9px] px-1 py-0.5 rounded font-mono font-bold bg-white/10">
                    {diff.action}
                  </span>
                  <span className="capitalize font-mono">{diff.target}:</span>
                  <span className="font-mono">
                    {diff.target === 'column' && (diff.payload as any).column}
                    {diff.target === 'index' && (diff.payload as any).index}
                    {diff.target === 'constraint' && (diff.payload as any).constraint}
                    {diff.target === 'table' && (diff.payload as any).name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Columns Grid */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold tracking-tight text-foreground mb-3">Columns</h3>
          <div className="overflow-x-auto border border-border/60 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60 text-xs font-semibold text-muted-foreground">
                  <th className="p-3">Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Nullable</th>
                  <th className="p-3 text-right">Default</th>
                </tr>
              </thead>
              <tbody className="text-xs font-mono">
                {table.columns.map((col) => {
                  const colDiff = tableDiffs.find(
                    (d) =>
                      d.target === 'column' &&
                      (d.payload as any).column === col.name &&
                      (d.payload as any).table === table.name,
                  );
                  const isChange = colDiff?.action === 'change';
                  const isAdd = colDiff?.action === 'add';
                  const isRemove = colDiff?.action === 'remove';

                  let rowBg = 'hover:bg-muted/20';
                  if (isAdd) rowBg = 'bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300';
                  if (isRemove) rowBg = 'bg-rose-500/5 hover:bg-rose-500/10 text-rose-800 dark:text-rose-300';
                  if (isChange) rowBg = 'bg-amber-500/5 hover:bg-amber-500/10 text-amber-800 dark:text-amber-300';

                  return (
                    <tr
                      key={col.id}
                      className={`border-b border-border/40 last:border-0 transition-colors ${rowBg}`}
                    >
                      <td className="p-3 flex items-center gap-1.5 font-semibold text-foreground">
                        {col.isPrimaryKey && (
                          <span title="Primary Key"><Key className="w-3.5 h-3.5 text-accent shrink-0" /></span>
                        )}
                        {col.isUnique && !col.isPrimaryKey && (
                          <span title="Unique constraint"><Shield className="w-3.5 h-3.5 text-primary shrink-0" /></span>
                        )}
                        {col.name}

                      </td>
                      <td className="p-3 text-muted-foreground">
                        {col.type.name}
                        {col.length && `(${col.length})`}
                        {col.precision && col.scale && `(${col.precision},${col.scale})`}
                        {col.isArray && '[]'}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {col.nullable ? 'Yes' : 'No'}
                      </td>
                      <td className="p-3 text-right text-muted-foreground">
                        {col.default !== null && col.default !== undefined ? String(col.default) : col.isIdentity ? 'identity' : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Indexes Section */}
        {table.indexes && table.indexes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold tracking-tight text-foreground mb-2.5">Indexes</h3>
            <div className="flex flex-col gap-1.5">
              {table.indexes.map((idx) => (
                <div
                  key={idx.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/10 font-mono text-xs"
                >
                  <span className="font-semibold text-foreground">{idx.name}</span>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>({idx.columns.map((c) => c.name).join(', ')})</span>
                    {idx.unique && (
                      <span className="text-[9px] uppercase px-1.5 py-0.5 font-bold rounded bg-primary/10 text-primary">
                        Unique
                      </span>
                    )}
                    {idx.type && (
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {idx.type}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Constraints Section */}
        {table.constraints && table.constraints.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground mb-2.5">Constraints</h3>
            <div className="flex flex-col gap-1.5">
              {table.constraints.map((constraint) => (
                <div
                  key={constraint.id}
                  className="p-2.5 rounded-lg border border-border/50 bg-muted/10 font-mono text-xs text-muted-foreground"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground">{constraint.name || 'Unnamed'}</span>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {constraint.kind}
                    </span>
                  </div>
                  {constraint.kind === 'FOREIGN_KEY' && (
                    <div className="text-[11px] mt-1 pl-2 border-l-2 border-border">
                      <span className="text-accent font-semibold">{constraint.columns?.join(', ')}</span>
                      <span> references </span>
                      <span className="text-foreground font-semibold">{constraint.refTable}</span>
                      <span>({constraint.refColumns?.join(', ')})</span>
                    </div>
                  )}
                  {constraint.kind === 'CHECK' && 'expression' in constraint && (
                    <div className="text-[11px] mt-1 font-sans italic">
                      Expression: {constraint.expression}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
