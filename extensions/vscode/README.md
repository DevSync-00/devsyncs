# DevSync VSCode Extension

AI-powered schema sync for modern development - Real-time schema mismatch detection and fixes in VSCode.

## Features

✅ **Sidebar Integration** - Full-featured sidebar with all CLI tools accessible  
✅ **Real-time Diagnostics** - Inline warnings for schema mismatches  
✅ **Quick Scan** - Scan your Prisma schema with one click  
✅ **Migration Generation** - Generate SQL migrations directly from VSCode  
✅ **Dashboard Integration** - Open dashboard with one click  
✅ **Auto-scan** - Automatically scan on file save (optional)  
✅ **CLI Integration** - Run all CLI commands (scan, migrate, init) from the sidebar  
✅ **Results Viewer** - View scan results and migration history in the sidebar  

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
  "devsync.autoScan": false,
  "devsync.aiAnalysis": false,
  "devsync.useOllama": false,
  "devsync.ollamaModel": "llama3.2:3b",
  "devsync.ollamaUrl": "http://localhost:11434",
  "devsync.openaiApiKey": ""
}
```

## Usage

### Sidebar (Recommended)

The DevSync sidebar provides easy access to all CLI tools:

1. **Open Sidebar**: Click the DevSync icon in the Activity Bar (left sidebar)
2. **Commands Section**:
   - **🔍 Scan Schema** - Scan your codebase and database for mismatches
   - **🔧 Generate Migration** - Generate SQL migration from mismatches
   - **⚙️ Initialize Project** - Initialize DevSync in your project
   - **📊 View Output** - View CLI command execution logs
3. **Scan Results Section**:
   - View summary of mismatches (errors, warnings)
   - Expand to see detailed mismatch information
   - Click "View Suggested Fix" to see SQL fixes
4. **Migrations Section**:
   - View all generated migration files
   - Click to open migration files in editor
5. **Configuration Section**:
   - Open config file
   - Open VS Code settings

### Command Palette

You can also use the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `DevSync: Scan Schema`
- `DevSync: Generate Migration`
- `DevSync: View Report`
- `DevSync: Open Dashboard`

### Context Menu

Right-click on `schema.prisma` files:
- "DevSync: Scan Schema"
- "DevSync: Generate Migration"

### Inline Diagnostics

When mismatches are found:
- Red squiggles for errors
- Yellow squiggles for warnings
- Blue squiggles for info

Hover over to see mismatch details and suggested fixes.

## Commands

### Main Commands
- `devsync.scan` - Scan schema
- `devsync.generateMigration` - Generate migration
- `devsync.viewReport` - View scan report
- `devsync.openDashboard` - Open dashboard

### Sidebar Commands
- `devsync.sidebar.scan` - Scan schema (from sidebar)
- `devsync.sidebar.migrate` - Generate migration (from sidebar)
- `devsync.sidebar.init` - Initialize project (from sidebar)
- `devsync.sidebar.showOutput` - Show CLI output
- `devsync.sidebar.viewFix` - View suggested fix for mismatch
- `devsync.sidebar.openConfig` - Open config file
- `devsync.sidebar.refresh` - Refresh sidebar view

## Requirements

- VSCode 1.80.0 or higher
- DevSync dashboard running (optional, for cloud sync)
- Prisma schema file in workspace

## Development

### Quick Start

For a complete step-by-step guide on setting up and running the extension, see:
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Complete setup and launch guide

### Quick Commands

```bash
cd extensions/vscode
npm install
npm run compile
npm run watch
```

### Running the Extension

1. **Build the CLI first:**
   ```bash
   cd packages/cli
   npm run build
   ```

2. **Build the extension:**
   ```bash
   cd extensions/vscode
   npm run compile
   ```

3. **Launch:**
   - Press `F5` in VS Code
   - Select "Run Extension" from dropdown
   - Extension Development Host window opens

See [GETTING_STARTED.md](./GETTING_STARTED.md) for detailed instructions.

## License

MIT

