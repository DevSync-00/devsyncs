import type { SchemaAdapter } from './types'

export const detectAdapter = (
  adapters: SchemaAdapter[],
  input: unknown,
): SchemaAdapter | undefined => {
  for (const adapter of adapters) {
    if (adapter.supports(input)) {
      return adapter
    }
  }
  return undefined
}

