# DevSync User Guide

Welcome to DevSync! This comprehensive guide will help you get started and make the most of DevSync's features.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Basic Usage](#basic-usage)
5. [Features](#features)
6. [Advanced Usage](#advanced-usage)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

## Getting Started

### What is DevSync?

DevSync is an AI-powered VS Code extension that helps you keep your Prisma schema and database in sync. It automatically detects mismatches between your code and database, suggests fixes, and helps you generate migrations.

### Key Features

- 🔍 **Automatic Schema Scanning**: Detects mismatches between Prisma schema and database
- 🤖 **AI-Powered Suggestions**: Get intelligent fix suggestions powered by AI
- 📊 **Visual Dashboard**: View scan results and mismatches in an intuitive sidebar
- 💬 **Chat Assistant**: Ask questions about your schema and get AI-powered answers
- 🔧 **One-Click Fixes**: Apply suggested fixes directly from the editor
- 📝 **Migration Generation**: Generate migrations automatically from scan results

## Installation

### Prerequisites

- Visual Studio Code 1.80.0 or higher
- Node.js 18+ (for CLI operations)
- A Prisma project

### Install from VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "DevSync"
4. Click Install
5. Reload VS Code if prompted

### Manual Installation

1. Download the `.vsix` file from the releases page
2. Open VS Code
3. Go to Extensions
4. Click the `...` menu
5. Select "Install from VSIX..."
6. Choose the downloaded file

## Configuration

### Initial Setup

1. **Open your Prisma project** in VS Code
2. **Configure API Settings**:
   - Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
   - Run: `DevSync: Configure Settings`
   - Enter your API URL, API Key, and Project ID

3. **Set Database Connection** (optional):
   - Open Settings (Ctrl+, / Cmd+,)
   - Search for "DevSync"
   - Set `devsync.databaseConnection` to your database connection string

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `devsync.apiUrl` | DevSync API URL | `https://api.Dev-Sync.dev` |
| `devsync.apiKey` | Your API key | - |
| `devsync.projectId` | Your project ID | - |
| `devsync.databaseConnection` | Database connection string | - |
| `devsync.enableDiagnostics` | Show inline diagnostics | `true` |
| `devsync.autoScan` | Auto-scan on file changes | `false` |
| `Dev-Sync.devAnalysis` | Enable AI analysis | `true` |

## Basic Usage

### Running Your First Scan

1. **Open the DevSync Sidebar**:
   - Click the DevSync icon in the Activity Bar
   - Or use Command Palette: `DevSync: Open Sidebar`

2. **Run a Scan**:
   - Click "Scan Schema" in the sidebar
   - Or use Command Palette: `DevSync: Scan Schema`
   - Wait for the scan to complete

3. **View Results**:
   - Mismatches appear in the sidebar
   - Click on a mismatch to see details
   - View suggested fixes inline

### Applying Fixes

1. **View Suggested Fix**:
   - Click on a mismatch in the sidebar
   - Or hover over a diagnostic in your schema file

2. **Apply Fix**:
   - Click the lightbulb icon (💡) next to the diagnostic
   - Select "Apply Fix" from the code actions menu
   - Or use Command Palette: `DevSync: Apply Fix`

3. **Review Changes**:
   - Review the diff before applying
   - Confirm the changes

### Generating Migrations

1. **After a Scan**:
   - Click "Generate Migration" in the sidebar
   - Or use Command Palette: `DevSync: Generate Migration`

2. **Review Migration**:
   - The migration file opens in a new editor
   - Review the SQL statements
   - Make any necessary adjustments

3. **Apply Migration**:
   - Run the migration using your migration tool
   - Or use Command Palette: `DevSync: Apply Migration`

## Features

### Sidebar

The DevSync sidebar provides:
- **Commands**: Quick access to common actions
- **Scan Results**: View detected mismatches
- **Migrations**: Browse migration history
- **Status**: See current operation status

### Chat Assistant

Ask questions about your schema:
1. Open the DevSync Chat panel
2. Type your question
3. Get AI-powered answers with context

Example questions:
- "What fields are missing in the User model?"
- "How do I add a new field to the Post model?"
- "What's the difference between my schema and database?"

### Inline Diagnostics

- **Red squiggles**: Errors that need immediate attention
- **Yellow squiggles**: Warnings that should be reviewed
- **Blue squiggles**: Informational suggestions

### Code Actions

Right-click on diagnostics or use the lightbulb icon to:
- Apply suggested fixes
- Generate migrations
- View detailed information
- Open documentation

## Advanced Usage

### Custom Scan Profiles

Create different scan configurations:
1. Open Settings
2. Search for "DevSync Scan Profiles"
3. Configure profiles for different environments

### Batch Operations

Apply fixes to multiple mismatches:
1. Select multiple mismatches in the sidebar
2. Right-click and select "Apply All Fixes"
3. Review the preview
4. Confirm the changes

### Integration with CI/CD

Use DevSync in your CI/CD pipeline:
```bash
# Install DevSync CLI
npm install -g @dev-sync/cli

# Run scan
devsync scan --db $DATABASE_URL --output scan-results.json

# Check exit code
if [ $? -ne 0 ]; then
  echo "Schema mismatches detected!"
  exit 1
fi
```

## Troubleshooting

### Common Issues

#### Scan Fails
- **Check database connection**: Verify your connection string
- **Check API credentials**: Ensure API key and project ID are correct
- **Check network**: Ensure you can reach the API server

#### Diagnostics Not Showing
- **Enable diagnostics**: Check `devsync.enableDiagnostics` setting
- **Reload window**: Use Command Palette > "Developer: Reload Window"
- **Check file type**: Ensure you're editing a `.prisma` file

#### Fixes Not Applying
- **Check file permissions**: Ensure files are writable
- **Check Prisma format**: Ensure schema is valid Prisma syntax
- **Review error messages**: Check the Output panel for details

### Getting Help

- **Documentation**: See [docs/user/](docs/user/) directory
- **FAQ**: See [FAQ.md](FAQ.md)
- **GitHub Issues**: Report bugs at [GitHub Issues](https://github.com/devsync/issues)
- **Community**: Join our Discord server

## FAQ

See [FAQ.md](FAQ.md) for frequently asked questions.

## Next Steps

- Read the [Best Practices Guide](BEST_PRACTICES.md)
- Check out [Common Use Cases](USE_CASES.md)
- Explore [Advanced Features](ADVANCED.md)

---

**Need Help?** Check out our [Troubleshooting Guide](TROUBLESHOOTING.md) or [Contact Support](https://Dev-Sync.dev/support).

