# Change Log

All notable changes to the DevSync VSCode Extension will be documented in this file.

## [0.1.0] - 2024-11-01

### Added
- Initial release of DevSync VSCode Extension
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
- **Open Dashboard**: Quick access to DevSync dashboard
- **Inline Diagnostics**: See mismatches directly in your code
- **Quick Fixes**: Apply suggested fixes with one click
- **Auto-scan**: Automatically scan on file save (configurable)

### Configuration
- `devsync.apiUrl`: Dashboard API URL (default: http://localhost:3000)
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

**Check the [README.md](./README.md) for installation and usage instructions.**

