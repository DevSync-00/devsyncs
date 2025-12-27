import { randomUUID } from 'node:crypto'

import { deriveRelationships } from '../relationships'
import type {
  Column,
  Constraint,
  Extension,
  NormalizedSchema,
  Table,
  EnumType,
  CustomType,
} from '../types'

type LiamConstraint =
  | {
      type: 'PRIMARY KEY'
      name: string
      columnNames: string[]
    }
  | {
      type: 'FOREIGN KEY'
      name: string
      columnNames: string[]
      targetTableName: string
      targetColumnNames: string[]
      updateConstraint?: string
      deleteConstraint?: string
    }
  | {
      type: 'UNIQUE'
      name: string
      columnNames: string[]
    }
  | {
      type: 'CHECK'
      name: string
      detail: string
    }

type LiamIndex = {
  name: string
  unique: boolean
  columns: string[]
  type: string
}

type LiamColumn = {
  name: string
  type: string
  default: string | number | boolean | null
  check: string | null
  notNull: boolean
  comment: string | null
}

type LiamTable = {
  name: string
  columns: Record<string, LiamColumn>
  comment: string | null
  indexes: Record<string, LiamIndex>
  constraints: Record<string, LiamConstraint>
}

export type LiamSchema = {
  tables: Record<string, LiamTable>
  enums?: Record<string, { name: string; values: string[]; comment?: string | null }>
  extensions?: Record<string, { name: string }>
}

const normalizeColumns = (
  table: LiamTable,
  pkColumns: Set<string>,
  uniqueColumns: Set<string>,
): Column[] => {
  return Object.values(table.columns).map((col) => ({
    id: randomUUID(),
    name: col.name,
    type: { id: col.type, name: col.type },
    length: null,
    precision: null,
    scale: null,
    nullable: !col.notNull,
    default: col.default ?? undefined,
    collation: null,
    comment: col.comment ?? null,
    isPrimaryKey: pkColumns.has(col.name),
    isUnique: uniqueColumns.has(col.name),
  }))
}

const normalizeConstraints = (table: LiamTable): Constraint[] => {
  const constraints: Constraint[] = []
  for (const value of Object.values(table.constraints)) {
    if (value.type === 'PRIMARY KEY') {
      constraints.push({
        id: randomUUID(),
        kind: 'PRIMARY_KEY',
        name: value.name,
        tableName: table.name,
        columns: value.columnNames,
      })
    } else if (value.type === 'FOREIGN KEY') {
      constraints.push({
        id: randomUUID(),
        kind: 'FOREIGN_KEY',
        name: value.name,
        tableName: table.name,
        columns: value.columnNames,
        refTable: value.targetTableName,
        refColumns: value.targetColumnNames,
        onUpdate: value.updateConstraint,
        onDelete: value.deleteConstraint,
      })
    } else if (value.type === 'UNIQUE') {
      constraints.push({
        id: randomUUID(),
        kind: 'UNIQUE',
        name: value.name,
        tableName: table.name,
        columns: value.columnNames,
      })
    } else if (value.type === 'CHECK') {
      constraints.push({
        id: randomUUID(),
        kind: 'CHECK',
        name: value.name,
        tableName: table.name,
        expression: value.detail,
      })
    }
  }
  return constraints
}

const normalizeIndexes = (table: LiamTable): Table['indexes'] => {
  return Object.values(table.indexes).map((idx) => ({
    id: randomUUID(),
    name: idx.name,
    unique: idx.unique,
    columns: idx.columns.map((name, position) => ({ name, position })),
    type: idx.type,
  }))
}

const normalizeTables = (liamTables: Record<string, LiamTable>): Table[] => {
  return Object.values(liamTables).map((table) => {
    const constraints = normalizeConstraints(table)
    const pkColumns = new Set(
      constraints
        .filter((c) => c.kind === 'PRIMARY_KEY')
        .flatMap((c) => (c.kind === 'PRIMARY_KEY' ? c.columns : [])),
    )
    const uniqueColumns = new Set(
      constraints
        .filter((c) => c.kind === 'UNIQUE')
        .flatMap((c) => (c.kind === 'UNIQUE' ? c.columns : [])),
    )

    const columns = normalizeColumns(table, pkColumns, uniqueColumns)

    return {
      id: randomUUID(),
      name: table.name,
      schema: undefined,
      isView: false,
      isMaterializedView: false,
      comment: table.comment ?? null,
      columns,
      indexes: normalizeIndexes(table),
      constraints,
    }
  })
}

const normalizeEnums = (
  enums?: Record<string, { name: string; values: string[]; comment?: string | null }>,
): EnumType[] => {
  if (!enums) return []
  return Object.values(enums).map((enm) => ({
    id: randomUUID(),
    name: enm.name,
    values: enm.values,
    comment: enm.comment ?? null,
  }))
}

const normalizeExtensions = (
  extensions?: Record<string, { name: string }>,
): Extension[] => {
  if (!extensions) return []
  return Object.values(extensions).map((ext) => ({
    id: randomUUID(),
    name: ext.name,
  }))
}

export const normalizeLiamSchema = (schema: LiamSchema): NormalizedSchema => {
  const tables = normalizeTables(schema.tables)
  const relationships = deriveRelationships({
    schemas: [],
    tables,
    relationships: [],
    enums: [],
    extensions: [],
    customTypes: [],
    dependencies: [],
  })

  const enums = normalizeEnums(schema.enums)
  const extensions = normalizeExtensions(schema.extensions)

  const customTypes: CustomType[] = []

  return {
    schemas: [],
    tables,
    relationships,
    enums,
    extensions,
    customTypes,
    dependencies: [],
  }
}

