# Dev-Sync CLI

Run Dev-Sync schema scans from a terminal and store the results in the Dev-Sync dashboard.

## Requirements

- Node.js 20 or newer
- A Dev-Sync account at https://dev-sync.dev
- A dashboard project with a configured repository and database connection

## Install

```bash
npm install --global @dev-sync/cli
```

## Dashboard workflow

Run the CLI without arguments to open the guided workflow:

```bash
devsync
```

The terminal flow follows the dashboard:

1. Sign in to Dev-Sync
2. Create a project or select an existing project
3. Scan the connected schema
4. Review the latest report
5. Generate a migration plan

The same workflow remains available as individual commands:

```bash
devsync login
devsync create            # Create a new connected project
devsync select            # Select an existing dashboard project
devsync scan
devsync report
devsync migrate --db postgresql://...
```

`devsync login` uses browser device authorization. `devsync create` creates a local project first and synchronizes it when you are signed in; use `devsync create --local` to deliberately remain offline. `devsync select` presents projects as a numbered list and links the chosen project to the current workspace. `devsync link <project-id>` remains available for scripts. Authentication credentials remain in the user-level Dev-Sync configuration directory.

The linked `devsync scan` runs the same server-side scanner as the dashboard and saves the report to the selected project. `devsync report` retrieves and displays its latest report.

## Offline scan

```bash
devsync scan --local
```

The offline scanner inspects the current workspace without creating a dashboard report.

## Session commands

```bash
devsync whoami
devsync logout
```

## Configuration

Dev-Sync creates `.devsync/config.json` in a linked workspace:

```json
{
  "version": "1.0",
  "project": {
    "id": "project-uuid",
    "name": "example-project",
    "schemaType": "supabase"
  },
  "database": {
    "mode": "auto",
    "connectionString": "",
    "writeAccess": false
  },
  "safety": {
    "allowWrites": false,
    "allowDbWrites": false,
    "requirePlanApproval": true
  }
}
```

Do not commit database passwords or tokens. Use the dashboard project configuration for cloud scans.

## Development

```bash
npm ci
npm test
npm run pack:check
```

## License

MIT
