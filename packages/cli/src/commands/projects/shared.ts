type SupportedSchemaType =
  | 'prisma'
  | 'supabase'
  | 'typeorm'
  | 'sequelize'
  | 'drizzle'
  | 'django'
  | 'sqlalchemy'
  | 'raw-sql'
  | 'kysely';

const SUPPORTED_SCHEMA_TYPES: SupportedSchemaType[] = [
  'prisma',
  'supabase',
  'typeorm',
  'sequelize',
  'drizzle',
  'django',
  'sqlalchemy',
  'raw-sql',
  'kysely',
];

export function normalizeSchemaType(value?: string): SupportedSchemaType {
  const normalized = (value || '').trim().toLowerCase() as SupportedSchemaType;
  if (SUPPORTED_SCHEMA_TYPES.includes(normalized)) {
    return normalized;
  }
  return 'prisma';
}

export function ensureConfigObject(
  config: Record<string, any> | null | undefined,
  project: {
    id?: string;
    name?: string;
    schemaType?: string;
    dbConnectionString?: string;
  },
  apiUrl: string,
  apiKey: string
): Record<string, any> {
  if (config && typeof config === 'object') {
    return config;
  }

  return {
    version: '1.0',
    project: {
      id: project.id ?? '',
      name: project.name ?? 'devsync-project',
      schemaType: normalizeSchemaType(project.schemaType),
    },
    database: {
      mode: project.dbConnectionString ? 'url' : 'auto',
      connectionString: project.dbConnectionString ?? '',
      writeAccess: false,
    },
    api: {
      url: apiUrl || '',
      key: apiKey || '',
    },
    safety: {
      allowWrites: false,
      allowDbWrites: false,
      requirePlanApproval: true,
    },
  };
}
