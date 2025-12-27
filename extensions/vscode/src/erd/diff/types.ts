export type DiffAction = 'add' | 'remove' | 'change'

export type DiffTarget =
  | 'table'
  | 'column'
  | 'index'
  | 'constraint'
  | 'relationship'
  | 'enum'
  | 'extension'
  | 'customType'

export interface BaseDiff<TPayload> {
  id: string
  action: DiffAction
  target: DiffTarget
  payload: TPayload
}

export type TableDiff = BaseDiff<{
  name: string
  schema?: string
}>

export type ColumnDiff = BaseDiff<{
  table: string
  column: string
  before?: unknown
  after?: unknown
}>

export type IndexDiff = BaseDiff<{
  table: string
  index: string
  before?: unknown
  after?: unknown
}>

export type ConstraintDiff = BaseDiff<{
  table: string
  constraint: string
  before?: unknown
  after?: unknown
}>

export type RelationshipDiff = BaseDiff<{
  name: string
  sourceTable: string
  targetTable: string
}>

export type EnumDiff = BaseDiff<{
  name: string
}>

export type ExtensionDiff = BaseDiff<{
  name: string
}>

export type CustomTypeDiff = BaseDiff<{
  name: string
  schema?: string
}>

export type SchemaDiff =
  | TableDiff
  | ColumnDiff
  | IndexDiff
  | ConstraintDiff
  | RelationshipDiff
  | EnumDiff
  | ExtensionDiff
  | CustomTypeDiff

