# DevSync MCP Server

Exposes safe DevSync scan, status, report, project, change-plan, and migration-preview tools over stdio MCP.

Build with `npm install && npm run build`. The server uses the `devsync` CLI on `PATH`. For repository development, set `DEVSYNC_CLI_PATH` to the absolute path of `packages/cli/dist/index.js`.

Authentication remains owned by the CLI. Run `devsync login` once in an interactive terminal before using dashboard-backed tools.
