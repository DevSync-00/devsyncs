import type { NormalizedSchema } from '../schema/types'

export type AdapterResult = {
  schema: NormalizedSchema
  warnings?: string[]
}

export type AdapterContext = {
  signal?: AbortSignal
  workingDirectory?: string
}

export interface SchemaAdapter {
  id: string
  supports: (input: unknown) => boolean
  extract: (input: unknown, ctx?: AdapterContext) => Promise<AdapterResult>
}

