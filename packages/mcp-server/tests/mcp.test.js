import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('publishes the safe DevSync MCP tool set', async () => {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(packageRoot, 'dist', 'index.js')],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'devsync-test', version: '1.0.0' });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [
      'devsync_migration_preview',
      'devsync_plan',
      'devsync_projects',
      'devsync_report',
      'devsync_scan',
      'devsync_status',
    ]);
    assert.equal(names.some((name) => name.includes('apply')), false);
  } finally {
    await client.close();
  }
});
