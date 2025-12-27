import { normalizeLiamSchema, type LiamSchema } from '../schema/normalize/liam'
import type { AdapterContext, AdapterResult, SchemaAdapter } from './types'

/**
 * Adapter for already-parsed Liam-style schema (e.g., produced by the Postgres AST parser).
 * Parsing is expected to be handled upstream; this performs normalization only.
 */
export const postgresAstAdapter: SchemaAdapter = {
  id: 'postgres-ast',
  supports: (input: unknown) =>
    typeof input === 'object' &&
    input !== null &&
    'tables' in (input as Record<string, unknown>),
  extract: async (
    input: unknown,
    _ctx?: AdapterContext,
  ): Promise<AdapterResult> => {
    const schema = normalizeLiamSchema(input as LiamSchema)
    return { schema, warnings: [] }
  },
}

