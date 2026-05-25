# Frequently Asked Questions (FAQ)

Common questions and answers about DevSync.

## General Questions

### What is DevSync?

DevSync is a VS Code extension that helps keep your Prisma schema and database in sync. It automatically detects mismatches, suggests fixes, and helps generate migrations.

### Is DevSync free?

DevSync offers both free and paid plans. The free plan includes basic scanning and limited AI features. Check our [pricing page](https://Dev-Sync.dev/pricing) for details.

### What databases does DevSync support?

DevSync supports all databases that Prisma supports:
- PostgreSQL
- MySQL
- SQLite
- SQL Server
- MongoDB (with Prisma)

### Do I need an internet connection?

Yes, DevSync requires an internet connection for:
- API authentication
- AI-powered features
- Cloud sync

However, basic scanning can work offline if you have cached results.

## Installation & Setup

### How do I install DevSync?

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "DevSync"
4. Click Install

See our [Installation Guide](TUTORIALS.md#quick-start-tutorial) for detailed steps.

### What are the system requirements?

- VS Code 1.80.0 or higher
- Node.js 18+ (for CLI features)
- Internet connection
- Prisma project

### How do I configure DevSync?

1. Open Command Palette (Ctrl+Shift+P)
2. Run: `DevSync: Configure Settings`
3. Enter your API credentials

See [Configuration Guide](USER_GUIDE.md#configuration) for details.

### Where do I get an API key?

1. Sign up at [Dev-Sync.dev](https://Dev-Sync.dev)
2. Create a project
3. Get your API key from the dashboard
4. Copy it to VS Code settings

## Usage Questions

### How do I run a scan?

**Method 1: Sidebar**
1. Open DevSync sidebar
2. Click "Scan Schema"

**Method 2: Command Palette**
1. Press Ctrl+Shift+P
2. Type: `DevSync: Scan Schema`
3. Press Enter

### How often should I scan?

- **Before commits**: Catch issues early
- **After schema changes**: Verify changes
- **Before deployments**: Ensure production readiness
- **Daily**: Keep in sync (if auto-scan disabled)

### What do the different colors mean?

- **Red**: Critical errors (must fix)
- **Yellow**: Warnings (should review)
- **Blue**: Informational (optional)

### How do I apply a fix?

1. Click on a mismatch in sidebar
2. Or hover over diagnostic in editor
3. Click lightbulb icon (💡)
4. Select "Apply Fix"

### Can I apply multiple fixes at once?

Yes! Use "Apply All Fixes" from the sidebar context menu, or select multiple mismatches and apply batch fixes.

## Migration Questions

### How do I generate a migration?

1. Run a scan first
2. Click "Generate Migration" in sidebar
3. Review the generated SQL
4. Apply using your migration tool

### Can I edit migrations before applying?

Yes! The migration file opens in an editor. You can edit it before applying.

### What if a migration fails?

1. Check the error message
2. Review the migration SQL
3. Fix any issues
4. Regenerate if needed
5. Test in development first

### Can I rollback migrations?

Yes, but DevSync doesn't handle rollbacks directly. Use your migration tool (Prisma Migrate, etc.) to rollback.

## Chat Assistant Questions

### How do I use the chat assistant?

1. Open DevSync Chat panel
2. Type your question
3. Get AI-powered answers

### What can I ask the chat?

- Questions about your schema
- Help with mismatches
- Migration advice
- Best practices
- Troubleshooting

### Is the chat AI-powered?

Yes! DevSync uses AI to provide context-aware answers based on your schema and scan results.

### Does chat work offline?

No, the chat assistant requires an internet connection to access AI services.

## Troubleshooting

### Scan fails with "Authentication Error"

**Solution**:
1. Check your API key is correct
2. Verify API URL is correct
3. Regenerate API key if needed
4. Check internet connection

### Diagnostics not showing

**Solution**:
1. Enable diagnostics in settings
2. Ensure you're editing a `.prisma` file
3. Run a scan first
4. Reload window

### Fixes not applying

**Solution**:
1. Check file permissions
2. Verify Prisma syntax is valid
3. Check Output panel for errors
4. Try manual fix

### Extension is slow

**Solution**:
1. Close other applications
2. Disable unused features
3. Update to latest version
4. Check system resources

See [Troubleshooting Guide](TROUBLESHOOTING.md) for more solutions.

## Advanced Questions

### Can I use DevSync in CI/CD?

Yes! DevSync has a CLI that works in CI/CD pipelines. See [CI/CD Integration](TUTORIALS.md#setting-up-cicd-integration) guide.

### How do I scan multiple databases?

Use different scan profiles in settings, or use the CLI with different connection strings.

### Can I customize scan behavior?

Yes! Configure scan options in settings:
- Include/exclude specific models
- Set severity thresholds
- Configure timeout values

### How do I integrate with other tools?

DevSync provides:
- CLI for scripting
- API for integrations
- Webhooks for notifications
- Export formats (JSON, CSV)

## Privacy & Security

### Is my schema data secure?

Yes! DevSync uses:
- Encrypted connections (HTTPS)
- Secure API authentication
- No storage of sensitive data
- Optional local-only mode

### What data is sent to DevSync?

- Schema structure (models, fields, types)
- Mismatch information
- Chat questions (for AI features)

**Not sent**:
- Actual data values
- Database credentials
- Source code files

### Can I use DevSync offline?

Limited offline support:
- View cached scan results
- Apply fixes locally
- Generate migrations

AI features require internet connection.

## Pricing & Plans

### What's included in the free plan?

- Basic schema scanning
- Mismatch detection
- Limited AI features
- Community support

### What's in the paid plan?

- Unlimited scans
- Full AI features
- Priority support
- Advanced analytics
- Team collaboration

### Can I upgrade/downgrade?

Yes! You can change plans anytime from your dashboard.

## Support

### Where can I get help?

1. **Documentation**: Check our guides
2. **FAQ**: This page
3. **GitHub Issues**: Report bugs
4. **Community Forum**: Ask questions
5. **Email Support**: support@Dev-Sync.dev

### How do I report a bug?

1. Go to [GitHub Issues](https://github.com/devsync/issues)
2. Click "New Issue"
3. Fill out the bug report template
4. Include:
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages
   - System information

### How do I request a feature?

1. Go to [GitHub Issues](https://github.com/devsync/issues)
2. Click "New Issue"
3. Select "Feature Request"
4. Describe the feature and use case

## Still Have Questions?

- Check our [User Guide](USER_GUIDE.md)
- Read [Tutorials](TUTORIALS.md)
- Visit [Troubleshooting Guide](TROUBLESHOOTING.md)
- Contact [Support](https://Dev-Sync.dev/support)

---

**Last Updated**: 2024-01-15  
**Version**: 1.0

