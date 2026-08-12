# Change Log

All notable changes to the Dev-Sync VS Code extension will be documented in this file.

## [0.1.7] - 2026-07-31

### Fixed
- Allowed users to open the browser dashboard or retry when the extension host cannot reach the report API.
- Avoided reporting report-fetch network failures as failed schema scans.

## [0.1.6] - 2026-07-31

### Fixed
- Prompted users to select a project or run a scan when opening a report without a configured project ID.
- Avoided reporting a missing project selection as a failed schema scan.

## [0.1.5] - 2026-07-31

### Changed
- Replaced the activity-bar asset with the official DevSync logo geometry.
- Temporarily removed the Dev-Sync Chat view and its visible chat commands.

### Fixed
- Prevented report requests from racing asynchronous SecretStorage session restoration.
- Changed unauthenticated report access from a `SCAN_FAILED` error into a sign-in action.
- Opened the device verification page automatically during sign-in.
- Validated restored sessions and avoided redundant sign-in flows.

## [0.1.3] - 2026-07-29

### Changed
- Standardized public branding as Dev-Sync and added cross-registry marketplace metadata.
- Added Open VSX publication tooling for VS Code-compatible editors.
- Added browser-based device sign-in backed by VS Code SecretStorage.
- Added dashboard project discovery and workspace project selection.
- Added local-first project creation with optional account synchronization.
- Added an explicit offline scan command backed by the local Dev-Sync CLI.
- Defaulted dashboard links and API requests to `https://dev-sync.dev`.
- Normalized dashboard scan responses for diagnostics and migration commands.
- Added production packaging metadata, a Marketplace activity icon, and a minimized ERD webview bundle.
- Deprecated plaintext `devsync.apiKey` configuration in favor of device sign-in.

### Fixed
- Allowed authenticated scans without requiring a legacy API key setting.
- Registered command and view disposables for clean extension shutdown.
- Made the Windows integration-test harness ignore inherited Electron Node mode.

## [0.1.2] - 2026-07-23

### Fixed
- Added the Dev-Sync logo to the VS Code Marketplace listing and installed extension details.
- Reorganized the sidebar around account, project, scan, report, and migration workflows.

## [0.1.1] - 2026-07-23

### Fixed
- Routed the sidebar scan and migration actions through the connected extension services.
- Routed Initialize Project through the native project creation flow.
- Stopped Marketplace installs from trying to build the CLI inside user workspaces.

## [0.1.0] - 2024-11-01

### Added
- Initial release of Dev-Sync VSCode Extension
- Schema scanning from VSCode
- Inline diagnostics for schema mismatches
- Quick fix code actions for common mismatches
- Migration generation from VSCode
- Dashboard integration
- Auto-scan on file save (optional)
- Command palette integration
- Right-click menu integration

### Features
- **Scan Schema**: Scan Prisma schemas for mismatches
- **Generate Migration**: Generate SQL migrations from mismatches
- **View Report**: Open dashboard to view scan reports
- **Open Dashboard**: Quick access to Dev-Sync dashboard
- **Inline Diagnostics**: See mismatches directly in your code
- **Quick Fixes**: Apply suggested fixes with one click
- **Auto-scan**: Automatically scan on file save (configurable)

### Configuration
- `devsync.apiUrl`: Dashboard API URL (default: https://dev-sync.dev)
- `devsync.apiKey`: API key (JWT token)
- `devsync.projectId`: Project ID from dashboard
- `devsync.databaseConnection`: Database connection string (optional)
- `devsync.enableDiagnostics`: Enable inline diagnostics (default: true)
- `devsync.autoScan`: Auto-scan on file save (default: false)

---

## Upcoming Features

### Planned for v0.2.0
- Better line detection for mismatches
- Improved code action suggestions
- Diff visualization
- Migration preview
- Status bar integration

### Planned for v0.3.0
- JetBrains plugin support
- Advanced code actions
- Custom theme/styling
- Performance improvements

---

See the extension README for installation and usage instructions.

