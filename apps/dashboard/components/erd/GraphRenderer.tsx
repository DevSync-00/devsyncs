'use client';

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import type { NormalizedSchema, Table, LayoutState, SchemaDiff } from './types';

type Node = {
  id: string;
  type: 'table';
  data: {
    name: string;
    schema?: string;
    columns: Array<{ name: string; type: string; nullable: boolean; primaryKey: boolean }>;
    diffStatus?: 'add' | 'remove' | 'change' | null;
  };
  position: { x: number; y: number };
};

type Edge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  style?: { stroke?: string };
  label?: string;
};

const getDiffColor = (action: 'add' | 'remove' | 'change' | undefined): string => {
  switch (action) {
    case 'add':
      return '#10b981'; // Green-500
    case 'remove':
      return '#ef4444'; // Red-500
    case 'change':
      return '#f59e0b'; // Amber-500
    default:
      return 'currentColor';
  }
};

const getTableDiffStatus = (
  tableName: string,
  schema: string | undefined,
  diffs: SchemaDiff[],
  allowedActions: Set<string>,
): 'add' | 'remove' | 'change' | null => {
  const key = `${schema ?? ''}:${tableName}`;
  const tableDiffs = diffs.filter((d) => {
    if (d.target === 'table') {
      const payload = d.payload as any;
      return `${payload.schema ?? ''}:${payload.name}` === key;
    }
    if (d.target === 'column' || d.target === 'index' || d.target === 'constraint') {
      const payload = d.payload as any;
      return `${schema ?? ''}:${payload.table}` === key;
    }
    return false;
  });
  const add = tableDiffs.some((d) => d.action === 'add' && allowedActions.has('add'));
  const remove = tableDiffs.some((d) => d.action === 'remove' && allowedActions.has('remove'));
  const change = tableDiffs.some((d) => d.action === 'change' && allowedActions.has('change'));
  if (add) return 'add';
  if (remove) return 'remove';
  if (change) return 'change';
  return null;
};

interface GraphRendererProps {
  schema: NormalizedSchema;
  diffs?: SchemaDiff[];
  width?: number | string;
  height?: number | string;
  searchQuery?: string;
  relationshipSearch?: string;
  showAdd?: boolean;
  showRemove?: boolean;
  showChange?: boolean;
  layout?: LayoutState;
  onTableClick?: (table: Table) => void;
  onLayoutChange?: (layout: LayoutState) => void;
  
  // Controlled viewport for side-by-side synchronization
  externalPan?: { x: number; y: number };
  externalZoom?: number;
  onViewportChange?: (pan: { x: number; y: number }, zoom: number) => void;
}

export const GraphRenderer: React.FC<GraphRendererProps> = ({
  schema,
  diffs = [],
  width = '100%',
  height = '100%',
  searchQuery = '',
  relationshipSearch = '',
  showAdd = true,
  showRemove = true,
  showChange = true,
  layout,
  onTableClick,
  onLayoutChange,
  externalPan,
  externalZoom,
  onViewportChange,
}) => {
  // Inner fallback state if viewport is uncontrolled
  const [innerPan, setInnerPan] = useState({ x: 0, y: 0 });
  const [innerZoom, setInnerZoom] = useState(1);

  const pan = externalPan !== undefined ? externalPan : innerPan;
  const zoom = externalZoom !== undefined ? externalZoom : innerZoom;

  const setPan = useCallback((newPan: { x: number; y: number } | ((p: { x: number; y: number }) => { x: number; y: number })) => {
    if (onViewportChange) {
      const nextPan = typeof newPan === 'function' ? newPan(pan) : newPan;
      onViewportChange(nextPan, zoom);
    } else {
      setInnerPan(newPan);
    }
  }, [pan, zoom, onViewportChange]);

  const setZoom = useCallback((newZoom: number | ((z: number) => number)) => {
    if (onViewportChange) {
      const nextZoom = typeof newZoom === 'function' ? newZoom(zoom) : newZoom;
      onViewportChange(pan, nextZoom);
    } else {
      setInnerZoom(newZoom);
    }
  }, [pan, zoom, onViewportChange]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [hoveredRelationship, setHoveredRelationship] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // State for node positions (can be modified by dragging)
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  // Initialize positions from layout or compute default grid layout
  useEffect(() => {
    if (layout?.tablePositions && Object.keys(layout.tablePositions).length > 0) {
      setNodePositions(layout.tablePositions);
    } else {
      const allTables = schema.tables || [];
      const cols = Math.ceil(Math.sqrt(allTables.length));
      const spacing = 260;
      const positions: Record<string, { x: number; y: number }> = {};
      
      allTables.forEach((table, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const key = `${table.schema ?? ''}:${table.name}`;
        positions[key] = { x: col * spacing + 100, y: row * spacing + 100 };
      });
      
      setNodePositions(positions);
    }
  }, [schema.tables, layout]);

  const { nodes, edges, bounds } = useMemo(() => {
    const tableNodes: Node[] = [];
    const relationshipEdges: Edge[] = [];

    const allowedActions = new Set<string>();
    if (showAdd) allowedActions.add('add');
    if (showRemove) allowedActions.add('remove');
    if (showChange) allowedActions.add('change');

    const allTables = schema.tables || [];
    const query = searchQuery.toLowerCase().trim();
    const tables = query
      ? allTables.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            (t.schema && t.schema.toLowerCase().includes(query)) ||
            (t.columns || []).some((c) => c.name.toLowerCase().includes(query)),
        )
      : allTables;
    const nodeWidth = 200;
    const nodeHeight = 150;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    tables.forEach((table) => {
      const key = `${table.schema ?? ''}:${table.name}`;
      const savedPos = nodePositions[key];
      const diffStatus = getTableDiffStatus(table.name, table.schema, diffs, allowedActions);
      
      const x = savedPos?.x ?? 0;
      const y = savedPos?.y ?? 0;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + nodeWidth);
      maxY = Math.max(maxY, y + nodeHeight);

      tableNodes.push({
        id: key,
        type: 'table',
        data: {
          name: table.name,
          schema: table.schema,
          columns: (table.columns || []).slice(0, 10).map((col) => ({
            name: col.name,
            type: col.type.name,
            nullable: col.nullable,
            primaryKey: col.isPrimaryKey || false,
          })),
          diffStatus,
        },
        position: { x, y },
      });
    });

    const visibleTableIds = new Set(tableNodes.map((n) => n.id));
    const relationships = schema.relationships || [];
    const relQuery = relationshipSearch.toLowerCase().trim();
    relationships.forEach((rel) => {
      const sourceTable = schema.tables.find((t) => t.name === rel.sourceTable);
      const targetTable = schema.tables.find((t) => t.name === rel.targetTable);
      const sourceKey = `${sourceTable?.schema ?? ''}:${rel.sourceTable}`;
      const targetKey = `${targetTable?.schema ?? ''}:${rel.targetTable}`;
      
      if (!visibleTableIds.has(sourceKey) || !visibleTableIds.has(targetKey)) {
        return;
      }
      
      const sourceNode = tableNodes.find((n) => n.id === sourceKey);
      const targetNode = tableNodes.find((n) => n.id === targetKey);

      if (sourceNode && targetNode) {
        const relDiff = diffs.find(
          (d) =>
            d.target === 'relationship' &&
            (d.payload as any).sourceTable === rel.sourceTable &&
            (d.payload as any).targetTable === rel.targetTable,
        );
        if (relDiff && !allowedActions.has(relDiff.action)) {
          return;
        }

        const relLabel = `${rel.sourceTable}.${rel.sourceColumn}->${rel.targetTable}.${rel.targetColumn}`.toLowerCase();
        if (
          relQuery &&
          !relLabel.includes(relQuery) &&
          !rel.sourceTable.toLowerCase().includes(relQuery) &&
          !rel.targetTable.toLowerCase().includes(relQuery)
        ) {
          return;
        }

        const edgeColor = getDiffColor(relDiff?.action);

        relationshipEdges.push({
          id: `rel-${rel.id}`,
          source: sourceKey,
          target: targetKey,
          sourceHandle: `${rel.sourceTable}:${rel.sourceColumn}`,
          targetHandle: `${rel.targetTable}:${rel.targetColumn}`,
          style: { stroke: edgeColor === 'currentColor' ? undefined : edgeColor },
          label: `${rel.sourceCardinality === 'ONE' ? '1' : 'N'}:${rel.targetCardinality === 'ONE' ? '1' : 'N'}`,
        });
      }
    });

    const finalMinX = minX === Infinity ? 0 : minX;
    const finalMinY = minY === Infinity ? 0 : minY;
    const finalMaxX = maxX === -Infinity ? 500 : maxX;
    const finalMaxY = maxY === -Infinity ? 500 : maxY;

    return {
      nodes: tableNodes,
      edges: relationshipEdges,
      bounds: { minX: finalMinX, minY: finalMinY, maxX: finalMaxX, maxY: finalMaxY },
    };
  }, [schema, diffs, searchQuery, relationshipSearch, nodePositions, showAdd, showRemove, showChange]);

  const handleFitView = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const contentWidth = bounds.maxX - bounds.minX + 200;
      const contentHeight = bounds.maxY - bounds.minY + 200;

      const scaleX = containerWidth / contentWidth;
      const scaleY = containerHeight / contentHeight;
      const newZoom = Math.max(0.2, Math.min(scaleX, scaleY, 1.2)) * 0.9;

      if (onViewportChange) {
        onViewportChange(
          {
            x: (containerWidth - contentWidth * newZoom) / 2 - bounds.minX * newZoom,
            y: (containerHeight - contentHeight * newZoom) / 2 - bounds.minY * newZoom,
          },
          newZoom
        );
      } else {
        setInnerZoom(newZoom);
        setInnerPan({
          x: (containerWidth - contentWidth * newZoom) / 2 - bounds.minX * newZoom,
          y: (containerHeight - contentHeight * newZoom) / 2 - bounds.minY * newZoom,
        });
      }
    }
  }, [bounds, onViewportChange]);

  // Auto-fit on first render/load
  useEffect(() => {
    handleFitView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.tables, layout]);

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      if (e.button === 0) {
        setDraggedNodeId(nodeId);
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          const svgRect = svgRef.current?.getBoundingClientRect();
          if (svgRect) {
            const mouseX = (e.clientX - svgRect.left - pan.x) / zoom;
            const mouseY = (e.clientY - svgRect.top - pan.y) / zoom;
            setDragStart({
              x: mouseX - node.position.x,
              y: mouseY - node.position.y,
            });
          }
        }
      }
    },
    [nodes, pan, zoom],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0 && !draggedNodeId) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [pan, draggedNodeId],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggedNodeId) {
        const node = nodes.find((n) => n.id === draggedNodeId);
        if (node && svgRef.current) {
          const svgRect = svgRef.current.getBoundingClientRect();
          const mouseX = (e.clientX - svgRect.left - pan.x) / zoom;
          const mouseY = (e.clientY - svgRect.top - pan.y) / zoom;
          const newX = Math.round(mouseX - dragStart.x);
          const newY = Math.round(mouseY - dragStart.y);

          setNodePositions((prev) => {
            const updated = { ...prev, [draggedNodeId]: { x: newX, y: newY } };
            if (onLayoutChange) {
              onLayoutChange({ tablePositions: updated });
            }
            return updated;
          });
        }
      } else if (isDragging) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart, draggedNodeId, nodes, pan, zoom, onLayoutChange, setPan],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedNodeId(null);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.15, Math.min(2.5, zoom * delta));
      setZoom(newZoom);
    },
    [zoom, setZoom],
  );

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(2.5, z * 1.2)), [setZoom]);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(0.15, z * 0.8)), [setZoom]);

  return (
    <div
      ref={containerRef}
      style={{ width, height }}
      className="relative overflow-hidden border border-border/40 rounded-xl bg-card select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Controls Overlay */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 p-1 bg-card/85 backdrop-blur border border-border/50 rounded-lg shadow-sm">
        <button
          onClick={handleZoomIn}
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted text-xs font-semibold"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted text-xs font-semibold"
          title="Zoom Out"
        >
          −
        </button>
        <button
          onClick={handleFitView}
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted text-[10px] font-medium"
          title="Fit view"
        >
          Fit
        </button>
        <div className="text-[9px] font-mono text-muted-foreground text-center pt-1 border-t">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Diagram Canvas */}
      <svg
        ref={svgRef}
        width={3000}
        height={3000}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
        className="text-foreground"
      >
        {/* Connection marker styles */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 7 3, 0 6" className="fill-muted-foreground" />
          </marker>
        </defs>

        {/* Render edges/connections */}
        {edges.map((edge) => {
          const sourceNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          // Connect from middle of right/left side
          const x1 = sourceNode.position.x + 100;
          const y1 = sourceNode.position.y + 75;
          const x2 = targetNode.position.x + 100;
          const y2 = targetNode.position.y + 75;

          const dx = x2 - x1;
          const dy = y2 - y1;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const offset = Math.min(60, Math.abs(dx) * 0.25);
          const cpX = midX + (dy > 0 ? offset : -offset);
          const cpY = midY - (dx > 0 ? offset : -offset);

          const isHovered = hoveredRelationship === edge.id;
          const strokeColor = edge.style?.stroke || 'hsl(var(--muted-foreground) / 0.5)';
          const strokeWidth = isHovered ? 2.5 : 1.5;
          const opacity = isHovered ? 1 : 0.65;

          return (
            <g
              key={edge.id}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredRelationship(edge.id)}
              onMouseLeave={() => setHoveredRelationship(null)}
            >
              <path
                d={`M ${x1} ${y1} Q ${cpX} ${cpY} ${x2} ${y2}`}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                fill="none"
                markerEnd="url(#arrowhead)"
                opacity={opacity}
              />
              {edge.label && (
                <text
                  x={cpX}
                  y={cpY - 4}
                  fill={strokeColor}
                  fontSize={isHovered ? 10 : 9}
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  textAnchor="middle"
                  style={{ pointerEvents: 'none' }}
                >
                  <tspan
                    x={cpX}
                    dy="0"
                    fill="hsl(var(--card))"
                    stroke="hsl(var(--card))"
                    strokeWidth={3}
                  >
                    {edge.label}
                  </tspan>
                  <tspan x={cpX} dy="0">
                    {edge.label}
                  </tspan>
                </text>
              )}
            </g>
          );
        })}

        {/* Render nodes/tables */}
        {nodes.map((node) => {
          const borderColor = getDiffColor(node.data.diffStatus || undefined);
          const table = schema.tables.find(
            (t) => `${t.schema ?? ''}:${t.name}` === node.id,
          );
          const isCurrentDragging = draggedNodeId === node.id;
          const isConnectedToHovered = hoveredRelationship
            ? edges.some(
                (e) =>
                  e.id === hoveredRelationship && (e.source === node.id || e.target === node.id),
              )
            : false;
            
          const finalStrokeWidth = node.data.diffStatus ? 2.5 : isConnectedToHovered ? 2 : 1;
          const finalStrokeColor = node.data.diffStatus
            ? borderColor
            : isConnectedToHovered
            ? 'hsl(var(--primary))'
            : 'hsl(var(--border))';

          return (
            <g
              key={node.id}
              transform={`translate(${node.position.x}, ${node.position.y})`}
            >
              {/* Table Card Backdrop */}
              <rect
                width={200}
                height={150}
                fill="hsl(var(--card))"
                stroke={finalStrokeColor}
                strokeWidth={finalStrokeWidth}
                rx={8}
                className="shadow-sm hover:shadow transition-shadow"
                style={{ cursor: isCurrentDragging ? 'grabbing' : 'grab' }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (table) onTableClick?.(table);
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              />
              
              {/* Table Name Header banner */}
              <rect
                x={1}
                y={1}
                width={198}
                height={28}
                fill="hsl(var(--muted) / 0.4)"
                rx={7}
                style={{ pointerEvents: 'none' }}
              />

              {/* Table name text */}
              <text
                x={100}
                y={19}
                fill="hsl(var(--foreground))"
                fontSize={11}
                fontWeight="semibold"
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
              >
                {node.data.schema && node.data.schema !== 'public' ? `${node.data.schema}.` : ''}
                {node.data.name}
              </text>
              
              {/* Columns list */}
              {node.data.columns.slice(0, 7).map((col, idx) => (
                <text
                  key={col.name}
                  x={12}
                  y={46 + idx * 14}
                  fill="hsl(var(--foreground))"
                  fontSize={9}
                  style={{ pointerEvents: 'none' }}
                  className="font-mono"
                >
                  <tspan fill={col.primaryKey ? 'hsl(var(--accent))' : 'hsl(var(--muted-foreground))'}>
                    {col.primaryKey ? '🔑' : '  '} 
                  </tspan>
                  <tspan fontWeight={col.primaryKey ? 'bold' : 'normal'}>
                    {col.name}
                  </tspan>
                  <tspan fill="hsl(var(--muted-foreground))">
                    : {col.type}{col.nullable ? '?' : ''}
                  </tspan>
                </text>
              ))}

              {/* Overflow columns count indicator */}
              {node.data.columns.length > 7 && (
                <text
                  x={12}
                  y={46 + 7 * 14}
                  fill="hsl(var(--muted-foreground))"
                  fontSize={8}
                  style={{ pointerEvents: 'none' }}
                  className="italic"
                >
                  ... +{node.data.columns.length - 7} more columns
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
