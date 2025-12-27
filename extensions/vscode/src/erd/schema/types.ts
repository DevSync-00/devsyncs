/**
 * Dialect-agnostic, normalized schema model for ERD + diff rendering.
 */
export type UUID = string

export interface SchemaNamespace {
  id: UUID
  name: string
}

export interface Table {
  id: UUID
  name: string
  schema?: string
  isView?: boolean
  isMaterializedView?: boolean
  comment?: string | null
  columns: Column[]
  indexes: Index[]
  constraints: Constraint[]
  createdAt?: number
  position?: {
    x: number
    y: number
  }
  color?: string
}

export interface Column {
  id: UUID
  name: string
  type: {
    id: string
    name: string
  }
  length?: string | null
  precision?: number | null
  scale?: number | null
  nullable: boolean
  default?: string | number | boolean | null
  collation?: string | null
  comment?: string | null
  isPrimaryKey?: boolean
  isUnique?: boolean
  isArray?: boolean
  isIdentity?: boolean
}

export interface Index {
  id: UUID
  name: string
  unique: boolean
  columns: { name: string; position?: number; order?: 'asc' | 'desc' }[]
  type?: string
  isPrimaryKey?: boolean
}

export type ConstraintKind = 'PRIMARY_KEY' | 'FOREIGN_KEY' | 'UNIQUE' | 'CHECK'

export interface ConstraintBase {
  id: UUID
  name: string
  tableName: string
  kind: ConstraintKind
}

export interface PrimaryKeyConstraint extends ConstraintBase {
  kind: 'PRIMARY_KEY'
  columns: string[]
}

export interface ForeignKeyConstraint extends ConstraintBase {
  kind: 'FOREIGN_KEY'
  columns: string[]
  refTable: string
  refColumns: string[]
  onUpdate?: string
  onDelete?: string
}

export interface UniqueConstraint extends ConstraintBase {
  kind: 'UNIQUE'
  columns: string[]
}

export interface CheckConstraint extends ConstraintBase {
  kind: 'CHECK'
  expression: string
}

export type Constraint =
  | PrimaryKeyConstraint
  | ForeignKeyConstraint
  | UniqueConstraint
  | CheckConstraint

export type Cardinality = 'ONE' | 'MANY'

export interface Relationship {
  id: UUID
  name: string
  sourceTable: string
  targetTable: string
  sourceColumn: string
  targetColumn: string
  sourceCardinality: Cardinality
  targetCardinality: Cardinality
  onUpdate?: string
  onDelete?: string
}

export interface EnumType {
  id: UUID
  name: string
  values: string[]
  schema?: string
  comment?: string | null
}

export interface Extension {
  id: UUID
  name: string
}

export interface CustomType {
  id: UUID
  name: string
  schema?: string
  kind?: 'enum' | 'composite' | 'domain'
  values?: string[]
}

export interface Dependency {
  id: UUID
  name: string
  sourceTable: string
  targetTable: string
}

export interface LayoutState {
  tablePositions: Record<
    string,
    {
      x: number
      y: number
      width?: number | null
      height?: number | null
    }
  >
}

export interface NormalizedSchema {
  schemas: SchemaNamespace[]
  tables: Table[]
  relationships: Relationship[]
  enums: EnumType[]
  extensions: Extension[]
  customTypes: CustomType[]
  dependencies: Dependency[]
}

