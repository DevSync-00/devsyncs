import { extractAstReferences } from '@/lib/ast-dependency-analyzer';

const tables = [{ name: 'users', columns: [{ name: 'id' }, { name: 'email' }] }];

describe('AST dependency analyzer', () => {
  it('extracts Supabase query chains and columns', () => {
    const references = extractAstReferences(
      `const result = await supabase.from('users').select('id, email').eq('email', value)`,
      'app/api/users/route.ts',
      'api',
      tables,
    );
    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({ table: 'users', operation: 'read', kind: 'api', confidence: 0.98 });
  });

  it('extracts Prisma model operations', () => {
    const references = extractAstReferences(
      `await prisma.users.update({ where: { id }, data: { email } })`,
      'lib/users.repository.ts',
      'repository',
      tables,
    );
    expect(references[0]).toMatchObject({ table: 'users', operation: 'write', column: undefined, confidence: 0.97 });
  });

  it('ignores dynamic Supabase table names', () => {
    expect(extractAstReferences(`supabase.from(tableName).select('*')`, 'query.ts', 'query', tables)).toEqual([]);
  });
});
