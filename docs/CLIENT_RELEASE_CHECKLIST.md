# CLI and VS Code Extension Release Checklist

Run these checks from a clean checkout with Node.js 20 or newer.

## CLI

1. Run `npm ci`, `npm run build`, and `npm test` in `packages/cli`.
2. Run `npm run pack:check` and inspect the npm tarball file list.
3. Test `devsync login`, `devsync whoami`, `devsync projects`, `devsync link`, and an authenticated `devsync scan` against production.
4. Confirm `devsync logout` removes the local session and never prints access or refresh tokens.
5. Publish with npm provenance from the protected release workflow.

## VS Code Extension

1. Run `npm ci`, `npm run compile-tests`, `npm test`, and `npm run package:check` in `extensions/vscode`.
2. Build the VSIX with `npm run package -- --out devsync-<version>.vsix`.
3. Install the VSIX into a clean VS Code profile and complete browser sign-in.
4. Select a dashboard project, run a scan, inspect diagnostics, open a report, and generate a migration preview.
5. Sign out and confirm protected actions request sign-in again.
6. Repeat the smoke test on each operating system published to the Marketplace because the extension includes native database drivers.

## Security And Release Gates

1. Confirm production URLs use HTTPS and no development API keys or connection strings are committed.
2. Run the repository secret scanner and production dependency audit in CI.
3. Verify dashboard device-code endpoints enforce expiry, one-time exchange, user ownership, and rate limits.
4. Verify scan and project endpoints authorize the selected project for the authenticated user or team.
5. Publish only from a protected tag after CI has built the exact npm tarball and VSIX artifacts.
6. Perform a fresh-account end-to-end test after deployment before announcing the release.
