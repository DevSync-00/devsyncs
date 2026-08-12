---
name: use-devsync
description: Scan database schemas, inspect schema drift, read DevSync reports and projects, and generate safe migration previews. Use for database/schema synchronization, Prisma or SQL drift, migration planning, or DevSync status and report requests.
---

# Use DevSync

Use the DevSync MCP tools for schema work. Prefer structured tool output over invoking the CLI directly.

## Workflow

1. Use `devsync_status` to inspect existing local results.
2. Use `devsync_scan` when current evidence is needed. Keep `local: true` when the user requests offline-only work.
3. Use `devsync_report` only for dashboard-backed results. If authentication is missing, tell the user to run `devsync login` in an interactive terminal.
4. Summarize mismatches by severity, affected model/table, and suggested next action.
5. Use `devsync_plan` before proposing schema changes.
6. Use `devsync_migration_preview` only when the user asks for a migration. Treat its output as a review artifact.

## Safety

- Keep scans read-only.
- Never apply a migration through DevSync MCP; no apply tool is exposed.
- Never request a database URL in chat. Use workspace `.devsync/config.json` or ask the user to configure it locally.
- Do not expose tokens, connection strings, or other secrets from output.
- Require explicit user approval before writing generated SQL into the repository.
