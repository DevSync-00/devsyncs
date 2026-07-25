import { buildPatchBundle } from '@/lib/patch-generator';

describe('patch generator', () => {
  const version = {
    status: 'approved',
    citations: [{ id: 'E1', type: 'code', file: 'src/users.ts', line: 8, detail: 'select old_name' }],
    patch_proposals: [{ file: 'src/users.ts', purpose: 'Use the compatible field.', citations: ['E1'] }],
  };

  it('rejects unapproved plans', () => {
    expect(() => buildPatchBundle({ ...version, status: 'proposed' }, {})).toThrow(/approved/);
  });

  it('creates executable SQL and review-only application guidance', () => {
    const bundle = buildPatchBundle(version, {
      mismatches: [{ type: 'missing_field', table: 'users', suggestedFix: 'ALTER TABLE users ADD COLUMN name text;' }],
    });
    expect(bundle.artifacts[0]).toMatchObject({ kind: 'sql', executable: true, requiresReview: true });
    expect(bundle.artifacts[1]).toMatchObject({ kind: 'application', executable: false, format: 'instructions' });
    expect(bundle.contentHash).toHaveLength(64);
  });
});
