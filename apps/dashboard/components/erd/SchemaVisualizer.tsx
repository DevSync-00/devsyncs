'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Columns3,
  Database,
  Download,
  GitBranch,
  Layers3,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SplitSquareHorizontal,
  Table2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ScannedSchema } from '@/lib/schema-scanner';
import { adaptScannedToNormalized, diffSchemas, mergeSchemas } from './erd-adapter';
import { GraphRenderer } from './GraphRenderer';
import { TableDetailModal } from './TableDetailModal';
import type { LayoutState, SchemaDiff, Table } from './types';

interface SchemaVisualizerProps {
  projectId?: string;
  scannedSchema?: ScannedSchema | null;
  codeSchema?: ScannedSchema | null;
  dbSchema?: ScannedSchema | null;
  mismatches?: unknown[];
}

export const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({
  projectId,
  scannedSchema,
  codeSchema,
  dbSchema,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [relationshipSearch, setRelationshipSearch] = useState('');
  const [showAdd, setShowAdd] = useState(true);
  const [showRemove, setShowRemove] = useState(true);
  const [showChange, setShowChange] = useState(true);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [layout, setLayout] = useState<LayoutState>({ tablePositions: {} });
  const [layoutState, setLayoutState] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const [syncPan, setSyncPan] = useState({ x: 0, y: 0 });
  const [syncZoom, setSyncZoom] = useState(1);
  const [compareMode, setCompareMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setLayoutState('loading');
    fetch(`/api/projects/${projectId}/layout`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Layout request failed');
        return response.json();
      })
      .then((data) => {
        if (active && data.layout?.tablePositions) setLayout(data.layout);
        if (active) setLayoutState('saved');
      })
      .catch(() => active && setLayoutState('error'));
    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const saveLayout = useCallback(async (nextLayout: LayoutState) => {
    if (!projectId) return;
    setLayoutState('saving');
    try {
      const response = await fetch(`/api/projects/${projectId}/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: nextLayout }),
      });
      if (!response.ok) throw new Error('Layout save failed');
      setLayoutState('saved');
    } catch {
      setLayoutState('error');
    }
  }, [projectId]);

  const handleLayoutChange = useCallback((nextLayout: LayoutState) => {
    setLayout(nextLayout);
    if (!projectId) return;
    setLayoutState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveLayout(nextLayout), 900);
  }, [projectId, saveLayout]);

  const {
    normalizedSchema,
    isComparison,
    codeNormalized,
    dbNormalized,
    mergedNormalized,
    computedDiffs,
  } = useMemo(() => {
    if (codeSchema || dbSchema) {
      const code = adaptScannedToNormalized(codeSchema);
      const database = adaptScannedToNormalized(dbSchema);
      return {
        isComparison: true,
        codeNormalized: code,
        dbNormalized: database,
        mergedNormalized: mergeSchemas(code, database),
        computedDiffs: diffSchemas(code, database),
        normalizedSchema: database,
      };
    }
    return {
      isComparison: false,
      normalizedSchema: adaptScannedToNormalized(scannedSchema),
      codeNormalized: null,
      dbNormalized: null,
      mergedNormalized: null,
      computedDiffs: [] as SchemaDiff[],
    };
  }, [scannedSchema, codeSchema, dbSchema]);

  const visibleSchema = isComparison && compareMode === 'unified' ? mergedNormalized! : normalizedSchema;
  const tableQuery = searchQuery.trim().toLowerCase();
  const navigatorTables = useMemo(
    () => visibleSchema.tables
      .filter((table) => !tableQuery
        || table.name.toLowerCase().includes(tableQuery)
        || table.columns.some((column) => column.name.toLowerCase().includes(tableQuery)))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [visibleSchema.tables, tableQuery],
  );
  const columnCount = visibleSchema.tables.reduce((total, table) => total + table.columns.length, 0);

  const handleExportSvg = () => {
    const svg = document.querySelector('[data-erd-canvas] svg');
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectId || 'database'}-schema.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderGraph = (
    schema: typeof normalizedSchema,
    label?: string,
    tone: 'blue' | 'violet' = 'blue',
  ) => (
    <section className="relative min-h-0 h-full overflow-hidden border-r last:border-r-0 border-slate-800/80">
      {label && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 rounded-md border border-slate-700/80 bg-slate-950/90 px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 shadow-xl backdrop-blur">
          <span className={`h-1.5 w-1.5 rounded-full ${tone === 'blue' ? 'bg-[#26B2F2]' : 'bg-violet-400'}`} />
          {label}
        </div>
      )}
      <GraphRenderer
        schema={schema}
        diffs={computedDiffs}
        searchQuery={searchQuery}
        relationshipSearch={relationshipSearch}
        showAdd={showAdd}
        showRemove={showRemove}
        showChange={showChange}
        layout={layout}
        onTableClick={setSelectedTable}
        onLayoutChange={handleLayoutChange}
        {...(isComparison && compareMode === 'side-by-side'
          ? {
              externalPan: syncPan,
              externalZoom: syncZoom,
              onViewportChange: (pan: { x: number; y: number }, zoom: number) => {
                setSyncPan(pan);
                setSyncZoom(zoom);
              },
            }
          : {})}
      />
    </section>
  );

  return (
    <div className="flex h-[calc(100vh-11.5rem)] min-h-[620px] w-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#080d16] text-slate-100 shadow-[0_24px_70px_rgba(2,8,23,0.35)]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-800 bg-[#0b111d] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-[#26B2F2]/10 text-[#26B2F2] ring-1 ring-inset ring-[#26B2F2]/25">
            <Database className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-mono text-[11px] font-semibold text-slate-100">schema.graph</div>
            <div className="font-mono text-[9px] text-slate-500">live database topology</div>
          </div>
        </div>

        <div className="mx-1 h-5 w-px bg-slate-800" />

        <label className="relative min-w-0 flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Filter tables or columns…"
            className="h-8 w-full rounded-md border border-slate-700/80 bg-slate-950/70 pl-8 pr-12 font-mono text-[11px] text-slate-200 outline-none transition focus:border-[#26B2F2]/70 focus:ring-2 focus:ring-[#26B2F2]/10"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[8px] text-slate-500">⌘K</kbd>
        </label>

        <div className="ml-auto flex items-center gap-1.5">
          {isComparison && (
            <div className="hidden items-center gap-1 lg:flex">
              <DiffToggle active={showAdd} onClick={() => setShowAdd((value) => !value)} label="Added" tone="emerald" />
              <DiffToggle active={showRemove} onClick={() => setShowRemove((value) => !value)} label="Removed" tone="rose" />
              <DiffToggle active={showChange} onClick={() => setShowChange((value) => !value)} label="Changed" tone="amber" />
            </div>
          )}
          {isComparison && (
            <div className="hidden items-center rounded-md border border-slate-700/80 bg-slate-950/60 p-0.5 sm:flex">
              <button
                onClick={() => setCompareMode('side-by-side')}
                className={`flex h-7 items-center gap-1.5 rounded px-2.5 font-mono text-[10px] transition ${compareMode === 'side-by-side' ? 'bg-[#26B2F2] text-slate-950' : 'text-slate-400 hover:text-slate-100'}`}
              >
                <SplitSquareHorizontal className="h-3 w-3" /> Split
              </button>
              <button
                onClick={() => setCompareMode('unified')}
                className={`flex h-7 items-center gap-1.5 rounded px-2.5 font-mono text-[10px] transition ${compareMode === 'unified' ? 'bg-[#26B2F2] text-slate-950' : 'text-slate-400 hover:text-slate-100'}`}
              >
                <Layers3 className="h-3 w-3" /> Unified
              </button>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={handleExportSvg} className="h-8 rounded-md px-2.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden font-mono text-[10px] sm:inline">Export</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`${navigatorOpen ? 'w-60' : 'w-11'} flex shrink-0 flex-col border-r border-slate-800 bg-[#0a101a] transition-[width] duration-200`}>
          <div className="flex h-10 items-center border-b border-slate-800 px-2">
            {navigatorOpen && <span className="px-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">Explorer</span>}
            <button
              onClick={() => setNavigatorOpen((open) => !open)}
              className="ml-auto grid h-7 w-7 place-items-center rounded text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
              title={navigatorOpen ? 'Collapse explorer' : 'Open explorer'}
            >
              {navigatorOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
            </button>
          </div>

          {navigatorOpen && (
            <>
              <div className="grid grid-cols-3 border-b border-slate-800">
                <Metric icon={<Table2 className="h-3 w-3" />} value={visibleSchema.tables.length} label="tables" />
                <Metric icon={<Columns3 className="h-3 w-3" />} value={columnCount} label="columns" />
                <Metric icon={<GitBranch className="h-3 w-3" />} value={visibleSchema.relationships.length} label="refs" />
              </div>
              <div className="border-b border-slate-800 p-2">
                <label className="relative block">
                  <GitBranch className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
                  <input
                    value={relationshipSearch}
                    onChange={(event) => setRelationshipSearch(event.target.value)}
                    placeholder="Filter relationships"
                    className="h-7 w-full rounded border border-slate-800 bg-slate-950/60 pl-7 pr-2 font-mono text-[10px] text-slate-300 outline-none focus:border-[#26B2F2]/50"
                  />
                </label>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                <div className="px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  public <span className="ml-1 text-slate-700">({navigatorTables.length})</span>
                </div>
                {navigatorTables.map((table) => (
                  <button
                    key={`${table.schema}:${table.name}`}
                    onClick={() => setSelectedTable(table)}
                    className="group flex w-full items-center gap-2 border-l-2 border-transparent px-3 py-1.5 text-left transition hover:border-[#26B2F2] hover:bg-[#26B2F2]/5"
                  >
                    <Table2 className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-[#26B2F2]" />
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-400 group-hover:text-slate-100">{table.name}</span>
                    <span className="font-mono text-[9px] text-slate-700">{table.columns.length}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        <main data-erd-canvas className="relative min-w-0 flex-1 bg-[#070b12]">
          {layoutState === 'loading' && (
            <div className="absolute inset-x-0 top-0 z-30 h-px overflow-hidden bg-slate-800">
              <div className="h-full w-1/3 animate-[pulse_1s_ease-in-out_infinite] bg-[#26B2F2]" />
            </div>
          )}
          {isComparison && compareMode === 'side-by-side' ? (
            <div className="grid h-full grid-cols-1 lg:grid-cols-2">
              {renderGraph(codeNormalized!, 'Code schema', 'blue')}
              {renderGraph(dbNormalized!, 'Database schema', 'violet')}
            </div>
          ) : renderGraph(visibleSchema)}
        </main>
      </div>

      <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-slate-800 bg-[#0b111d] px-3 font-mono text-[9px] text-slate-500">
        <span className="flex items-center gap-1.5 text-[#26B2F2]"><span className="h-1.5 w-1.5 rounded-full bg-[#26B2F2]" /> connected</span>
        <span>{visibleSchema.tables.length} tables</span>
        <span>{visibleSchema.relationships.length} relationships</span>
        <span className="ml-auto">
          {layoutState === 'saving' ? 'saving layout…' : layoutState === 'error' ? 'layout sync failed' : projectId ? 'layout synced' : 'local layout'}
        </span>
        <span className="hidden sm:inline">drag to pan · scroll to zoom · click table for details</span>
      </footer>

      {selectedTable && <TableDetailModal table={selectedTable} diffs={computedDiffs} onClose={() => setSelectedTable(null)} />}
    </div>
  );
};

function DiffToggle({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: 'emerald' | 'rose' | 'amber';
}) {
  const dot = tone === 'emerald' ? 'bg-emerald-400' : tone === 'rose' ? 'bg-rose-400' : 'bg-amber-400';
  return (
    <button
      onClick={onClick}
      className={`flex h-7 items-center gap-1.5 rounded border px-2 font-mono text-[9px] transition ${
        active ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-transparent text-slate-600'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${active ? '' : 'opacity-30'}`} />
      {label}
    </button>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="border-r border-slate-800 px-2 py-2.5 last:border-r-0">
      <div className="mb-1 flex items-center gap-1 text-[#26B2F2]">{icon}<span className="font-mono text-[11px] font-semibold text-slate-200">{value}</span></div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-slate-600">{label}</div>
    </div>
  );
}
