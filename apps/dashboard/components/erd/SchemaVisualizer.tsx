'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';

import type { NormalizedSchema, Table, LayoutState, SchemaDiff } from './types';
import { GraphRenderer } from './GraphRenderer';
import { TableDetailModal } from './TableDetailModal';
import { adaptScannedToNormalized, diffSchemas, mergeSchemas } from './erd-adapter';
import { ScannedSchema } from '@/lib/schema-scanner';
import { Search, SlidersHorizontal, Layers, Split, HelpCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SchemaVisualizerProps {
  projectId?: string;
  
  // Option 1: Render a single scanned schema (live database)
  scannedSchema?: ScannedSchema | null;
  
  // Option 2: Render comparison mode (Code vs Database)
  codeSchema?: ScannedSchema | null;
  dbSchema?: ScannedSchema | null;
  mismatches?: any[];
}

export const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({
  projectId,
  scannedSchema,
  codeSchema,
  dbSchema,
  mismatches,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [relSearchQuery, setRelSearchQuery] = useState('');
  const [showAdd, setShowAdd] = useState(true);
  const [showRemove, setShowRemove] = useState(true);
  const [showChange, setShowChange] = useState(true);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Layout state loaded from the API
  const [layout, setLayout] = useState<LayoutState>({ tablePositions: {} });
  const [loadingLayout, setLoadingLayout] = useState(false);

  // Sync pan/zoom state for side-by-side view
  const [syncPan, setSyncPan] = useState({ x: 0, y: 0 });
  const [syncZoom, setSyncZoom] = useState(1);

  // View mode: 'side-by-side' or 'unified' for comparisons
  const [compareMode, setCompareMode] = useState<'side-by-side' | 'unified'>('side-by-side');

  // Load layout from Supabase API if projectId is provided
  useEffect(() => {
    if (!projectId) return;

    const fetchLayout = async () => {
      setLoadingLayout(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/layout`);
        if (res.ok) {
          const data = await res.json();
          if (data.layout && data.layout.tablePositions) {
            setLayout(data.layout);
          }
        }
      } catch (err) {
        console.error('Failed to load project layout:', err);
      } finally {
        setLoadingLayout(false);
      }
    };

    fetchLayout();
  }, [projectId]);

  // Debounced API post to save layout
  const saveLayoutToDb = useCallback(
    async (nextLayout: LayoutState) => {
      if (!projectId) return;
      try {
        await fetch(`/api/projects/${projectId}/layout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: nextLayout }),
        });
      } catch (err) {
        console.error('Failed to save layout:', err);
      }
    },
    [projectId]
  );

  // Handle drag/drop coordinate changes from renderer
  const handleLayoutChange = useCallback(
    (nextLayout: LayoutState) => {
      setLayout(nextLayout);
      // Simple debounce to prevent flooding queries on drag
      const timer = (saveLayoutToDb as any)._debounceTimer;
      if (timer) clearTimeout(timer);
      (saveLayoutToDb as any)._debounceTimer = setTimeout(() => {
        saveLayoutToDb(nextLayout);
      }, 1500);
    },
    [saveLayoutToDb]
  );

  const handleViewportChange = useCallback((nextPan: { x: number; y: number }, nextZoom: number) => {
    setSyncPan(nextPan);
    setSyncZoom(nextZoom);
  }, []);

  // Adapt schemas
  const { normalizedSchema, isComparison, codeNormalized, dbNormalized, mergedNormalized, computedDiffs } = useMemo(() => {
    const isComp = !!(codeSchema || dbSchema);
    
    if (isComp) {
      const codeN = adaptScannedToNormalized(codeSchema);
      const dbN = adaptScannedToNormalized(dbSchema);
      const diffs = diffSchemas(codeN, dbN);
      const mergedN = mergeSchemas(codeN, dbN);
      
      return {
        isComparison: true,
        codeNormalized: codeN,
        dbNormalized: dbN,
        mergedNormalized: mergedN,
        computedDiffs: diffs,
        normalizedSchema: dbN, // Fallback base
      };
    }

    const nSchema = adaptScannedToNormalized(scannedSchema);
    return {
      isComparison: false,
      normalizedSchema: nSchema,
      codeNormalized: null,
      dbNormalized: null,
      mergedNormalized: null,
      computedDiffs: [],
    };
  }, [scannedSchema, codeSchema, dbSchema]);

  const handleExportSvg = () => {
    // Basic SVG export utility
    const svgEl = document.querySelector('svg.text-foreground');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `${projectId || 'database'}-erd.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="flex flex-col h-[75vh] w-full border border-border/80 rounded-2xl bg-muted/10">
      
      {/* Top Filter and Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b border-border/60 bg-card rounded-t-2xl">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Search Inputs */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-52 rounded-xl border border-border/60 bg-muted/20 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            />
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search foreign keys..."
              value={relSearchQuery}
              onChange={(e) => setRelSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-48 rounded-xl border border-border/60 bg-muted/20 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            />
          </div>

          {/* Diffs Filter Toggles */}
          {isComparison && (
            <div className="flex items-center gap-2 px-3 py-1.5 border border-border/60 rounded-xl text-xs font-semibold bg-muted/10">
              <span className="text-[10px] text-muted-foreground uppercase font-mono mr-1">Filter drift:</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-emerald-600 dark:text-emerald-400">
                <input
                  type="checkbox"
                  checked={showAdd}
                  onChange={(e) => setShowAdd(e.target.checked)}
                  className="rounded border-border text-emerald-500 focus:ring-emerald-400"
                />
                Added
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-rose-600 dark:text-rose-400">
                <input
                  type="checkbox"
                  checked={showRemove}
                  onChange={(e) => setShowRemove(e.target.checked)}
                  className="rounded border-border text-rose-500 focus:ring-rose-400"
                />
                Removed
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-amber-600 dark:text-amber-400">
                <input
                  type="checkbox"
                  checked={showChange}
                  onChange={(e) => setShowChange(e.target.checked)}
                  className="rounded border-border text-amber-500 focus:ring-amber-400"
                />
                Changed
              </label>
            </div>
          )}
        </div>

        {/* View Mode & Export Controls */}
        <div className="flex items-center gap-2">
          {isComparison && (
            <div className="flex items-center gap-1 p-0.5 border border-border/60 bg-muted/30 rounded-xl">
              <Button
                variant={compareMode === 'side-by-side' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 text-xs font-semibold rounded-lg flex items-center gap-1.5"
                onClick={() => setCompareMode('side-by-side')}
              >
                <Split className="w-3.5 h-3.5" />
                Side-by-Side
              </Button>
              <Button
                variant={compareMode === 'unified' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 text-xs font-semibold rounded-lg flex items-center gap-1.5"
                onClick={() => setCompareMode('unified')}
              >
                <Layers className="w-3.5 h-3.5" />
                Unified View
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSvg}
            className="h-8 text-xs font-semibold rounded-xl flex items-center gap-1.5"
            title="Export as Vector SVG"
          >
            <Download className="w-3.5 h-3.5" />
            Export SVG
          </Button>
        </div>
      </div>

      {/* Main Graph Content */}
      <div className="flex-1 w-full min-h-0 relative">
        {loadingLayout && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50">
            <span className="text-xs font-mono text-muted-foreground animate-pulse">
              Syncing layout coordinates...
            </span>
          </div>
        )}

        {isComparison ? (
          compareMode === 'side-by-side' ? (
            /* SIDE-BY-SIDE MODE */
            <div className="grid grid-cols-1 lg:grid-cols-2 h-full w-full gap-2 p-2">
              <div className="h-full flex flex-col min-h-0 relative">
                <div className="absolute top-3 left-3 z-10 font-mono text-[9px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold uppercase tracking-wider">
                  Codebase Schema
                </div>
                <GraphRenderer
                  schema={codeNormalized!}
                  diffs={computedDiffs}
                  searchQuery={searchQuery}
                  relationshipSearch={relSearchQuery}
                  showAdd={showAdd}
                  showRemove={showRemove}
                  showChange={showChange}
                  layout={layout}
                  onTableClick={setSelectedTable}
                  onLayoutChange={handleLayoutChange}
                  externalPan={syncPan}
                  externalZoom={syncZoom}
                  onViewportChange={handleViewportChange}
                />
              </div>
              
              <div className="h-full flex flex-col min-h-0 relative">
                <div className="absolute top-3 left-3 z-10 font-mono text-[9px] px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-bold uppercase tracking-wider">
                  Database Schema
                </div>
                <GraphRenderer
                  schema={dbNormalized!}
                  diffs={computedDiffs}
                  searchQuery={searchQuery}
                  relationshipSearch={relSearchQuery}
                  showAdd={showAdd}
                  showRemove={showRemove}
                  showChange={showChange}
                  layout={layout}
                  onTableClick={setSelectedTable}
                  onLayoutChange={handleLayoutChange}
                  externalPan={syncPan}
                  externalZoom={syncZoom}
                  onViewportChange={handleViewportChange}
                />
              </div>
            </div>
          ) : (
            /* UNIFIED COMPARISON VIEW */
            <div className="h-full w-full p-2">
              <GraphRenderer
                schema={mergedNormalized!}
                diffs={computedDiffs}
                searchQuery={searchQuery}
                relationshipSearch={relSearchQuery}
                showAdd={showAdd}
                showRemove={showRemove}
                showChange={showChange}
                layout={layout}
                onTableClick={setSelectedTable}
                onLayoutChange={handleLayoutChange}
              />
            </div>
          )
        ) : (
          /* SINGLE SCHEMA MODE */
          <div className="h-full w-full p-2">
            <GraphRenderer
              schema={normalizedSchema}
              searchQuery={searchQuery}
              relationshipSearch={relSearchQuery}
              layout={layout}
              onTableClick={setSelectedTable}
              onLayoutChange={handleLayoutChange}
            />
          </div>
        )}
      </div>

      {/* Table Details Drawer / Modal */}
      {selectedTable && (
        <TableDetailModal
          table={selectedTable}
          diffs={computedDiffs}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </div>
  );
};
