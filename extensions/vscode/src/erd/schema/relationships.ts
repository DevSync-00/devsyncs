import { randomUUID } from 'node:crypto'

import type {
  Cardinality,
  Constraint,
  ForeignKeyConstraint,
  NormalizedSchema,
  Relationship,
  Table,
} from './types'

type ConstraintMap = Record<string, Constraint[]>

const asConstraintMap = (tables: Table[]): ConstraintMap =>
  tables.reduce<ConstraintMap>((acc, table) => {
    acc[table.name] = table.constraints ?? []
    return acc
  }, {})

const isForeignKey = (c: Constraint): c is ForeignKeyConstraint =>
  c.kind === 'FOREIGN_KEY'

const hasMatchingUnique = (table: Table, columns: string[]): boolean => {
  const uniques =
    table.constraints?.filter((c) => c.kind === 'UNIQUE') ?? []
  for (const unique of uniques) {
    if (
      unique.kind === 'UNIQUE' &&
      unique.columns.length === columns.length &&
      unique.columns.every((col) => columns.includes(col))
    ) {
      return true
    }
  }
  return false
}

const deriveCardinality = (
  fkTable: Table,
  fkColumns: string[],
): Cardinality => {
  return hasMatchingUnique(fkTable, fkColumns) ? 'ONE' : 'MANY'
}

export const deriveRelationships = (
  schema: NormalizedSchema,
): Relationship[] => {
  const constraints = asConstraintMap(schema.tables)
  const byName = new Map(schema.tables.map((t) => [t.name, t]))

  const relationships: Relationship[] = []

  for (const table of schema.tables) {
    const tableConstraints = constraints[table.name] ?? []
    for (const constraint of tableConstraints) {
      if (!isForeignKey(constraint)) continue

      const targetTable = byName.get(constraint.refTable)
      if (!targetTable) continue

      const sourceCardinality = 'ONE'
      const targetCardinality = deriveCardinality(
        table,
        constraint.columns,
      )

      const columnPairs = constraint.columns.map((col, idx) => ({
        source: constraint.refColumns[idx],
        target: col,
      }))

      columnPairs.forEach((pair, pairIdx) => {
        const name =
          constraint.name ||
          `fk_${table.name}_${constraint.refTable}_${pair.target}`
        relationships.push({
          id: randomUUID(),
          name: columnPairs.length > 1 ? `${name}_${pairIdx}` : name,
          sourceTable: constraint.refTable,
          targetTable: table.name,
          sourceColumn: pair.source,
          targetColumn: pair.target,
          sourceCardinality,
          targetCardinality,
          onUpdate: constraint.onUpdate,
          onDelete: constraint.onDelete,
        })
      })
    }
  }

  return relationships
}

