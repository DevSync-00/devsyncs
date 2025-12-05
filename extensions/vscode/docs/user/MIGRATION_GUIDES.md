# Migration Guides

Guides for migrating between DevSync versions and from other tools.

## Table of Contents

1. [Upgrading DevSync](#upgrading-devsync)
2. [Migrating from Manual Process](#migrating-from-manual-process)
3. [Migrating from Other Tools](#migrating-from-other-tools)
4. [Version-Specific Migrations](#version-specific-migrations)

## Upgrading DevSync

### From v0.0.x to v0.1.0

**Breaking Changes**:
- New configuration format
- Updated API endpoints
- Changed command names

**Migration Steps**:

1. **Backup Configuration**:
   - Export current settings
   - Save API credentials

2. **Update Extension**:
   - Install latest version
   - VS Code will prompt for update

3. **Update Configuration**:
   - Run: `DevSync: Configure Settings`
   - Re-enter API credentials
   - Verify settings

4. **Update Settings**:
   - Old settings may need migration
   - Check settings.json for deprecated options
   - Update to new format

5. **Test Functionality**:
   - Run a test scan
   - Verify features work
   - Check for errors

### Configuration Migration

**Old Format** (v0.0.x):
```json
{
  "devsync.apiUrl": "https://api.devsync.ai",
  "devsync.apiKey": "key",
  "devsync.projectId": "id"
}
```

**New Format** (v0.1.0+):
```json
{
  "devsync.apiUrl": "https://api.devsync.ai",
  "devsync.apiKey": "key",
  "devsync.projectId": "id",
  "devsync.analyzerUrl": "https://analyzer.devsync.ai"
}
```

**Migration**:
- Extension automatically migrates settings
- Manual update may be needed for custom configs

## Migrating from Manual Process

### Current Manual Process

If you're currently:
- Manually comparing schema and database
- Writing migrations by hand
- Using SQL scripts for changes

### Migration Steps

#### Step 1: Install DevSync

1. Install extension from marketplace
2. Configure API credentials
3. Set up database connection

#### Step 2: Establish Baseline

1. Run initial scan
2. Review all mismatches
3. Document current state
4. Fix critical issues first

#### Step 3: Adopt DevSync Workflow

1. **Replace Manual Scans**:
   - Use DevSync scans instead
   - Set up auto-scan if desired

2. **Use Generated Migrations**:
   - Generate migrations with DevSync
   - Review and edit as needed
   - Apply using your existing tool

3. **Leverage AI Features**:
   - Use chat for questions
   - Get AI suggestions
   - Learn best practices

#### Step 4: Team Adoption

1. Share DevSync with team
2. Train team members
3. Update team workflows
4. Document new process

### Workflow Comparison

**Before (Manual)**:
```
1. Manually check schema vs database
2. Write SQL migration
3. Test migration
4. Apply to database
5. Update schema.prisma
```

**After (DevSync)**:
```
1. DevSync auto-detects mismatches
2. Generate migration with one click
3. Review and test migration
4. Apply migration
5. Schema stays in sync automatically
```

## Migrating from Other Tools

### From Prisma Studio

**If you use Prisma Studio for schema management**:

1. **Keep Using Prisma Studio**:
   - DevSync complements Prisma Studio
   - Use Studio for data management
   - Use DevSync for schema sync

2. **Add DevSync**:
   - Install DevSync
   - Use for mismatch detection
   - Generate migrations

3. **Combined Workflow**:
   - Use DevSync for schema sync
   - Use Studio for data management
   - Best of both worlds

### From Database Migration Tools

**If you use tools like Flyway, Liquibase, etc.**:

1. **Keep Your Tool**:
   - DevSync generates migrations
   - Apply using your existing tool
   - No need to switch

2. **Integration**:
   - Generate migrations with DevSync
   - Export to your tool's format
   - Apply using your tool

3. **Benefits**:
   - Get mismatch detection
   - AI-powered suggestions
   - Visual feedback

### From Schema Comparison Tools

**If you use schema comparison tools**:

1. **Replace Comparison**:
   - DevSync provides better comparison
   - Real-time detection
   - Visual interface

2. **Migrate Data**:
   - Export comparison results
   - Import to DevSync (if needed)
   - Start fresh with DevSync

3. **New Features**:
   - AI-powered suggestions
   - Chat assistant
   - One-click fixes

## Version-Specific Migrations

### v0.1.0 → v0.2.0

**New Features**:
- Enhanced AI features
- New chat capabilities
- Improved performance

**Migration**:
- No breaking changes
- Update and enjoy new features

### v0.2.0 → v1.0.0

**Major Update**:
- New API format
- Updated configuration
- Performance improvements

**Migration Steps**:

1. **Backup Everything**:
   - Export settings
   - Save scan results
   - Backup configurations

2. **Update Extension**:
   - Install v1.0.0
   - Follow migration wizard

3. **Update Configuration**:
   - Run configuration wizard
   - Migrate settings automatically
   - Verify settings

4. **Test Thoroughly**:
   - Run test scans
   - Verify all features
   - Check for issues

## Troubleshooting Migrations

### Migration Fails

**If migration fails**:

1. **Check Compatibility**:
   - Verify VS Code version
   - Check extension compatibility
   - Review system requirements

2. **Review Logs**:
   - Check Output panel
   - Look for error messages
   - Note specific errors

3. **Manual Migration**:
   - Export settings manually
   - Reconfigure from scratch
   - Import data if possible

4. **Get Help**:
   - Check GitHub issues
   - Contact support
   - Provide error details

### Settings Not Migrating

**If settings don't migrate**:

1. **Manual Export**:
   - Copy settings.json
   - Save API credentials
   - Document configuration

2. **Manual Import**:
   - Re-enter settings
   - Use saved credentials
   - Verify configuration

3. **Verify Migration**:
   - Check all settings
   - Test functionality
   - Report issues

## Best Practices for Migrations

### Before Migrating

1. **Backup Everything**:
   - Settings
   - Configurations
   - Scan results
   - API credentials

2. **Read Release Notes**:
   - Check breaking changes
   - Review new features
   - Understand migration steps

3. **Test in Development**:
   - Test migration process
   - Verify functionality
   - Fix any issues

### During Migration

1. **Follow Steps Carefully**:
   - Don't skip steps
   - Read instructions
   - Verify each step

2. **Monitor for Errors**:
   - Watch Output panel
   - Check for warnings
   - Address issues immediately

3. **Test Functionality**:
   - Run test scans
   - Verify features work
   - Check performance

### After Migration

1. **Verify Everything Works**:
   - Test all features
   - Check configurations
   - Verify data integrity

2. **Update Documentation**:
   - Update team docs
   - Share migration notes
   - Document any issues

3. **Provide Feedback**:
   - Report migration issues
   - Suggest improvements
   - Share success stories

## Getting Help

### Migration Support

- **Documentation**: Check migration guides
- **GitHub Issues**: Report migration problems
- **Support Email**: support@devsync.ai
- **Community Forum**: Ask questions

### Migration Resources

- [User Guide](USER_GUIDE.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
- [FAQ](FAQ.md)
- [Release Notes](https://github.com/devsync/releases)

---

**Need Help?** Contact [Support](https://devsync.ai/support) or check our [Documentation](USER_GUIDE.md).

