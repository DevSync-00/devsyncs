import type { AdapterResult, SchemaAdapter } from './adapters/types'
import { detectAdapter } from './adapters/detect'
import { smartQueryAdapter } from './adapters/smartQueryAdapter'
import { postgresAstAdapter } from './adapters/postgresAstAdapter'
import { dbmlAdapter } from './adapters/dbmlAdapter'

const defaultAdapters: SchemaAdapter[] = [
  smartQueryAdapter,
  postgresAstAdapter,
  dbmlAdapter,
]

/**
 * Run schema extraction by selecting an adapter for the given input.
 * The input can be a parsed schema object (Liam), or ChartDB smart-query metadata JSON.
 */
export const runExtraction = async (
  input: unknown,
  adapters: SchemaAdapter[] = defaultAdapters,
): Promise<AdapterResult> => {
  const adapter = detectAdapter(adapters, input)
  if (!adapter) {
    throw new Error('No adapter found for provided input')
  }
  return adapter.extract(input)
}

