# DevSync VSCode Extension

AI-powered schema sync for modern development - Real-time schema mismatch detection and fixes in VSCode.

## Features

✅ **Real-time Diagnostics** - Inline warnings for schema mismatches  
✅ **Quick Scan** - Scan your Prisma schema with one click  
✅ **Migration Generation** - Generate SQL migrations directly from VSCode  
✅ **Dashboard Integration** - Open dashboard with one click  
✅ **Auto-scan** - Automatically scan on file save (optional)  

## Installation

1. Install the extension from the VSCode Marketplace (coming soon)
2. Or install from `.vsix` file:
   ```bash
   code --install-extension devsync-0.1.0.vsix
   ```

## Configuration

Open VSCode settings and configure:

```json
{
  "devsync.apiUrl": "http://localhost:3000",
  "devsync.apiKey": "your-jwt-token",
  "devsync.projectId": "your-project-id",
  "devsync.databaseConnection": "postgresql://user:pass@localhost/db",
  "devsync.enableDiagnostics": true,
  "devsync.autoScan": false
}
```

## Usage

### Scan Schema

1. Right-click on `schema.prisma` file
2. Select "DevSync: Scan Schema"
3. Or use Command Palette: `DevSync: Scan Schema`

### Generate Migration

1. After scanning, run "DevSync: Generate Migration"
2. Review the generated SQL migration
3. Apply manually or use dashboard

### View Report

1. Run "DevSync: View Report"
2. Opens dashboard in browser

### Inline Diagnostics

When mismatches are found:
- Red squiggles for errors
- Yellow squiggles for warnings
- Blue squiggles for info

Hover over to see mismatch details and suggested fixes.

## Commands

- `devsync.scan` - Scan schema
- `devsync.generateMigration` - Generate migration
- `devsync.viewReport` - View scan report
- `devsync.openDashboard` - Open dashboard

## Requirements

- VSCode 1.80.0 or higher
- DevSync dashboard running (optional, for cloud sync)
- Prisma schema file in workspace

## Development

```bash
cd extensions/vscode
npm install
npm run compile
npm run watch
```

## License

MIT

