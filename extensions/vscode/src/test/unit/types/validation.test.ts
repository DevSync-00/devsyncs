import * as assert from 'assert';
import { suite, test } from 'mocha';
import { safeParseMismatch, safeParseScanReport } from '../../../types/validation';

suite('Mismatch validation', () => {
  test('accepts every mismatch type emitted by the dashboard scanner', () => {
    const mismatches = [
      {
        type: 'extra_table',
        model: 'audit_log',
        dbValue: { name: 'audit_log', columns: [] },
        severity: 'info',
      },
      {
        type: 'nullable_mismatch',
        model: 'users',
        field: 'email',
        codeValue: false,
        dbValue: true,
        severity: 'warning',
      },
      {
        type: 'missing_relationship',
        model: 'posts',
        field: 'author_id',
        codeValue: { referencedTable: 'users', referencedColumn: 'id' },
        dbValue: null,
        severity: 'warning',
      },
      {
        type: 'extra_relationship',
        model: 'posts',
        field: 'legacy_author_id',
        codeValue: null,
        dbValue: { referencedTable: 'users', referencedColumn: 'id' },
        severity: 'info',
      },
    ];

    for (const mismatch of mismatches) {
      const result = safeParseMismatch(mismatch);
      assert.ok(result.success, `${mismatch.type} should be accepted`);
    }
  });

  test('preserves dashboard scanner fields and schema objects', () => {
    const schema = {
      tables: [{
        name: 'users',
        columns: [{ name: 'email', type: 'text', nullable: false }],
        columnsComplete: true,
        source: 'schema.prisma',
      }],
      metadata: {
        source: 'code' as const,
        sourceType: 'repository',
        tableCount: 1,
        columnCount: 1,
        scannedAt: '2026-08-01T00:00:00.000Z',
      },
    };
    const result = safeParseScanReport({
      id: 'scan-1',
      projectId: 'project-1',
      status: 'completed',
      mismatches: [{
        type: 'missing_field',
        severity: 'error',
        model: 'users',
        table: 'users',
        field: 'email',
        column: 'email',
        message: 'Column "users.email" is missing.',
        codeValue: { name: 'email', type: 'text', nullable: false },
        dbValue: null,
      }],
      codeSchema: schema,
      dbSchema: { ...schema, metadata: { ...schema.metadata, source: 'database' as const } },
      created_at: '2026-08-01T00:00:00.000Z',
    });

    assert.ok(result.success);
    if (result.success) {
      assert.strictEqual(result.data.mismatches[0].table, 'users');
      assert.strictEqual(result.data.mismatches[0].message, 'Column "users.email" is missing.');
      assert.strictEqual(result.data.codeSchema?.tables[0].columns[0].name, 'email');
    }
  });
});
