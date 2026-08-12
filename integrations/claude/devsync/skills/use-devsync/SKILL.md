---
name: use-devsync
description: Scans database schemas, inspects schema drift, reads DevSync reports and projects, and generates safe migration previews. Use for database/schema synchronization, Prisma or SQL drift, migration planning, or DevSync status and report requests.
---

# Use DevSync

Use the DevSync MCP tools for schema work.

1. Inspect existing results with `devsync_status`.
2. Run `devsync_scan` when current evidence is needed; use local mode for offline-only work.
3. Use `devsync_report` for dashboard results. If authentication is missing, ask the user to run `devsync login` interactively.
4. Summarize mismatches by severity and affected schema object.
5. Read `devsync_plan` before proposing changes.
6. Generate migrations only with `devsync_migration_preview` and treat the result as a review artifact.

Keep scans read-only. Never ask for connection strings in chat, expose secrets, or apply a migration through MCP.
