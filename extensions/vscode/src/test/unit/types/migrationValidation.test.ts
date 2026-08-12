import * as assert from 'assert';
import { suite, test } from 'mocha';
import { safeParseMigration } from '../../../types/validation';

suite('Migration response validation', () => {
  test('normalizes the dashboard migration generation response', () => {
    const result = safeParseMigration({
      id: 'migration-1',
      migrationId: 'migration-1',
      filename: '2026_08_01_add_columns.sql',
      sql: 'ALTER TABLE users ADD COLUMN email text;',
      content: 'ALTER TABLE users ADD COLUMN email text;',
      format: 'sql',
      createdAt: '2026-08-01T09:48:59.001Z',
      validation: null,
    });

    assert.ok(result.success);
    if (result.success) {
      assert.strictEqual(result.data.applied, false);
      assert.strictEqual(result.data.created_at, '2026-08-01T09:48:59.001Z');
      assert.strictEqual(result.data.content, 'ALTER TABLE users ADD COLUMN email text;');
      assert.strictEqual(result.data.validation, null);
    }
  });

  test('preserves dashboard validation details including info warnings', () => {
    const result = safeParseMigration({
      migrationId: 'migration-2',
      filename: 'migration.sql',
      sql: 'BEGIN; COMMIT;',
      format: 'sql',
      createdAt: '2026-08-01T09:48:59.001Z',
      validation: {
        valid: true,
        errors: [],
        warnings: [{
          type: 'ddl_validation_skipped',
          severity: 'info',
          message: 'DDL validation is deferred to dry run.',
        }],
        breakingChanges: [],
        summary: {
          totalIssues: 1,
          errorCount: 0,
          warningCount: 1,
          breakingChangeCount: 0,
        },
      },
    });

    assert.ok(result.success);
  });
});
