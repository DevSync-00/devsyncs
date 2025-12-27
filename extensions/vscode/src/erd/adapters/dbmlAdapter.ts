import type { AdapterContext, AdapterResult, SchemaAdapter } from './types'

/**
 * Adapter for DBML (Database Markup Language) files.
 * Note: This is a stub - full implementation would require @dbml/core package.
 * For now, it detects DBML but returns an empty schema with a warning.
 */
export const dbmlAdapter: SchemaAdapter = {
  id: 'dbml',
  supports: (input: unknown) => {
    if (typeof input !== 'string') return false
    const content = input.trim()
    // Check for DBML patterns
    const dbmlPatterns = [
      /^Table\s+\w+\s*{/m,
      /^Ref:\s*\w+/m,
      /^Enum\s+\w+\s*{/m,
      /^TableGroup\s+/m,
      /^Note\s+\w+\s*{/m,
      /\[pk\]/,
      /\[ref:\s*[<>-]/,
    ]
    return dbmlPatterns.some((pattern) => pattern.test(content))
  },
  extract: async (
    input: unknown,
    _ctx?: AdapterContext,
  ): Promise<AdapterResult> => {
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
      warnings: [
        'DBML parsing requires @dbml/core package. Install it to enable full DBML support.',
      ],
    }
  },
}

