'use client';

import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Background, BackgroundVariant, Controls, MarkerType, MiniMap, ReactFlow,
  ReactFlowProvider, SelectionMode, useEdgesState, useNodesState, useReactFlow,
  type Edge, type Node, type NodeChange, type Viewport,
} from '@xyflow/react';
import type { LayoutAlgorithm, LayoutState, NormalizedSchema, SchemaDiff, Table } from './types';
import { layoutSchema, tableHeight, TABLE_WIDTH } from './layout';
import { TableNode, type TableNodeData } from './TableNode';

interface Props {
  schema: NormalizedSchema; diffs?: SchemaDiff[]; searchQuery?: string; relationshipSearch?: string;
  showAdd?: boolean; showRemove?: boolean; showChange?: boolean; layout?: LayoutState;
  onTableClick?: (table: Table) => void; onLayoutChange?: (layout: LayoutState) => void;
  focusTableId?: string | null; layoutAlgorithm?: LayoutAlgorithm;
}

const nodeTypes = { table: TableNode };
const tableId = (table: Table) => `${table.schema || 'public'}:${table.name}`;

function Canvas({ schema, diffs = [], searchQuery = '', relationshipSearch = '', showAdd = true, showRemove = true, showChange = true, layout, onTableClick, onLayoutChange, focusTableId, layoutAlgorithm = 'horizontal' }: Props) {
  const { fitView, setCenter, getViewport } = useReactFlow();
  const collapsed = useMemo(() => new Set(layout?.collapsedTables || []), [layout?.collapsedTables]);
  const locked = useMemo(() => new Set(layout?.lockedTables || []), [layout?.lockedTables]);
  const hidden = useMemo(() => new Set(layout?.hiddenTables || []), [layout?.hiddenTables]);
  const query = searchQuery.trim().toLowerCase();
  const savedPositions = layout?.tablePositions;
  const positions = useMemo(() => savedPositions && Object.keys(savedPositions).length ? savedPositions : layoutSchema(schema, layoutAlgorithm), [savedPositions, layoutAlgorithm, schema]);
  const relationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    schema.relationships.forEach((rel) => { counts.set(rel.sourceTable, (counts.get(rel.sourceTable) || 0) + 1); counts.set(rel.targetTable, (counts.get(rel.targetTable) || 0) + 1); });
    return counts;
  }, [schema.relationships]);
  const toggleCollapseRef = useRef<(id: string) => void>(() => undefined);

  const visibleDiffActions = useMemo(() => new Set([showAdd ? 'add' : '', showRemove ? 'remove' : '', showChange ? 'change' : '']), [showAdd, showRemove, showChange]);
  const initialNodes = useMemo<Node<TableNodeData>[]>(() => schema.tables.filter((table) => !hidden.has(tableId(table))).map((table) => {
    const id = tableId(table); const isCollapsed = collapsed.has(id);
    const tableDiff = diffs.find((item) => (item.target === 'table' && item.payload?.name === table.name) || (item.target === 'column' && item.payload?.table === table.name));
    const diffColor = tableDiff && visibleDiffActions.has(tableDiff.action) ? tableDiff.action === 'add' ? '#10b981' : tableDiff.action === 'remove' ? '#f43f5e' : '#f59e0b' : undefined;
    const highlighted = !!query && (table.name.toLowerCase().includes(query) || table.schema?.toLowerCase().includes(query) || table.columns.some((column) => `${column.name} ${column.type.name}`.toLowerCase().includes(query)));
    return { id, type: 'table', position: positions[id] || { x: 0, y: 0 }, draggable: !locked.has(id), width: TABLE_WIDTH, height: tableHeight(table.columns.length, isCollapsed), data: { table, color: diffColor || layout?.tableColors?.[id] || table.color || 'hsl(var(--primary))', collapsed: isCollapsed, locked: locked.has(id), highlighted, relationshipCount: relationCounts.get(table.name) || 0, onToggleCollapse: (nodeId) => toggleCollapseRef.current(nodeId) } };
  }), [schema.tables, hidden, collapsed, locked, query, positions, layout?.tableColors, relationCounts, diffs, visibleDiffActions]);
  const initialEdges = useMemo<Edge[]>(() => {
    const visible = new Set(initialNodes.map((node) => node.id)); const relQuery = relationshipSearch.trim().toLowerCase();
    return schema.relationships.flatMap((rel) => {
      const sourceTable = schema.tables.find((table) => table.name === rel.sourceTable); const targetTable = schema.tables.find((table) => table.name === rel.targetTable);
      if (!sourceTable || !targetTable) return []; const source = tableId(sourceTable); const target = tableId(targetTable);
      const label = `${rel.sourceTable}.${rel.sourceColumn} → ${rel.targetTable}.${rel.targetColumn}`;
      if (!visible.has(source) || !visible.has(target) || (relQuery && !label.toLowerCase().includes(relQuery))) return [];
      const diff = diffs.find((item) => item.target === 'relationship' && item.payload?.sourceTable === rel.sourceTable && item.payload?.targetTable === rel.targetTable);
      if (diff && !visibleDiffActions.has(diff.action)) return [];
      const color = diff?.action === 'add' ? '#10b981' : diff?.action === 'remove' ? '#f43f5e' : diff?.action === 'change' ? '#f59e0b' : '#64748b';
      return [{ id: rel.id, source, target, label: `${rel.sourceCardinality === 'ONE' ? '1' : 'N'} : ${rel.targetCardinality === 'ONE' ? '1' : 'N'}`, ariaLabel: label, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color }, style: { stroke: color, strokeWidth: 1.5 }, labelStyle: { fill: '#94a3b8', fontSize: 9, fontFamily: 'monospace' }, interactionWidth: 18 }];
    });
  }, [schema, initialNodes, relationshipSearch, diffs, visibleDiffActions]);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes); const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]); useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);
  const emitLayout = useCallback((nextNodes: Node[]) => onLayoutChange?.({ ...layout, tablePositions: Object.fromEntries(nextNodes.map((node) => [node.id, node.position])), viewport: getViewport() }), [getViewport, layout, onLayoutChange]);
  const onNodesChange = useCallback((changes: NodeChange<Node<TableNodeData>>[]) => { onNodesChangeBase(changes); if (changes.some((change) => change.type === 'position' && !change.dragging)) setTimeout(() => setNodes((current) => { emitLayout(current); return current; }), 0); }, [emitLayout, onNodesChangeBase, setNodes]);
  toggleCollapseRef.current = (id) => onLayoutChange?.({ ...layout, tablePositions: Object.fromEntries(nodes.map((node) => [node.id, node.position])), collapsedTables: collapsed.has(id) ? [...collapsed].filter((item) => item !== id) : [...collapsed, id], viewport: getViewport() });
  useEffect(() => { if (focusTableId) { const node = nodes.find((item) => item.id === focusTableId); if (node) void setCenter(node.position.x + TABLE_WIDTH / 2, node.position.y + 80, { zoom: 1.2, duration: 500 }); } }, [focusTableId, nodes, setCenter]);
  const onMoveEnd = useCallback((_event: MouseEvent | TouchEvent | null, viewport: Viewport) => onLayoutChange?.({ ...layout, tablePositions: Object.fromEntries(nodes.map((node) => [node.id, node.position])), viewport }), [layout, nodes, onLayoutChange]);
  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeDoubleClick={(_, node) => onTableClick?.((node.data as TableNodeData).table)} onMoveEnd={onMoveEnd} defaultViewport={layout?.viewport || { x: 0, y: 0, zoom: 1 }} minZoom={0.05} maxZoom={2.5} fitView={!layout?.viewport} fitViewOptions={{ padding: 0.15, maxZoom: 1 }} snapToGrid={layout?.snapToGrid !== false} snapGrid={[16, 16]} selectionMode={SelectionMode.Partial} panOnDrag={[1, 2]} selectionOnDrag multiSelectionKeyCode={['Meta', 'Control']} deleteKeyCode={null} elevateNodesOnSelect onlyRenderVisibleElements colorMode="system" aria-label="Interactive database schema diagram">
    <Background variant={BackgroundVariant.Lines} gap={24} size={1} color="hsl(var(--border))" /><MiniMap pannable zoomable nodeColor={(node) => (node.data as TableNodeData).color} maskColor="hsl(var(--background) / .72)" className="!border !border-border !bg-card" /><Controls showInteractive={false} className="!border-border !bg-card [&_button]:!border-border [&_button]:!bg-card [&_button]:!fill-foreground [&_button:hover]:!bg-muted" />
    <button onClick={() => void fitView({ padding: .15, duration: 400 })} className="absolute bottom-4 left-16 z-10 rounded-md border bg-card px-2 py-1 font-mono text-[10px] text-foreground shadow-md hover:border-primary/60 hover:text-primary">Fit</button>
  </ReactFlow>;
}

export function GraphRenderer(props: Props) { return <ReactFlowProvider><div className="h-full w-full bg-muted/20"><Canvas {...props} /></div></ReactFlowProvider>; }
