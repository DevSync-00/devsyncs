import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runDevSync } from '../dist/cli.js';

test('runs a configured CLI entrypoint without a shell', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'devsync-mcp-'));
  const cli = path.join(directory, 'fake-cli.mjs');
  await writeFile(cli, `console.log(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));`);
  process.env.DEVSYNC_CLI_PATH = cli;

  const result = await runDevSync(['status', '--format', 'json'], directory);
  const parsed = JSON.parse(result.output);
  assert.deepEqual(parsed.args, ['status', '--format', 'json']);
  assert.equal(parsed.cwd, directory);
});
