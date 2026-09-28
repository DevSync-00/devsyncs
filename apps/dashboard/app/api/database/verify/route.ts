import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { createClient } from '@/lib/supabase/server';
import { resolveUser } from '@/app/api/projects/utils';

export const dynamic = 'force-dynamic';

const WRITE_PRIVILEGES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await resolveUser(request, supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let pool: Pool | null = null;
  try {
    const { connectionString } = await request.json();
    if (typeof connectionString !== 'string' || !/^postgres(ql)?:\/\//i.test(connectionString)) {
      return NextResponse.json({ error: 'Enter a valid PostgreSQL connection string.' }, { status: 400 });
    }

    pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 8_000, idleTimeoutMillis: 1_000 });
    const client = await pool.connect();
    try {
      const identity = await client.query<{ current_user: string; current_database: string }>(
        'select current_user, current_database() as current_database',
      );
      const privileges = await client.query<{ table_schema: string; table_name: string }>(
        `select table_schema, table_name
         from information_schema.tables
         where table_type = 'BASE TABLE'
           and table_schema not in ('pg_catalog', 'information_schema')
           and has_table_privilege(current_user, format('%I.%I', table_schema, table_name), $1)
         limit 10`,
        [WRITE_PRIVILEGES.join(',')],
      );
      const elevated = await client.query<{ can_create_database_objects: boolean; can_create_public_schema_objects: boolean }>(
        `select
           has_database_privilege(current_user, current_database(), 'CREATE') as can_create_database_objects,
           coalesce(has_schema_privilege(current_user, 'public', 'CREATE'), false) as can_create_public_schema_objects`,
      );

      const writableTables = privileges.rows.map((row) => `${row.table_schema}.${row.table_name}`);
      const canWrite = writableTables.length > 0
        || elevated.rows[0]?.can_create_database_objects
        || elevated.rows[0]?.can_create_public_schema_objects;

      if (canWrite) {
        return NextResponse.json({
          verified: false,
          error: 'This database role has write access.',
          details: 'Create a dedicated read-only role with CONNECT, USAGE, and SELECT permissions, then try again.',
          writableTables,
        }, { status: 422 });
      }

      return NextResponse.json({
        verified: true,
        database: identity.rows[0]?.current_database,
        role: identity.rows[0]?.current_user,
        message: 'Connection succeeded and no schema or table write privileges were detected.',
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({
      verified: false,
      error: 'Could not verify this database connection.',
      details: error instanceof Error ? error.message : 'Check the host, credentials, SSL settings, and network access.',
    }, { status: 422 });
  } finally {
    await pool?.end().catch(() => undefined);
  }
}
