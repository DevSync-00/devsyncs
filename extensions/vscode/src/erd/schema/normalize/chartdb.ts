import { randomUUID } from 'node:crypto'

import type {
  Column,
  Constraint,
  CustomType,
  EnumType,
  Extension,
  Index,
  NormalizedSchema,
  Table,
} from '../types'
import { deriveRelationships } from '../relationships'

// Minimal shape matching ChartDB DatabaseMetadata smart-query output.
export type ChartdbForeignKey = {
  foreign_key_name: string
  schema: string
  table: string
  column: string
  reference_schema: string
  reference_table: string
  reference_column: string
  fk_def?: string
}

export type ChartdbPrimaryKey = {
  schema: string
  table: string
  column: string
  pk_def?: string
}

export type ChartdbIndex = {
  schema: string
  table: string
  name: string
  column: string
  index_type?: string
  unique?: string | boolean
  direction?: string
  column_position?: number
}

export type ChartdbColumn = {
  schema: string
  table: string
  name: string
  type: string
  character_maximum_length?: string | null
  precision?: { precision: number | null; scale: number | null } | null
  nullable: boolean
  default?: string | null
  collation?: string | null
  comment?: string | null
  is_identity?: boolean
  is_array?: boolean
}

export type ChartdbTable = {
  schema: string
  table: string
  type: string
  comment?: string | null
}

export type ChartdbCustomType =
  | {
      schema: string
      type: string
      kind: 'enum'
      values: string[]
    }
  | {
      schema: string
      type: string
      kind: 'composite'
      fields: { field: string; type: string }[]
    }

export type ChartdbMetadata = {
  fk_info: ChartdbForeignKey[]
  pk_info: ChartdbPrimaryKey[]
  indexes: ChartdbIndex[]
  columns: ChartdbColumn[]
  tables: ChartdbTable[]
  custom_types?: ChartdbCustomType[]
  database_name?: string
}

const groupByTable = <T extends { schema: string; table: string }>(
  rows: T[],
) => {
  const map = new Map<string, T[]>()
  rows.forEach((row) => {
    const key = `${row.schema ?? ''}.${row.table}`
    const existing = map.get(key) ?? []
    existing.push(row)
    map.set(key, existing)
  })
  return map
}

const normalizeColumns = (
  cols: ChartdbColumn[],
  pkColumns: Set<string>,
  uniqueColumns: Set<string>,
): Column[] =>
  cols.map((col, idx) => ({
    id: randomUUID(),
    name: col.name,
    type: { id: col.type, name: col.type },
    length: col.character_maximum_length ?? null,
    precision: col.precision?.precision ?? null,
    scale: col.precision?.scale ?? null,
    nullable: Boolean(col.nullable),
    default: col.default ?? undefined,
    collation: col.collation ?? null,
    comment: col.comment ?? null,
    isPrimaryKey: pkColumns.has(col.name),
    isUnique: uniqueColumns.has(col.name),
    isArray: Boolean(col.is_array),
    isIdentity: Boolean(col.is_identity),
    // preserve order hint
    ...(idx >= 0 ? { position: idx } : {}),
  }))

const normalizeIndexes = (indexes: ChartdbIndex[]): Index[] =>
  indexes.map((idx) => ({
    id: randomUUID(),
    name: idx.name,
    unique: idx.unique === true || idx.unique === 'true',
    columns: [{ name: idx.column, position: idx.column_position }],
    type: idx.index_type?.toLowerCase(),
    isPrimaryKey: false,
  }))

const normalizeConstraints = (
  pkRows: ChartdbPrimaryKey[],
  fkRows: ChartdbForeignKey[],
  uniqueIndexes: Index[],
  tableName: string,
  schemaName?: string,
): Constraint[] => {
  const constraints: Constraint[] = []

  const pkColumns = pkRows
    .filter((pk) => pk.table === tableName && pk.schema === schemaName)
    .map((pk) => pk.column)
  if (pkColumns.length > 0) {
    constraints.push({
      id: randomUUID(),
      kind: 'PRIMARY_KEY',
      name: `${tableName}_pkey`,
      tableName,
      columns: pkColumns,
    })
  }

  fkRows
    .filter((fk) => fk.table === tableName && fk.schema === schemaName)
    .forEach((fk) => {
      constraints.push({
        id: randomUUID(),
        kind: 'FOREIGN_KEY',
        name: fk.foreign_key_name,
        tableName,
        columns: [fk.column],
        refTable: fk.reference_table,
        refColumns: [fk.reference_column],
        onUpdate: fk.fk_def,
        onDelete: fk.fk_def,
      })
    })

  uniqueIndexes.forEach((idx) => {
    constraints.push({
      id: randomUUID(),
      kind: 'UNIQUE',
      name: idx.name,
      tableName,
      columns: idx.columns.map((c) => c.name),
    })
  })

  return constraints
}

const normalizeTables = (metadata: ChartdbMetadata): Table[] => {
  const pkSet = new Set(
    metadata.pk_info.map(
      (pk) => `${pk.schema ?? ''}.${pk.table}.${pk.column}`,
    ),
  )

  const indexByTable = groupByTable(metadata.indexes)
  const columnsByTable = groupByTable(metadata.columns)

  return metadata.tables.map((tbl) => {
    const key = `${tbl.schema ?? ''}.${tbl.table}`
    const tableIndexes = indexByTable.get(key) ?? []
    const uniqueIdx = tableIndexes.filter(
      (idx) => idx.unique === true || idx.unique === 'true',
    )
    const normalizedIndexes = normalizeIndexes(tableIndexes)
    const pkColumns = new Set(
      Array.from(pkSet)
        .filter((k) => k.startsWith(`${tbl.schema ?? ''}.${tbl.table}.`))
        .map((k) => k.split('.').pop() ?? ''),
    )
    const uniqueColumns = new Set(
      uniqueIdx.map((idx) => idx.column).filter(Boolean),
    )
    const normalizedColumns = normalizeColumns(
      columnsByTable.get(key) ?? [],
      pkColumns,
      uniqueColumns,
    )
    const constraints = normalizeConstraints(
      metadata.pk_info,
      metadata.fk_info,
      normalizedIndexes.filter((i) => i.unique),
      tbl.table,
      tbl.schema,
    )

    return {
      id: randomUUID(),
      name: tbl.table,
      schema: tbl.schema,
      isView: tbl.type?.toLowerCase() === 'view',
      isMaterializedView: tbl.type?.toLowerCase() === 'materialized view',
      comment: tbl.comment ?? null,
      columns: normalizedColumns,
      indexes: normalizedIndexes,
      constraints,
    }
  })
}

const normalizeCustomTypes = (
  customTypes?: ChartdbCustomType[],
): CustomType[] => {
  if (!customTypes) return []
  return customTypes.map((ct) => ({
    id: randomUUID(),
    name: ct.type,
    schema: ct.schema,
    kind: ct.kind,
    values: 'values' in ct ? ct.values : undefined,
  }))
}

export const normalizeChartdbMetadata = (
  metadata: ChartdbMetadata,
): NormalizedSchema => {
  const tables = normalizeTables(metadata)

  const enums: EnumType[] =
    metadata.custom_types
      ?.filter((ct): ct is Extract<ChartdbCustomType, { kind: 'enum' }> => ct.kind === 'enum')
      .map((ct) => ({
        id: randomUUID(),
        name: ct.type,
        schema: ct.schema,
        values: ct.values,
      })) ?? []

  const extensions: Extension[] = []
  const customTypes = normalizeCustomTypes(metadata.custom_types)

  const schema: NormalizedSchema = {
    schemas: [],
    tables,
    relationships: [],
    enums,
    extensions,
    customTypes,
    dependencies: [],
  }

  // Derive relationships from foreign key constraints
  schema.relationships = deriveRelationships(schema)

  return schema
}

