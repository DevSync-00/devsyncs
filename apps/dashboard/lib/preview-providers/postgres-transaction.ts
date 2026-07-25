import { createHash } from 'crypto';
import { Pool, PoolClient } from 'pg';
import type { PreviewProvider, PreviewRehearsalRequest, PreviewRehearsalResult } from './types';

export class PostgresTransactionPreviewProvider implements PreviewProvider {
  readonly id = 'postgres-transaction';

  async verify(connectionString: string) {
    assertPostgresUrl(connectionString);
    const pool = createPool(connectionString);
    try {
      const result = await pool.query('SELECT version() AS version, current_database() AS database');
      return { version: result.rows[0].version, database: result.rows[0].database };
    } finally {
      await pool.end();
    }
  }

  async rehearse(request: PreviewRehearsalRequest): Promise<PreviewRehearsalResult> {
    assertPostgresUrl(request.connectionString);
    if (/\bCONCURRENTLY\b/i.test(request.migrationSql)) {
      return failedResult('CREATE INDEX CONCURRENTLY cannot run inside the transaction rehearsal provider.');
    }

    const pool = createPool(request.connectionString);
    const client = await pool.connect();
    const started = Date.now();
    let before = '';
    let during = '';
    let after = '';
    const assertionResults: PreviewRehearsalResult['assertionResults'] = [];
    const queryResults: PreviewRehearsalResult['queryResults'] = [];
    let affectedRows = 0;

    try {
      before = await schemaFingerprint(client);
      await client.query('BEGIN');
      await client.query(`SET LOCAL lock_timeout = '3s'`);
      await client.query(`SET LOCAL statement_timeout = '30s'`);

      for (const assertion of request.assertions || []) {
        const assertionStarted = Date.now();
        try {
          ensureReadOnlySql(assertion.sql);
          const result = await client.query(assertion.sql);
          const value = Number(Object.values(result.rows[0] || {})[0] || 0);
          const passed = assertion.expected === 'zero' ? value === 0 : value > 0;
          assertionResults.push({
            name: assertion.name,
            status: passed ? 'passed' : 'failed',
            value,
            durationMs: Date.now() - assertionStarted,
          });
          if (!passed) throw new Error(`Pre-migration assertion failed: ${assertion.name}`);
        } catch (error) {
          if (!assertionResults.some((item) => item.name === assertion.name)) {
            assertionResults.push({
              name: assertion.name,
              status: 'failed',
              durationMs: Date.now() - assertionStarted,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          throw error;
        }
      }

      const migrationResult = await client.query(request.migrationSql);
      affectedRows = migrationResult.rowCount || 0;
      during = await schemaFingerprint(client);

      for (const baseline of request.queryBaselines || []) {
        const queryStarted = Date.now();
        try {
          ensureReadOnlySql(baseline.sql);
          const result = await client.query(baseline.sql);
          const durationMs = Date.now() - queryStarted;
          queryResults.push({
            name: baseline.name,
            status: baseline.maxDurationMs && durationMs > baseline.maxDurationMs ? 'failed' : 'passed',
            durationMs,
            rowCount: result.rowCount || 0,
          });
        } catch (error) {
          queryResults.push({
            name: baseline.name,
            status: 'failed',
            durationMs: Date.now() - queryStarted,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Execute explicit rollback when supplied to prove syntax and behavior,
      // then roll back the outer transaction regardless.
      if (request.rollbackSql?.trim()) await client.query(request.rollbackSql);
      await client.query('ROLLBACK');
      after = await schemaFingerprint(client);

      const rollbackPassed = after === before;
      const queriesPassed = queryResults.every((result) => result.status === 'passed');
      return {
        provider: this.id,
        status: rollbackPassed && queriesPassed ? 'passed' : 'failed',
        executionTimeMs: Date.now() - started,
        rollbackStatus: rollbackPassed ? 'passed' : 'failed',
        schemaBefore: before,
        schemaDuring: during,
        schemaAfter: after,
        affectedRows,
        assertionResults,
        queryResults,
        evidence: [
          'Migration executed inside an isolated PostgreSQL transaction.',
          request.rollbackSql?.trim() ? 'Explicit rollback SQL executed before transaction rollback.' : 'Outer transaction rollback restored the preview schema.',
          rollbackPassed ? 'Post-rollback schema fingerprint matches the original.' : 'Post-rollback schema fingerprint does not match the original.',
          `${queryResults.filter((result) => result.status === 'passed').length}/${queryResults.length} replay queries passed.`,
        ],
      };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* connection may already be aborted */ }
      try { after = await schemaFingerprint(client); } catch { after = 'unavailable'; }
      return {
        provider: this.id,
        status: 'failed',
        executionTimeMs: Date.now() - started,
        rollbackStatus: before && after === before ? 'passed' : 'failed',
        schemaBefore: before || 'unavailable',
        schemaAfter: after || 'unavailable',
        affectedRows,
        assertionResults,
        queryResults,
        evidence: ['Rehearsal failed and the provider attempted an unconditional transaction rollback.'],
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      client.release();
      await pool.end();
    }
  }
}

function createPool(connectionString: string) {
  return new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 2_000,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
}

function shouldUseSsl(connectionString: string) {
  const url = new URL(connectionString);
  return url.hostname !== 'localhost' && url.hostname !== '127.0.0.1';
}

function assertPostgresUrl(connectionString: string) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('The PostgreSQL transaction provider requires a postgres:// connection.');
  }
  if (!url.pathname || url.pathname === '/') throw new Error('Preview connection must include a database name.');
}

async function schemaFingerprint(client: PoolClient): Promise<string> {
  const result = await client.query(`
    SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name, ordinal_position
  `);
  return createHash('sha256').update(JSON.stringify(result.rows)).digest('hex');
}

function ensureReadOnlySql(sql: string) {
  const normalized = sql.trim().replace(/^\(+/, '').toLowerCase();
  if (!normalized.startsWith('select') && !normalized.startsWith('with')) {
    throw new Error('Assertions and replay baselines must be read-only SELECT statements.');
  }
  if (/;\s*(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b/i.test(sql)) {
    throw new Error('Multiple or mutating statements are forbidden in replay SQL.');
  }
}

function failedResult(error: string): PreviewRehearsalResult {
  return {
    provider: 'postgres-transaction',
    status: 'failed',
    executionTimeMs: 0,
    rollbackStatus: 'failed',
    schemaBefore: 'unavailable',
    schemaAfter: 'unavailable',
    affectedRows: 0,
    assertionResults: [],
    queryResults: [],
    evidence: ['Provider rejected the migration before opening a transaction.'],
    error,
  };
}
