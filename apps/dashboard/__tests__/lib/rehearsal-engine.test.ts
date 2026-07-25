import { analyzeMigrationRehearsal } from '@/lib/rehearsal-engine';

describe('analyzeMigrationRehearsal', () => {
  it('passes additive SQL and recognizes a rollback plan', () => {
    const result = analyzeMigrationRehearsal(
      'ALTER TABLE users ADD COLUMN nickname text;',
      'ALTER TABLE users DROP COLUMN nickname;',
    );

    expect(result.status).toBe('passed');
    expect(result.rollbackStatus).toBe('passed');
    expect(result.lockEstimates).toHaveLength(1);
    expect(result.lockEstimates[0].level).toBe('low');
  });

  it('blocks destructive SQL', () => {
    const result = analyzeMigrationRehearsal('ALTER TABLE users DROP COLUMN email;');

    expect(result.status).toBe('failed');
    expect(result.lockEstimates[0].level).toBe('critical');
    expect(result.checks.find((check) => check.id === 'destructive')?.status).toBe('failed');
  });

  it('warns about non-concurrent indexes and missing rollback', () => {
    const result = analyzeMigrationRehearsal('CREATE INDEX users_email_idx ON users(email);');

    expect(result.status).toBe('passed');
    expect(result.rollbackStatus).toBe('not_tested');
    expect(result.lockEstimates[0].level).toBe('high');
    expect(result.checks.find((check) => check.id === 'rollback')?.status).toBe('warning');
  });
});
