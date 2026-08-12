# DevSync agent integrations

DevSync uses one stdio MCP server for both agent products:

- `codex/` contains a repo-local Codex marketplace and plugin.
- `claude/devsync/` contains a Claude Code plugin.
- `../packages/mcp-server/` contains the shared `@dev-sync/mcp-server` npm package.

## Release prerequisite

Publish `@dev-sync/mcp-server@0.1.4` before distributing either plugin:

```sh
cd packages/mcp-server
npm publish --access public
```

The MCP server expects the `devsync` CLI on `PATH`. Users authenticate once in an interactive terminal:

```sh
npm install --global @dev-sync/cli @dev-sync/mcp-server
devsync login
```

## Codex local installation

Add the repo marketplace, then install the plugin:

```sh
codex plugin marketplace add integrations/codex
codex plugin add devsync@devsync-local
```

Start a new Codex thread after installation so its skill and MCP tools are loaded.

## Claude Code local installation

Install the plugin directory using Claude Code's plugin UI or marketplace workflow. For direct MCP testing without the plugin:

```sh
claude mcp add devsync -- npx -y @dev-sync/mcp-server@0.1.4
```

The exposed tools are read-only scans, status, reports, projects, plans, and migration previews. Applying migrations is intentionally unavailable.
