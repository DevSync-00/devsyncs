import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { TextDecoder, TextEncoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });

const { scanCodebaseSchema } = require('@/lib/schema-scanner') as
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
});
