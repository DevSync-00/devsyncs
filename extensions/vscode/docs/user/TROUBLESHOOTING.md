# Troubleshooting Guide

Common issues and their solutions.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Configuration Problems](#configuration-problems)
3. [Scan Issues](#scan-issues)
4. [Diagnostics Not Showing](#diagnostics-not-showing)
5. [Fix Application Problems](#fix-application-problems)
6. [Migration Issues](#migration-issues)
7. [Chat Assistant Problems](#chat-assistant-problems)
8. [Performance Issues](#performance-issues)

## Installation Issues

### Extension Won't Install

**Symptoms**:
- Installation fails
- Extension doesn't appear after install

**Solutions**:

1. **Check VS Code Version**:
   - Ensure VS Code 1.80.0 or higher
   - Update VS Code if needed

2. **Check Extension Compatibility**:
   - Verify extension is compatible with your OS
   - Check extension marketplace for requirements

3. **Manual Installation**:
   ```bash
   # Download .vsix file
   code --install-extension devsync.vsix
   ```

4. **Clear Extension Cache**:
   - Close VS Code
   - Delete `~/.vscode/extensions/devsync*`
   - Reinstall extension

### Extension Not Activating

**Symptoms**:
- Extension installed but not working
- No DevSync commands available

**Solutions**:

1. **Check Activation Events**:
   - Open a `.prisma` file
   - Or run a DevSync command manually

2. **Check Output Panel**:
   - View > Output
   - Select "DevSync" from dropdown
   - Look for error messages

3. **Reload Window**:
   - Command Palette > "Developer: Reload Window"

## Configuration Problems

### API Credentials Not Working

**Symptoms**:
- Scans fail with authentication errors
- "Invalid API key" messages

**Solutions**:

1. **Verify Credentials**:
   - Check API key is correct
   - Ensure no extra spaces
   - Verify project ID matches

2. **Check API URL**:
   - Default: `https://api.devsync.ai`
   - Verify URL is accessible
   - Check for typos

3. **Test Connection**:
   ```bash
   curl https://api.devsync.ai/health
   ```

4. **Regenerate API Key**:
   - If key is compromised
   - Generate new key from dashboard
   - Update settings

### Database Connection Issues

**Symptoms**:
- "Cannot connect to database" errors
- Scans fail immediately

**Solutions**:

1. **Verify Connection String**:
   ```
   postgresql://user:password@host:port/database
   ```

2. **Test Connection**:
   ```bash
   # Using psql
   psql "postgresql://user:password@host:port/database"
   ```

3. **Check Network**:
   - Ensure database is accessible
   - Check firewall rules
   - Verify VPN connection if needed

4. **Check Credentials**:
   - Verify username and password
   - Check database name is correct
   - Ensure user has proper permissions

## Scan Issues

### Scan Fails Immediately

**Symptoms**:
- Scan starts but fails right away
- Error messages in output panel

**Solutions**:

1. **Check Prisma Schema**:
   - Ensure `schema.prisma` exists
   - Verify schema syntax is valid
   - Run `prisma validate`

2. **Check Database Connection**:
   - Verify connection string
   - Test database accessibility
   - Check database permissions

3. **Check API Connection**:
   - Verify API credentials
   - Test API endpoint
   - Check network connectivity

4. **Review Error Messages**:
   - Open Output panel
   - Select "DevSync" channel
   - Look for specific error details

### Scan Takes Too Long

**Symptoms**:
- Scan runs for minutes without completing
- No progress updates

**Solutions**:

1. **Check Database Size**:
   - Large databases take longer
   - Consider scanning specific tables

2. **Check Network**:
   - Slow network affects API calls
   - Verify internet connection

3. **Check System Resources**:
   - Ensure sufficient memory
   - Close other applications

4. **Use Timeout Settings**:
   - Increase timeout in settings
   - Or cancel and retry

### Scan Shows No Results

**Symptoms**:
- Scan completes but shows no mismatches
- Sidebar is empty

**Solutions**:

1. **Verify Schema and Database Match**:
   - They might actually be in sync!
   - Check manually to confirm

2. **Check Scan Scope**:
   - Ensure correct workspace folder
   - Verify schema file is included

3. **Check Filters**:
   - Clear any active filters
   - Reset search query

4. **Run Another Scan**:
   - Sometimes first scan needs initialization
   - Try scanning again

## Diagnostics Not Showing

### No Inline Diagnostics

**Symptoms**:
- No squiggly lines in editor
- No code actions available

**Solutions**:

1. **Enable Diagnostics**:
   - Settings > `devsync.enableDiagnostics`
   - Set to `true`
   - Reload window

2. **Check File Type**:
   - Ensure editing `.prisma` file
   - Verify language mode is "Prisma"

3. **Run Scan First**:
   - Diagnostics appear after scan
   - Run a scan to generate diagnostics

4. **Check Diagnostic Settings**:
   - Settings > "Problems: Show"
   - Ensure diagnostics are visible

### Diagnostics Not Updating

**Symptoms**:
- Old diagnostics still showing
- New changes not reflected

**Solutions**:

1. **Refresh Diagnostics**:
   - Run a new scan
   - Or use Command Palette: "DevSync: Refresh Diagnostics"

2. **Clear Old Diagnostics**:
   - Command Palette: "DevSync: Clear Diagnostics"
   - Run new scan

3. **Reload Window**:
   - Sometimes needed for updates
   - Command Palette > "Developer: Reload Window"

## Fix Application Problems

### Fixes Not Applying

**Symptoms**:
- Click "Apply Fix" but nothing happens
- Error messages when applying

**Solutions**:

1. **Check File Permissions**:
   - Ensure file is writable
   - Check file isn't read-only

2. **Check Prisma Format**:
   - Ensure schema is valid
   - Run `prisma format` to fix syntax

3. **Review Error Messages**:
   - Check Output panel for details
   - Look for specific error codes

4. **Try Manual Fix**:
   - Apply fix manually
   - Copy suggested SQL
   - Apply via migration tool

### Fixes Applied Incorrectly

**Symptoms**:
- Fix applied but wrong result
- Schema corrupted after fix

**Solutions**:

1. **Use Undo**:
   - Ctrl+Z / Cmd+Z to undo
   - Or use Git to revert

2. **Review Before Applying**:
   - Always preview fixes
   - Review diff carefully

3. **Report Issue**:
   - Report bug with details
   - Include schema and fix that failed

## Migration Issues

### Migration Generation Fails

**Symptoms**:
- "Generate Migration" fails
- Error messages appear

**Solutions**:

1. **Check Scan Results**:
   - Ensure scan completed successfully
   - Verify mismatches exist

2. **Check API Connection**:
   - Verify API is accessible
   - Check API credentials

3. **Check Permissions**:
   - Ensure write permissions
   - Check migration directory exists

### Migration SQL is Incorrect

**Symptoms**:
- Generated SQL has errors
- Migration fails when applied

**Solutions**:

1. **Review Before Applying**:
   - Always review generated SQL
   - Test in development first

2. **Edit Migration**:
   - Manually edit migration file
   - Fix any issues

3. **Report Issue**:
   - Report incorrect SQL generation
   - Include schema and expected SQL

## Chat Assistant Problems

### Chat Not Responding

**Symptoms**:
- Messages sent but no response
- Chat appears frozen

**Solutions**:

1. **Check Authentication**:
   - Ensure you're logged in
   - Verify session is valid

2. **Check API Connection**:
   - Verify API is accessible
   - Check network connection

3. **Refresh Chat**:
   - Close and reopen chat panel
   - Or reload window

4. **Check Rate Limits**:
   - Too many requests
   - Wait and try again

### Chat Responses Not Helpful

**Symptoms**:
- Answers are generic
- Not context-aware

**Solutions**:

1. **Provide More Context**:
   - Include schema details
   - Reference specific mismatches

2. **Be Specific**:
   - Ask specific questions
   - Reference line numbers

3. **Use Scan Results**:
   - Run scan first
   - Chat uses scan results for context

## Performance Issues

### Extension is Slow

**Symptoms**:
- Slow startup
- Laggy UI
- Slow scans

**Solutions**:

1. **Check System Resources**:
   - Close other applications
   - Free up memory

2. **Disable Unused Features**:
   - Turn off auto-scan if not needed
   - Disable AI analysis if slow

3. **Update Extension**:
   - Check for updates
   - Install latest version

4. **Check Large Workspaces**:
   - Large projects are slower
   - Consider excluding folders

### High Memory Usage

**Symptoms**:
- VS Code using lots of memory
- System slowing down

**Solutions**:

1. **Limit Scan Results**:
   - Reduce max results shown
   - Clear old results

2. **Disable Caching**:
   - Turn off result caching
   - Clear cache regularly

3. **Restart VS Code**:
   - Close and reopen
   - Clears memory leaks

## Getting More Help

### Still Having Issues?

1. **Check Logs**:
   - View > Output > "DevSync"
   - Look for error messages

2. **Check GitHub Issues**:
   - Search for similar issues
   - Report new issues

3. **Contact Support**:
   - Email: support@devsync.ai
   - Include error logs and steps to reproduce

4. **Community Forum**:
   - Ask in community forum
   - Get help from other users

### Reporting Issues

When reporting issues, include:
- VS Code version
- Extension version
- Error messages
- Steps to reproduce
- Relevant logs
- System information

---

**Quick Fixes**:
- Reload window: `Ctrl+Shift+P` > "Developer: Reload Window"
- Clear cache: Command Palette > "DevSync: Clear Cache"
- Reset settings: Reset to defaults and reconfigure

