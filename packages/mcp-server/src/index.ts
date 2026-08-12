#!/usr/bin/env node
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runDevSync } from './cli.js';

const server = new McpServer({ name: 'devsync', version: '0.1.4' });
const workspacePath = z.string().optional().describe('Absolute project path. Defaults to the MCP process working directory.');

function root(input?: string): string {
  return path.resolve(input || process.cwd());
}

function response(output: string) {
  return { content: [{ type: 'text' as const, text: output }] };
}

function failure(error: unknown) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
  };
}

server.registerTool('devsync_scan', {
  description: 'Run a read-only DevSync schema scan. Local mode never sends the scan to the dashboard.',
  inputSchema: {
    path: workspacePath,
    local: z.boolean().default(false).describe('Use the offline local scanner only.'),
  },
}, async ({ path: projectPath, local }) => {
  try {
    const args = ['scan', '--path', root(projectPath), '--format', 'json', '--plan-only'];
    if (local) args.push('--local');
    return response((await runDevSync(args, root(projectPath))).output);
  } catch (error) { return failure(error); }
});

server.registerTool('devsync_status', {
  description: 'Read the latest local DevSync scan status for a workspace.',
  inputSchema: { path: workspacePath },
}, async ({ path: projectPath }) => {
  try {
    return response((await runDevSync(['status', '--path', root(projectPath), '--format', 'json'], root(projectPath))).output);
  } catch (error) { return failure(error); }
});

server.registerTool('devsync_report', {
  description: 'Fetch the latest dashboard schema report for the selected DevSync project.',
  inputSchema: {
    path: workspacePath,
    project: z.string().optional().describe('Optional DevSync project ID.'),
  },
}, async ({ path: projectPath, project }) => {
  try {
    const args = ['report', '--path', root(projectPath), '--format', 'json'];
    if (project) args.push('--project', project);
    return response((await runDevSync(args, root(projectPath))).output);
  } catch (error) { return failure(error); }
});

server.registerTool('devsync_projects', {
  description: 'List projects available to the authenticated DevSync account.',
  inputSchema: {},
}, async () => {
  try {
    return response((await runDevSync(['projects'], process.cwd())).output);
  } catch (error) { return failure(error); }
});

server.registerTool('devsync_plan', {
  description: 'Read the evidence-backed DevSync change plan. This tool never executes a migration.',
  inputSchema: {
    path: workspacePath,
    project: z.string().optional().describe('Optional DevSync project ID.'),
  },
}, async ({ path: projectPath, project }) => {
  try {
    const args = ['plan', '--path', root(projectPath), '--json'];
    if (project) args.push('--project', project);
    return response((await runDevSync(args, root(projectPath))).output);
  } catch (error) { return failure(error); }
});

server.registerTool('devsync_migration_preview', {
  description: 'Generate a dry-run migration preview from workspace configuration. Never applies database changes.',
  inputSchema: {
    path: workspacePath,
    format: z.enum(['sql', 'prisma']).default('sql'),
  },
}, async ({ path: projectPath, format }) => {
  try {
    const projectRoot = root(projectPath);
    const args = ['migrate', '--path', projectRoot, '--config', path.join(projectRoot, '.devsync', 'config.json'), '--format', format, '--dry-run'];
    return response((await runDevSync(args, projectRoot)).output);
  } catch (error) { return failure(error); }
});

const transport = new StdioServerTransport();
await server.connect(transport);
