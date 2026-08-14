import dagre from '@dagrejs/dagre';
import type { LayoutAlgorithm, NormalizedSchema } from './types';

export const TABLE_WIDTH = 288;
export const TABLE_HEADER = 54;
export const COLUMN_HEIGHT = 28;

export function tableHeight(columnCount: number, collapsed = false) {
  return collapsed ? TABLE_HEADER : TABLE_HEADER + Math.min(columnCount, 30) * COLUMN_HEIGHT + 34;
}

export function layoutSchema(schema: NormalizedSchema, algorithm: LayoutAlgorithm) {
  if (algorithm === 'grid') {
    const columns = Math.max(1, Math.ceil(Math.sqrt(schema.tables.length)));
    return Object.fromEntries(schema.tables.map((table, index) => [
      `${table.schema || 'public'}:${table.name}`,
      { x: (index % columns) * 360, y: Math.floor(index / columns) * 360 },
    ]));
  }

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: algorithm === 'horizontal' ? 'LR' : 'TB',
    nodesep: 70,
    ranksep: 110,
    marginx: 40,
    marginy: 40,
  });
  const byName = new Map(schema.tables.map((table) => [table.name, `${table.schema || 'public'}:${table.name}`]));
  for (const table of schema.tables) {
    graph.setNode(`${table.schema || 'public'}:${table.name}`, {
      width: TABLE_WIDTH,
      height: tableHeight(table.columns.length),
    });
  }
  for (const relationship of schema.relationships) {
    const source = byName.get(relationship.sourceTable);
    const target = byName.get(relationship.targetTable);
    if (source && target) graph.setEdge(source, target);
  }
  dagre.layout(graph);
  return Object.fromEntries(graph.nodes().map((id) => {
    const node = graph.node(id);
    return [id, { x: node.x - node.width / 2, y: node.y - node.height / 2 }];
  }));
}
