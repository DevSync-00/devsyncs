import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import type { NormalizedSchema, Table, LayoutState } from '../schema/types'
import type { SchemaDiff } from '../diff/types'

type Node = {
  id: string
  type: 'table'
  data: {
    name: string
    schema?: string
    columns: Array<{ name: string; type: string; nullable: boolean; primaryKey: boolean }>
    diffStatus?: 'add' | 'remove' | 'change' | null
  }
  position: { x: number; y: number }
}

type Edge = {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  style?: { stroke?: string }
  label?: string
}

const getDiffColor = (action: 'add' | 'remove' | 'change' | undefined): string => {
  switch (action) {
    case 'add':
      return '#4ade80' // green
    case 'remove':
      return '#f87171' // red
    case 'change':
      return '#fbbf24' // yellow
    default:
      return 'var(--vscode-editor-foreground)'
  }
}

const getTableDiffStatus = (
  tableName: string,
  schema: string | undefined,
  diffs: SchemaDiff[],
  allowedActions: Set<string>,
): 'add' | 'remove' | 'change' | null => {
  const key = `${schema ?? ''}:${tableName}`
  const tableDiffs = diffs.filter((d) => {
    if (d.target === 'table') {
      const payload = d.payload as any
      return `${payload.schema ?? ''}:${payload.name}` === key
    }
    if (d.target === 'column' || d.target === 'index' || d.target === 'constraint') {
      const payload = d.payload as any
      return `${schema ?? ''}:${payload.table}` === key
    }
    return false
  })
  const add = tableDiffs.some((d) => d.action === 'add' && allowedActions.has('add'))
  const remove = tableDiffs.some((d) => d.action === 'remove' && allowedActions.has('remove'))
  const change = tableDiffs.some((d) => d.action === 'change' && allowedActions.has('change'))
  if (add) return 'add'
  if (remove) return 'remove'
  if (change) return 'change'
  return null
}

export const GraphRenderer: React.FC<{
  schema: NormalizedSchema
  diffs?: SchemaDiff[]
  width: number
  height: number
  searchQuery?: string
  relationshipSearch?: string
  showAdd?: boolean
  showRemove?: boolean
  showChange?: boolean
  layout?: LayoutState
  onTableClick?: (table: Table) => void
  onLayoutChange?: (layout: LayoutState) => void
}> = ({
  schema,
  diffs = [],
  width,
  height,
  searchQuery = '',
  relationshipSearch = '',
  showAdd = true,
  showRemove = true,
  showChange = true,
  layout,
  onTableClick,
  onLayoutChange,
}) => {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [hoveredRelationship, setHoveredRelationship] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // State for node positions (can be modified by dragging)
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({})

  // Initialize positions from layout or compute default grid
  useEffect(() => {
    if (layout?.tablePositions) {
      setNodePositions(layout.tablePositions)
    } else {
      // Compute default grid positions
      const allTables = schema.tables || []
      const cols = Math.ceil(Math.sqrt(allTables.length))
      const spacing = 250
      const positions: Record<string, { x: number; y: number }> = {}
      
      allTables.forEach((table, idx) => {
        const row = Math.floor(idx / cols)
        const col = idx % cols
        const key = `${table.schema ?? ''}:${table.name}`
        positions[key] = { x: col * spacing + 100, y: row * spacing + 100 }
      })
      
      setNodePositions(positions)
    }
  }, [schema.tables, layout])

  const { nodes, edges, bounds } = useMemo(() => {
    const tableNodes: Node[] = []
    const relationshipEdges: Edge[] = []

    const allowedActions = new Set<string>()
    if (showAdd) allowedActions.add('add')
    if (showRemove) allowedActions.add('remove')
    if (showChange) allowedActions.add('change')

    // Filter tables by search query
    const allTables = schema.tables || []
    const query = searchQuery.toLowerCase().trim()
    const tables = query
      ? allTables.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            (t.schema && t.schema.toLowerCase().includes(query)) ||
            (t.columns || []).some((c) => c.name.toLowerCase().includes(query)),
        )
      : allTables
    const nodeWidth = 200
    const nodeHeight = 150

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    tables.forEach((table) => {
      const key = `${table.schema ?? ''}:${table.name}`
      const savedPos = nodePositions[key]
      const diffStatus = getTableDiffStatus(table.name, table.schema, diffs, allowedActions)
      
      // Use saved position or default to (0, 0) if not found
      const x = savedPos?.x ?? 0
      const y = savedPos?.y ?? 0

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + nodeWidth)
      maxY = Math.max(maxY, y + nodeHeight)

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
      })
    })

    // Create relationship edges (only for visible tables)
    const visibleTableIds = new Set(tableNodes.map((n) => n.id))
    const relationships = schema.relationships || []
    const relQuery = relationshipSearch.toLowerCase().trim()
    relationships.forEach((rel) => {
      // Find source and target tables to get their schema
      const sourceTable = schema.tables.find((t) => t.name === rel.sourceTable)
      const targetTable = schema.tables.find((t) => t.name === rel.targetTable)
      const sourceKey = `${sourceTable?.schema ?? ''}:${rel.sourceTable}`
      const targetKey = `${targetTable?.schema ?? ''}:${rel.targetTable}`
      
      // Only show relationships if both source and target are visible
      if (!visibleTableIds.has(sourceKey) || !visibleTableIds.has(targetKey)) {
        return
      }
      
      const sourceNode = tableNodes.find((n) => n.id === sourceKey)
      const targetNode = tableNodes.find((n) => n.id === targetKey)

      if (sourceNode && targetNode) {
        const relDiff = diffs.find(
          (d) =>
            d.target === 'relationship' &&
            (d.payload as any).sourceTable === rel.sourceTable &&
            (d.payload as any).targetTable === rel.targetTable,
        )
        if (relDiff && !allowedActions.has(relDiff.action)) {
          return
        }

        const relLabel = `${rel.sourceTable}.${rel.sourceColumn}->${rel.targetTable}.${rel.targetColumn}`.toLowerCase()
        if (
          relQuery &&
          !relLabel.includes(relQuery) &&
          !rel.sourceTable.toLowerCase().includes(relQuery) &&
          !rel.targetTable.toLowerCase().includes(relQuery)
        ) {
          return
        }

        const edgeColor = getDiffColor(relDiff?.action)

        relationshipEdges.push({
          id: `rel-${rel.id}`,
          source: sourceKey,
          target: targetKey,
          sourceHandle: `${rel.sourceTable}:${rel.sourceColumn}`,
          targetHandle: `${rel.targetTable}:${rel.targetColumn}`,
          style: { stroke: edgeColor },
          label: `${rel.sourceCardinality || '?'}:${rel.targetCardinality || '?'}`,
        })
      }
    })

    return {
      nodes: tableNodes,
      edges: relationshipEdges,
      bounds: { minX, minY, maxX, maxY },
    }
  }, [schema, diffs, searchQuery, relationshipSearch, nodePositions, showAdd, showRemove, showChange])

  // Auto-fit on mount
  useEffect(() => {
    if (bounds && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth
      const containerHeight = containerRef.current.clientHeight
      const contentWidth = bounds.maxX - bounds.minX + 200
      const contentHeight = bounds.maxY - bounds.minY + 200

      const scaleX = containerWidth / contentWidth
      const scaleY = containerHeight / contentHeight
      const newZoom = Math.min(scaleX, scaleY, 1) * 0.9

      setZoom(newZoom)
      setPan({
        x: (containerWidth - contentWidth * newZoom) / 2 - bounds.minX * newZoom,
        y: (containerHeight - contentHeight * newZoom) / 2 - bounds.minY * newZoom,
      })
    }
  }, [bounds])

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation()
      if (e.button === 0) {
        setDraggedNodeId(nodeId)
        const node = nodes.find((n) => n.id === nodeId)
        if (node) {
          const svgRect = svgRef.current?.getBoundingClientRect()
          if (svgRect) {
            const mouseX = (e.clientX - svgRect.left - pan.x) / zoom
            const mouseY = (e.clientY - svgRect.top - pan.y) / zoom
            setDragStart({
              x: mouseX - node.position.x,
              y: mouseY - node.position.y,
            })
          }
        }
      }
    },
    [nodes, pan, zoom],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0 && !draggedNodeId) {
        setIsDragging(true)
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      }
    },
    [pan, draggedNodeId],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggedNodeId) {
        const node = nodes.find((n) => n.id === draggedNodeId)
        if (node && svgRef.current) {
          const svgRect = svgRef.current.getBoundingClientRect()
          const mouseX = (e.clientX - svgRect.left - pan.x) / zoom
          const mouseY = (e.clientY - svgRect.top - pan.y) / zoom
          const newX = mouseX - dragStart.x
          const newY = mouseY - dragStart.y

          setNodePositions((prev) => {
            const updated = { ...prev, [draggedNodeId]: { x: newX, y: newY } }
            // Save layout after a short debounce
            if (onLayoutChange) {
              setTimeout(() => {
                onLayoutChange({ tablePositions: updated })
              }, 100)
            }
            return updated
          })
        }
      } else if (isDragging) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
      }
    },
    [isDragging, dragStart, draggedNodeId, nodes, pan, zoom, onLayoutChange],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDraggedNodeId(null)
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.1, Math.min(2, zoom * delta))
      setZoom(newZoom)
    },
    [zoom],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(2, z * 1.1))
        e.preventDefault()
      } else if (e.key === '-' || e.key === '_') {
        setZoom((z) => Math.max(0.1, z * 0.9))
        e.preventDefault()
      } else if (e.key === 'ArrowUp') {
        setPan((p) => ({ x: p.x, y: p.y + 40 }))
        e.preventDefault()
      } else if (e.key === 'ArrowDown') {
        setPan((p) => ({ x: p.x, y: p.y - 40 }))
        e.preventDefault()
      } else if (e.key === 'ArrowLeft') {
        setPan((p) => ({ x: p.x + 40, y: p.y }))
        e.preventDefault()
      } else if (e.key === 'ArrowRight') {
        setPan((p) => ({ x: p.x - 40, y: p.y }))
        e.preventDefault()
      }
    },
    [],
  )

  const handleFitView = useCallback(() => {
    if (bounds && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth
      const containerHeight = containerRef.current.clientHeight
      const contentWidth = bounds.maxX - bounds.minX + 200
      const contentHeight = bounds.maxY - bounds.minY + 200

      const scaleX = containerWidth / contentWidth
      const scaleY = containerHeight / contentHeight
      const newZoom = Math.min(scaleX, scaleY, 1) * 0.9

      setZoom(newZoom)
      setPan({
        x: (containerWidth - contentWidth * newZoom) / 2 - bounds.minX * newZoom,
        y: (containerHeight - contentHeight * newZoom) / 2 - bounds.minY * newZoom,
      })
    }
  }, [bounds])

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--vscode-editor-background)',
        cursor: draggedNodeId ? 'grabbing' : isDragging ? 'grabbing' : 'grab',
      }}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
    >
      {/* Controls */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <button
          onClick={() => setZoom((z) => Math.min(2, z * 1.2))}
          style={{
            padding: '4px 8px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.1, z * 0.8))}
          style={{
            padding: '4px 8px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          −
        </button>
        <button
          onClick={handleFitView}
          style={{
            padding: '4px 8px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 10,
          }}
          title="Fit to view"
        >
          Fit
        </button>
        <div
          style={{
            padding: '2px 6px',
            background: 'var(--vscode-editorWidget-background)',
            borderRadius: 4,
            fontSize: 10,
            textAlign: 'center',
          }}
        >
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Graph canvas */}
      <svg
        ref={svgRef}
        width={width * 2}
        height={height * 2}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Render edges */}
        {edges.map((edge) => {
          const sourceNode = nodes.find((n) => n.id === edge.source)
          const targetNode = nodes.find((n) => n.id === edge.target)
          if (!sourceNode || !targetNode) return null

          const x1 = sourceNode.position.x + 100
          const y1 = sourceNode.position.y + 75
          const x2 = targetNode.position.x + 100
          const y2 = targetNode.position.y + 75

          // Create curved path for better visualization
          const dx = x2 - x1
          const dy = y2 - y1
          const midX = (x1 + x2) / 2
          const midY = (y1 + y2) / 2
          // Control point for curve (perpendicular offset)
          const offset = Math.min(50, Math.abs(dx) * 0.3)
          const cpX = midX + (dy > 0 ? offset : -offset)
          const cpY = midY - (dx > 0 ? offset : -offset)

          const isHovered = hoveredRelationship === edge.id
          const strokeColor = edge.style?.stroke || 'var(--vscode-editor-foreground)'
          const strokeWidth = isHovered ? 3 : 2
          const opacity = isHovered ? 1 : 0.6

          return (
            <g
              key={edge.id}
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
                style={{ cursor: 'pointer' }}
              />
              {edge.label && (
                <text
                  x={cpX}
                  y={cpY - 5}
                  fill={strokeColor}
                  fontSize={isHovered ? 11 : 10}
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  textAnchor="middle"
                  style={{ pointerEvents: 'none' }}
                >
                  <tspan
                    x={cpX}
                    dy="0"
                    fill="var(--vscode-editorWidget-background)"
                    stroke="var(--vscode-editorWidget-background)"
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
          )
        })}

        {/* Arrow marker */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="var(--vscode-editor-foreground)" />
          </marker>
        </defs>

        {/* Render nodes */}
        {nodes.map((node) => {
          const borderColor = getDiffColor(node.data.diffStatus || undefined)
          const table = schema.tables.find(
            (t) => `${t.schema ?? ''}:${t.name}` === node.id,
          )
          const isDragging = draggedNodeId === node.id
          // Check if this node is connected to the hovered relationship
          const isConnectedToHovered = hoveredRelationship
            ? edges.some(
                (e) =>
                  e.id === hoveredRelationship && (e.source === node.id || e.target === node.id),
              )
            : false
          const finalStrokeWidth =
            node.data.diffStatus ? 3 : isDragging ? 2 : isConnectedToHovered ? 2 : 1
          const finalOpacity = isConnectedToHovered ? 0.9 : 1
          return (
            <g key={node.id} transform={`translate(${node.position.x}, ${node.position.y})`}>
              {/* Table box */}
              <rect
                width={200}
                height={150}
                fill="var(--vscode-editorWidget-background)"
                stroke={borderColor}
                strokeWidth={finalStrokeWidth}
                rx={4}
                opacity={finalOpacity}
                style={{ cursor: isDragging ? 'grabbing' : 'move' }}
                onClick={(e) => {
                  e.stopPropagation()
                  table && onTableClick?.(table)
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              />
              {/* Table name */}
              <text
                x={100}
                y={20}
                fill="var(--vscode-editor-foreground)"
                fontSize={12}
                fontWeight="bold"
                textAnchor="middle"
                style={{ pointerEvents: 'none' }}
              >
                {node.data.schema ? `${node.data.schema}.` : ''}
                {node.data.name}
              </text>
              {/* Columns */}
              {node.data.columns.slice(0, 8).map((col, idx) => (
                <text
                  key={col.name}
                  x={10}
                  y={35 + idx * 14}
                  fill="var(--vscode-editor-foreground)"
                  fontSize={10}
                  style={{ pointerEvents: 'none' }}
                >
                  {col.primaryKey ? '🔑 ' : ''}
                  {col.name}: {col.type}
                  {col.nullable ? '?' : ''}
                </text>
              ))}
              {node.data.columns.length > 8 && (
                <text
                  x={10}
                  y={35 + 8 * 14}
                  fill="var(--vscode-editor-foreground)"
                  fontSize={9}
                  opacity={0.7}
                  style={{ pointerEvents: 'none' }}
                >
                  ... +{node.data.columns.length - 8} more
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
