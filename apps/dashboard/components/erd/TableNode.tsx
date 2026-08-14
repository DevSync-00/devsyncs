'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, KeyRound, Link2, Lock, Table2 } from 'lucide-react';
import type { Table } from './types';

export type TableNodeData = {
  table: Table;
  color: string;
  collapsed: boolean;
  locked: boolean;
  relationshipCount: number;
  highlighted: boolean;
  onToggleCollapse: (id: string) => void;
};

function TableNodeComponent({ id, data, selected }: NodeProps) {
  const node = data as TableNodeData;
  const { table } = node;
  return (
    <article
      aria-label={`${table.schema || 'public'}.${table.name} table`}
      className={`w-72 overflow-hidden rounded-xl border bg-slate-950/95 text-slate-200 shadow-2xl transition ${selected ? 'border-cyan-400 ring-2 ring-cyan-400/20' : node.highlighted ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-700'}`}
      style={{ borderTopColor: node.color, borderTopWidth: 3 }}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-slate-950 !bg-cyan-400" />
      <header className="flex h-[51px] items-center gap-2 border-b border-slate-800 px-3">
        <Table2 className="h-4 w-4 shrink-0" style={{ color: node.color }} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-xs font-semibold text-white">{table.name}</div>
          <div className="font-mono text-[9px] text-slate-500">{table.schema || 'public'}{table.rowCount != null ? ` · ${table.rowCount.toLocaleString()} rows` : ''}</div>
        </div>
        {node.locked ? <Lock className="h-3 w-3 text-amber-400" aria-label="Position locked" /> : null}
        <button className="nodrag rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-white" onClick={() => node.onToggleCollapse(id)} aria-label={node.collapsed ? 'Expand table' : 'Collapse table'}>
          {node.collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </header>
      {!node.collapsed ? (
        <div className="max-h-[840px] overflow-hidden py-1">
          {table.columns.slice(0, 30).map((column) => (
            <div key={column.id || column.name} className="flex h-7 items-center gap-1.5 border-b border-slate-800/60 px-3 font-mono text-[10px] last:border-0">
              <span className="w-4 shrink-0">{column.isPrimaryKey ? <KeyRound className="h-3 w-3 text-amber-400" /> : column.isForeignKey ? <Link2 className="h-3 w-3 text-cyan-400" /> : null}</span>
              <span className="min-w-0 flex-1 truncate text-slate-300">{column.name}</span>
              {column.isUnique ? <span className="rounded bg-violet-500/15 px-1 text-[8px] text-violet-300">UQ</span> : null}
              {column.nullable ? <span className="text-[8px] text-slate-600">NULL</span> : null}
              <span className="max-w-[105px] truncate text-right text-slate-500">{column.type.name}</span>
            </div>
          ))}
          {table.columns.length > 30 ? <div className="px-3 py-2 font-mono text-[9px] text-slate-500">+{table.columns.length - 30} columns</div> : null}
          <footer className="flex h-8 items-center gap-1.5 border-t border-slate-800 px-3 font-mono text-[9px] text-slate-500"><Link2 className="h-3 w-3" />{node.relationshipCount} relationships</footer>
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-slate-950 !bg-violet-400" />
    </article>
  );
}

export const TableNode = memo(TableNodeComponent);
