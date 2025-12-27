import { randomUUID } from 'node:crypto'

import type { NormalizedSchema } from '../schema/types'
import type { SchemaDiff } from './types'

const asKey = (schema: string | undefined, name: string) =>
  `${schema ?? ''}:${name}`

export const diffSchemas = (
  before: NormalizedSchema,
  after: NormalizedSchema,
): SchemaDiff[] => {
  const diffs: SchemaDiff[] = []

  const beforeTables = new Map(before.tables.map((t) => [asKey(t.schema, t.name), t]))
  const afterTables = new Map(after.tables.map((t) => [asKey(t.schema, t.name), t]))

  // Table additions/removals
  for (const [key, table] of afterTables) {
    if (!beforeTables.has(key)) {
      diffs.push({
        id: randomUUID(),
        action: 'add',
        target: 'table',
        payload: { name: table.name, schema: table.schema },
      })
    }
  }
  for (const [key, table] of beforeTables) {
    if (!afterTables.has(key)) {
      diffs.push({
        id: randomUUID(),
        action: 'remove',
        target: 'table',
        payload: { name: table.name, schema: table.schema },
      })
    }
  }

  // Column-level changes (shallow)
  for (const [key, afterTable] of afterTables) {
    const beforeTable = beforeTables.get(key)
    if (!beforeTable) continue

    const beforeCols = new Map(beforeTable.columns.map((c) => [c.name, c]))
    const afterCols = new Map(afterTable.columns.map((c) => [c.name, c]))

    for (const [colName, col] of afterCols) {
      if (!beforeCols.has(colName)) {
        diffs.push({
          id: randomUUID(),
          action: 'add',
          target: 'column',
        payload: { table: afterTable.name, column: colName, after: col },
        })
      }
    }

    for (const [colName, col] of beforeCols) {
      if (!afterCols.has(colName)) {
        diffs.push({
          id: randomUUID(),
          action: 'remove',
          target: 'column',
        payload: { table: beforeTable.name, column: colName, before: col },
        })
      }
    }

    for (const [colName, col] of afterCols) {
      const prev = beforeCols.get(colName)
      if (!prev) continue
      const changed =
        prev.type.name !== col.type.name ||
        prev.nullable !== col.nullable ||
        prev.default !== col.default ||
        prev.isArray !== col.isArray ||
        prev.isIdentity !== col.isIdentity
      if (changed) {
        diffs.push({
          id: randomUUID(),
          action: 'change',
          target: 'column',
        payload: { table: afterTable.name, column: colName, before: prev, after: col },
        })
      }
    }
  }

  // Index changes
  for (const [key, afterTable] of afterTables) {
    const beforeTable = beforeTables.get(key)
    if (!beforeTable) continue
    const beforeIdx = new Map(beforeTable.indexes.map((i) => [i.name, i]))
    const afterIdx = new Map(afterTable.indexes.map((i) => [i.name, i]))

    for (const [idxName, idx] of afterIdx) {
      const prev = beforeIdx.get(idxName)
      if (!prev) {
        diffs.push({
          id: randomUUID(),
          action: 'add',
          target: 'index',
          payload: { table: afterTable.name, index: idxName, after: idx },
        })
        continue
      }
      const changed =
        prev.unique !== idx.unique ||
        (prev.columns || []).map((c) => c.name).join(',') !==
          (idx.columns || []).map((c) => c.name).join(',') ||
        prev.type !== idx.type
      if (changed) {
        diffs.push({
          id: randomUUID(),
          action: 'change',
          target: 'index',
          payload: { table: afterTable.name, index: idxName, before: prev, after: idx },
        })
      }
    }
    for (const [idxName, idx] of beforeIdx) {
      if (!afterIdx.has(idxName)) {
        diffs.push({
          id: randomUUID(),
          action: 'remove',
          target: 'index',
          payload: { table: beforeTable.name, index: idxName, before: idx },
        })
      }
    }
  }

  // Constraint changes (only identity by name/kind)
  for (const [key, afterTable] of afterTables) {
    const beforeTable = beforeTables.get(key)
    if (!beforeTable) continue
    const beforeConstraints = new Map(
      beforeTable.constraints.map((c) => [c.name ?? `${c.kind}:${c.tableName}`, c]),
    )
    const afterConstraints = new Map(
      afterTable.constraints.map((c) => [c.name ?? `${c.kind}:${c.tableName}`, c]),
    )

    for (const [cName, c] of afterConstraints) {
      const prev = beforeConstraints.get(cName)
      if (!prev) {
        diffs.push({
          id: randomUUID(),
          action: 'add',
          target: 'constraint',
          payload: { table: afterTable.name, constraint: cName, after: c },
        })
        continue
      }
      const changed =
        prev.kind !== c.kind ||
        JSON.stringify((prev as any).columns) !== JSON.stringify((c as any).columns) ||
        (prev as any).refTable !== (c as any).refTable ||
        (prev as any).refColumns?.join(',') !== (c as any).refColumns?.join(',')
      if (changed) {
        diffs.push({
          id: randomUUID(),
          action: 'change',
          target: 'constraint',
          payload: { table: afterTable.name, constraint: cName, before: prev, after: c },
        })
      }
    }
    for (const [cName, c] of beforeConstraints) {
      if (!afterConstraints.has(cName)) {
        diffs.push({
          id: randomUUID(),
          action: 'remove',
          target: 'constraint',
          payload: { table: beforeTable.name, constraint: cName, before: c },
        })
      }
    }
  }

  // Relationship changes
  const relKey = (r: any) =>
    `${r.sourceTable}->${r.targetTable}:${r.sourceColumn}:${r.targetColumn}`
  const beforeRels = new Map((before.relationships || []).map((r) => [relKey(r), r]))
  const afterRels = new Map((after.relationships || []).map((r) => [relKey(r), r]))
  for (const [k, r] of afterRels) {
    const prev = beforeRels.get(k)
    if (!prev) {
      diffs.push({
        id: randomUUID(),
        action: 'add',
        target: 'relationship',
        payload: { name: r.name, sourceTable: r.sourceTable, targetTable: r.targetTable },
      })
      continue
    }
    const changed =
      prev.sourceCardinality !== r.sourceCardinality ||
      prev.targetCardinality !== r.targetCardinality ||
      prev.onDelete !== r.onDelete ||
      prev.onUpdate !== r.onUpdate
    if (changed) {
      diffs.push({
        id: randomUUID(),
        action: 'change',
        target: 'relationship',
        payload: { name: r.name, sourceTable: r.sourceTable, targetTable: r.targetTable },
      })
    }
  }
  for (const [k, r] of beforeRels) {
    if (!afterRels.has(k)) {
      diffs.push({
        id: randomUUID(),
        action: 'remove',
        target: 'relationship',
        payload: { name: r.name, sourceTable: r.sourceTable, targetTable: r.targetTable },
      })
    }
  }

  // Enums
  const beforeEnums = new Map((before.enums || []).map((e) => [asKey(e.schema, e.name), e]))
  const afterEnums = new Map((after.enums || []).map((e) => [asKey(e.schema, e.name), e]))
  for (const [k, e] of afterEnums) {
    const prev = beforeEnums.get(k)
    if (!prev) {
      diffs.push({ id: randomUUID(), action: 'add', target: 'enum', payload: { name: e.name } })
    } else if (prev.values.join(',') !== e.values.join(',')) {
      diffs.push({
        id: randomUUID(),
        action: 'change',
        target: 'enum',
        payload: { name: e.name },
      })
    }
  }
  for (const [k, e] of beforeEnums) {
    if (!afterEnums.has(k)) {
      diffs.push({
        id: randomUUID(),
        action: 'remove',
        target: 'enum',
        payload: { name: e.name },
      })
    }
  }

  // Extensions
  const beforeExt = new Set((before.extensions || []).map((e) => e.name))
  const afterExt = new Set((after.extensions || []).map((e) => e.name))
  for (const name of afterExt) {
    if (!beforeExt.has(name)) {
      diffs.push({
        id: randomUUID(),
        action: 'add',
        target: 'extension',
        payload: { name },
      })
    }
  }
  for (const name of beforeExt) {
    if (!afterExt.has(name)) {
      diffs.push({
        id: randomUUID(),
        action: 'remove',
        target: 'extension',
        payload: { name },
      })
    }
  }

  // Custom types
  const beforeCt = new Map((before.customTypes || []).map((c) => [asKey(c.schema, c.name), c]))
  const afterCt = new Map((after.customTypes || []).map((c) => [asKey(c.schema, c.name), c]))
  for (const [k, c] of afterCt) {
    const prev = beforeCt.get(k)
    if (!prev) {
      diffs.push({
        id: randomUUID(),
        action: 'add',
        target: 'customType',
        payload: { name: c.name, schema: c.schema },
      })
      continue
    }
    const changed = JSON.stringify(prev) !== JSON.stringify(c)
    if (changed) {
      diffs.push({
        id: randomUUID(),
        action: 'change',
        target: 'customType',
        payload: { name: c.name, schema: c.schema },
      })
    }
  }
  for (const [k, c] of beforeCt) {
    if (!afterCt.has(k)) {
      diffs.push({
        id: randomUUID(),
        action: 'remove',
        target: 'customType',
        payload: { name: c.name, schema: c.schema },
      })
    }
  }

  return diffs
}

