# DevSync for VS Code

Run DevSync schema scans, review drift, and generate migrations without leaving VS Code.

## Requirements

- VS Code 1.80 or newer
- A DevSync account at https://dev-sync.dev
- A dashboard project with a configured repository and database connection
- `@devsync/cli` installed globally when using offline scans

## Getting started

1. Run **DevSync: Sign In to DevSync** from the Command Palette.
2. Complete browser device authorization.
3. Open the repository associated with a DevSync dashboard project.
4. Run **DevSync: Select Dashboard Project** and choose the project for this workspace.
5. Run **DevSync: Scan Schema**.

Run **DevSync: Create Project** to create one without leaving VS Code. The extension writes a read-only `.devsync/config.json` first, then synchronizes the project to your account when signed in. Local configuration and scanning remain available if the service is offline.

The selected project ID is stored in workspace settings. Access and refresh tokens are stored in VS Code SecretStorage and are never written to workspace configuration.

## Commands

- **DevSync: Sign In to DevSync**
- **DevSync: Sign Out of DevSync**
- **DevSync: Select Dashboard Project**
- **DevSync: Create Project**
- **DevSync: Scan Schema**
- **DevSync: Scan Locally (Offline)**
- **DevSync: View Scan Report**
- **DevSync: Generate Migration**
- **DevSync: Open Dashboard**

## Settings

```json
{
  "devsync.apiUrl": "https://dev-sync.dev",
  "devsync.analyzerUrl": "https://dev-sync.dev",
  "devsync.projectId": "",
  "devsync.enableDiagnostics": true,
  "devsync.autoScan": false
}
```

`devsync.apiKey` remains available only as a legacy override. Device sign-in is recommended.

The optional `devsync.databaseConnection` setting is used only by local extension features. Cloud scans use the database connection configured for the selected dashboard project.

## Development

```bash
npm ci
npm run compile
npm run compile-tests
npm run package:check
```

Press `F5` from the extension project to open an Extension Development Host.

## Privacy and security

- Authentication tokens use VS Code SecretStorage.
- Project access is enforced by the dashboard API for every request.
- Database credentials are not sent from the extension during cloud scans.
- Signing out removes the locally stored DevSync session.

Privacy policy: https://dev-sync.dev/privacy

Terms of service: https://dev-sync.dev/terms

## License

MIT
