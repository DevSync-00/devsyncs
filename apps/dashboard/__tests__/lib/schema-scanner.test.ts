import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { TextDecoder, TextEncoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });

const { compareSchemas, scanCodebaseSchema } = require('@/lib/schema-scanner') as
  typeof import('@/lib/schema-scanner');

describe('scanCodebaseSchema table references', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'devsync-schema-scanner-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('ignores prose, dependency names, configuration strings, and RPC names', () => {
    mkdirSync(path.join(root, 'services'));
    writeFileSync(
      path.join(root, 'services', 'database.ts'),
      `
        import { createClient } from '@supabase/supabase-js';

        // Accepting input from a browser and decoding it as utf-8.
        const description = 'selecting a dependency from browser configuration';
        const encoding = 'utf-8';
        const dependencies = ['react', 'accepting', 'and'];

        await supabase.rpc('refresh_dashboard');
        await supabase.from('profiles').select('*');
      `
    );

    const schema = scanCodebaseSchema(root);

    expect(schema.tables.map((table) => table.name)).toEqual(['profiles']);
    expect(schema.tables[0].columns.map((column) => column.name)).toEqual([]);
  });

  it('infers partial columns from Supabase query chains', () => {
    mkdirSync(path.join(root, 'services'));
    writeFileSync(
      path.join(root, 'services', 'profiles.ts'),
      `
        import { createClient } from '@supabase/supabase-js';
        await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .eq('is_active', true)
          .order('created_at');
        await supabase.from('profiles').update({ display_name: nextName }).eq('id', userId);
      `
    );

    const schema = scanCodebaseSchema(root);

    expect(schema.tables[0].columnsComplete).toBe(false);
    expect(schema.tables[0].columns.map((column) => column.name).sort()).toEqual([
      'avatar_url',
      'created_at',
      'display_name',
      'id',
      'is_active',
    ]);
    expect(schema.tables[0].columns.every((column) => column.type === 'unknown')).toBe(true);
  });

  it('does not flatten related select fields into the root table', () => {
    writeFileSync(
      path.join(root, 'profiles.ts'),
      `
        await supabase
          .from('admins')
          .select('id, profile:profiles(full_name, avatar_url), role')
        await supabase.from('audit_logs').select('id, action')
      `
    );

    const schema = scanCodebaseSchema(root);
    const admins = schema.tables.find((table) => table.name === 'admins');
    const auditLogs = schema.tables.find((table) => table.name === 'audit_logs');

    expect(admins?.columns.map((column) => column.name)).toEqual(['id', 'role']);
    expect(auditLogs?.columns.map((column) => column.name)).toEqual(['id', 'action']);
  });

  it('does not report usage-inferred columns as authoritative missing fields', () => {
    const codeSchema = scanCodebaseSchema(root);
    codeSchema.tables = [{
      name: 'profiles',
      columns: [{ name: 'display_name', type: 'unknown', nullable: true }],
      columnsComplete: false,
    }];
    const dbSchema = {
      tables: [{
        name: 'profiles',
        columns: [{ name: 'id', type: 'uuid', nullable: false }],
      }],
      metadata: {
        source: 'database' as const,
        sourceType: 'postgres',
        tableCount: 1,
        columnCount: 1,
        scannedAt: new Date().toISOString(),
      },
    };

    expect(compareSchemas(codeSchema, dbSchema)).toEqual([]);
  });

  it('extracts table names from genuine SQL string literals', () => {
    mkdirSync(path.join(root, 'repositories'));
    writeFileSync(
      path.join(root, 'repositories', 'queries.ts'),
      `
        export const query = \`
          SELECT users.id
          FROM public.users
          JOIN profiles ON profiles.user_id = users.id
        \`;
        export const update = 'UPDATE audit_logs SET processed = true';
      `
    );

    const schema = scanCodebaseSchema(root);

    expect(schema.tables.map((table) => table.name)).toEqual([
      'audit_logs',
      'profiles',
      'users',
    ]);
  });

  it('separates PostgreSQL types from constraints and primary-key nullability', () => {
    mkdirSync(path.join(root, 'migrations'));
    writeFileSync(
      path.join(root, 'migrations', '001_schema.sql'),
      `
        CREATE TABLE admin_users (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          email text UNIQUE NOT NULL,
          role text NOT NULL CHECK (role IN ('admin', 'staff')),
          is_active boolean DEFAULT true,
          created_at timestamp with time zone DEFAULT now()
        );
      `
    );

    const schema = scanCodebaseSchema(root);
    const columns = schema.tables[0].columns;

    expect(columns.map(({ name, type, nullable }) => ({ name, type, nullable }))).toEqual([
      { name: 'id', type: 'uuid', nullable: false },
      { name: 'email', type: 'text', nullable: false },
      { name: 'role', type: 'text', nullable: false },
      { name: 'is_active', type: 'boolean', nullable: true },
      { name: 'created_at', type: 'timestamptz', nullable: true },
    ]);
  });
});
