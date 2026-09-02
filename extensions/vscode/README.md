# Dev-Sync for VS Code

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-26B2F2.svg)](https://github.com/DevSync-00/devsyncs/blob/main/extensions/vscode/LICENSE)

Run Dev-Sync schema scans, review drift, and generate migrations without leaving your editor.

**Open source under the [Apache License 2.0](https://github.com/DevSync-00/devsyncs/blob/main/extensions/vscode/LICENSE).** You may use, copy, modify, and distribute the extension subject to the license terms.

## Requirements

- VS Code 1.80 or newer
- A Dev-Sync account at https://www.dev-sync.dev
- A Dev-Sync dashboard project with a configured repository and database connection
- `@dev-sync/cli` installed globally when using offline scans

## Getting started

1. Run **Dev-Sync: Sign In to Dev-Sync** from the Command Palette.
2. Complete browser device authorization.
3. Open the repository associated with a Dev-Sync dashboard project.
4. Run **Dev-Sync: Select Dashboard Project** and choose the project for this workspace.
5. Run **Dev-Sync: Scan Schema**.

Run **Dev-Sync: Create Project** to create one without leaving VS Code. The extension writes a read-only `.devsync/config.json` first, then synchronizes the project to your account when signed in. Local configuration and scanning remain available if the service is offline.

The selected project ID is stored in workspace settings. Access and refresh tokens are stored in VS Code SecretStorage and are never written to workspace configuration.

## Commands

- **Dev-Sync: Sign In to Dev-Sync**
- **Dev-Sync: Sign Out of Dev-Sync**
- **Dev-Sync: Select Dashboard Project**
- **Dev-Sync: Create Project**
- **Dev-Sync: Scan Schema**
- **Dev-Sync: Scan Locally (Offline)**
- **Dev-Sync: View Scan Report**
- **Dev-Sync: Generate Migration**
- **Dev-Sync: Open Dashboard**

## Settings

```json
{
  "devsync.apiUrl": "https://www.dev-sync.dev",
  "devsync.analyzerUrl": "https://www.dev-sync.dev",
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
- Signing out removes the locally stored Dev-Sync session.

Privacy policy: https://www.dev-sync.dev/privacy

Terms of service: https://www.dev-sync.dev/terms

## License

Dev-Sync for VS Code is released under the **Apache License 2.0**. Read the [full license text](https://github.com/DevSync-00/devsyncs/blob/main/extensions/vscode/LICENSE).

Third-party dependency notices are included in the packaged extension alongside each production bundle.
