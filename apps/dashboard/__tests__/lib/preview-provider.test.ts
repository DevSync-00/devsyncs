import { buildDataAssertions } from '@/lib/rehearsal-engine';
import { decryptSecret, encryptSecret, connectionPreview } from '@/lib/secret-vault';
import { TextDecoder, TextEncoder } from 'util';

Object.assign(global, { TextEncoder, TextDecoder });

describe('preview provider safety', () => {
  it('encrypts credentials with authenticated encryption', () => {
    const secret = 'postgres://user:super-secret@localhost:5432/preview';
    const encrypted = encryptSecret(secret);

    expect(encrypted).not.toContain('super-secret');
    expect(decryptSecret(encrypted)).toBe(secret);
    expect(connectionPreview(secret)).toBe('postgres://***@localhost:5432/preview');
  });

  it('builds live-data checks for constraints', () => {
    const assertions = buildDataAssertions(`
      ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
      ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
    `);

    expect(assertions).toHaveLength(2);
    expect(assertions[0].sql).toContain('"email" IS NULL');
    expect(assertions[1].sql).toContain('HAVING COUNT(*) > 1');
  });

  it('rejects concurrent index operations before connecting', async () => {
    const { PostgresTransactionPreviewProvider } = await import('@/lib/preview-providers/postgres-transaction');
    const provider = new PostgresTransactionPreviewProvider();
    const result = await provider.rehearse({
      connectionString: 'postgres://user:password@localhost:5432/preview',
      migrationSql: 'CREATE INDEX CONCURRENTLY users_email_idx ON users(email);',
    });

    expect(result.status).toBe('failed');
    expect(result.error).toContain('cannot run inside');
  });
});
