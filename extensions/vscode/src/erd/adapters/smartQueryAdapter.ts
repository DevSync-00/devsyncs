import type { ChartdbMetadata } from '../schema/normalize/chartdb'
import { normalizeChartdbMetadata } from '../schema/normalize/chartdb'
import type { AdapterContext, AdapterResult, SchemaAdapter } from './types'
import { fixMetadataJson } from './utils'

/**
 * Adapter that consumes ChartDB-style smart-query JSON output.
 * Assumes caller already executed the SQL against the database.
 * Handles both parsed objects and JSON strings (with cleanup).
 */
export const smartQueryAdapter: SchemaAdapter = {
  id: 'smart-query',
  supports: (input: unknown) => {
    if (typeof input === 'string') {
      try {
        const parsed = JSON.parse(input)
        return (
          typeof parsed === 'object' &&
          parsed !== null &&
          Array.isArray((parsed as ChartdbMetadata).columns)
        )
      } catch {
        return false
      }
    }
    return (
      typeof input === 'object' &&
      input !== null &&
      Array.isArray((input as ChartdbMetadata).columns)
    )
  },
  extract: async (
    input: unknown,
    _ctx?: AdapterContext,
  ): Promise<AdapterResult> => {
    const warnings: string[] = []
    let metadata: ChartdbMetadata

    if (typeof input === 'string') {
      try {
        const fixed = fixMetadataJson(input)
        metadata = JSON.parse(fixed) as ChartdbMetadata
      } catch (err) {
        return {
          schema: {
            schemas: [],
            tables: [],
            relationships: [],
            enums: [],
            extensions: [],
            customTypes: [],
            dependencies: [],
          },
          warnings: [`Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`],
        }
      }
    } else {
      metadata = input as ChartdbMetadata
    }

    if (!Array.isArray(metadata.columns)) {
      return {
        schema: {
          schemas: [],
          tables: [],
          relationships: [],
          enums: [],
          extensions: [],
          customTypes: [],
          dependencies: [],
        },
        warnings: ['Invalid metadata: missing columns array'],
      }
    }

    const schema = normalizeChartdbMetadata(metadata)
    return { schema, warnings }
  },
}

