# Best Practices Guide

Recommended practices for using DevSync effectively.

## Table of Contents

1. [Workflow Best Practices](#workflow-best-practices)
2. [Schema Management](#schema-management)
3. [Migration Practices](#migration-practices)
4. [Team Collaboration](#team-collaboration)
5. [Security Practices](#security-practices)
6. [Performance Optimization](#performance-optimization)

## Workflow Best Practices

### Regular Scanning

**Do**:
- ✅ Run scans before committing changes
- ✅ Scan after pulling from git
- ✅ Scan before deployments
- ✅ Set up auto-scan for active development

**Don't**:
- ❌ Ignore scan results
- ❌ Skip scanning before important changes
- ❌ Rely only on manual checks

### Scan Frequency

**Recommended Schedule**:
- **Active Development**: Auto-scan enabled or scan every 30 minutes
- **Before Commits**: Always scan before committing
- **Before Deployments**: Scan in staging and production
- **After Schema Changes**: Scan immediately after changes

### Review Process

1. **Review All Mismatches**:
   - Don't ignore warnings
   - Understand each mismatch
   - Verify fixes are correct

2. **Test Before Applying**:
   - Review suggested fixes
   - Test in development
   - Verify changes work

3. **Document Changes**:
   - Add comments to migrations
   - Update team documentation
   - Note breaking changes

## Schema Management

### Schema Organization

**Best Practices**:

1. **Keep Schema Clean**:
   ```prisma
   // ✅ Good: Clear, organized
   model User {
     id        Int      @id @default(autoincrement())
     email     String   @unique
     name      String?
     createdAt DateTime @default(now())
   }

   // ❌ Bad: Unclear, messy
   model User { id Int @id email String name String? }
   ```

2. **Use Comments**:
   ```prisma
   /// User account model
   /// Stores basic user information
   model User {
     // ...
   }
   ```

3. **Group Related Models**:
   - Keep related models together
   - Use sections/regions for organization
   - Add separators between groups

### Naming Conventions

**Follow Prisma Conventions**:
- ✅ Use PascalCase for models: `User`, `Post`, `Comment`
- ✅ Use camelCase for fields: `firstName`, `createdAt`
- ✅ Use descriptive names: `userEmail` not `email1`
- ✅ Use consistent naming: `createdAt` not `created_at`

### Field Types

**Choose Appropriate Types**:
- ✅ Use `String?` for optional text
- ✅ Use `DateTime` for timestamps
- ✅ Use `Int` for integers, `Float` for decimals
- ✅ Use `@unique` for unique fields
- ✅ Use `@default()` for default values

## Migration Practices

### Migration Workflow

**Recommended Process**:

1. **Plan Changes**:
   - Document what needs to change
   - Consider impact on existing data
   - Plan rollback strategy

2. **Update Schema**:
   - Make changes in `schema.prisma`
   - Keep changes small and focused
   - Test schema syntax

3. **Generate Migration**:
   - Use DevSync to generate migration
   - Review SQL carefully
   - Edit if needed

4. **Test Migration**:
   - Apply to development database
   - Verify data integrity
   - Test application functionality

5. **Deploy Migration**:
   - Apply to staging first
   - Verify staging works
   - Then apply to production

### Migration Safety

**Always**:
- ✅ Backup database before migrations
- ✅ Test migrations in development
- ✅ Review migration SQL
- ✅ Have rollback plan
- ✅ Test application after migration

**Never**:
- ❌ Apply untested migrations to production
- ❌ Skip reviewing migration SQL
- ❌ Ignore migration errors
- ❌ Apply migrations without backup

### Migration Naming

**Use Descriptive Names**:
```
✅ Good:
- add_email_to_user
- create_post_table
- add_indexes_for_performance

❌ Bad:
- migration1
- update
- fix
```

## Team Collaboration

### Communication

**Best Practices**:

1. **Share Scan Results**:
   - Include scan results in PR descriptions
   - Share mismatches in team chat
   - Document resolved issues

2. **Use Chat for Questions**:
   - Ask questions in DevSync chat
   - Share answers with team
   - Build team knowledge base

3. **Document Decisions**:
   - Why changes were made
   - What alternatives were considered
   - Impact on other team members

### Code Reviews

**Include in PRs**:
- [ ] Scan results (screenshot or link)
- [ ] Migration files (if applicable)
- [ ] Explanation of changes
- [ ] Testing notes
- [ ] Rollback plan

### Conflict Resolution

**When Schema Conflicts Occur**:

1. **Identify Conflicts**:
   - Run scan to see differences
   - Use chat to understand impact

2. **Discuss with Team**:
   - Share scan results
   - Discuss best approach
   - Agree on solution

3. **Resolve Systematically**:
   - Apply fixes one at a time
   - Test after each fix
   - Document resolution

## Security Practices

### API Key Management

**Do**:
- ✅ Store API keys in VS Code settings (encrypted)
- ✅ Use different keys for dev/prod
- ✅ Rotate keys regularly
- ✅ Never commit keys to git

**Don't**:
- ❌ Share API keys publicly
- ❌ Use same key for all environments
- ❌ Store keys in code files

### Database Credentials

**Best Practices**:
- ✅ Use environment variables
- ✅ Use connection strings in settings (encrypted)
- ✅ Never commit credentials
- ✅ Use read-only users for scanning when possible

### Data Privacy

**Considerations**:
- Schema structure is sent to API (for AI features)
- Actual data values are NOT sent
- Use local-only mode if needed
- Review privacy policy

## Performance Optimization

### Scan Performance

**Optimize Scans**:
- ✅ Exclude large/unused tables
- ✅ Use scan profiles for different scenarios
- ✅ Cache results when appropriate
- ✅ Run scans during low-activity periods

### Extension Performance

**Keep Extension Fast**:
- ✅ Clear old scan results regularly
- ✅ Limit number of displayed mismatches
- ✅ Disable unused features
- ✅ Update to latest version

### Database Performance

**Minimize Impact**:
- ✅ Use read replicas for scanning
- ✅ Schedule scans during off-peak hours
- ✅ Limit scan scope when possible
- ✅ Use connection pooling

## Common Patterns

### Adding a New Field

**Best Practice Pattern**:

1. **Update Schema**:
   ```prisma
   model User {
     id        Int      @id @default(autoincrement())
     email     String   @unique
     name      String?
     age       Int?     // New field
   }
   ```

2. **Run Scan**:
   - DevSync detects missing field
   - Shows as mismatch

3. **Generate Migration**:
   - Review migration SQL
   - Ensure field is nullable or has default

4. **Apply Migration**:
   - Test in development
   - Verify application works
   - Deploy to production

### Renaming a Field

**Best Practice Pattern**:

1. **Add New Field**:
   ```prisma
   model User {
     id        Int      @id @default(autoincrement())
     email     String   @unique
     firstName String?  // New name
     name      String?  // Old name (keep temporarily)
   }
   ```

2. **Migrate Data**:
   - Copy data from old to new field
   - Update application code
   - Test thoroughly

3. **Remove Old Field**:
   - Remove from schema
   - Generate migration
   - Apply migration

### Adding an Index

**Best Practice Pattern**:

1. **Identify Need**:
   - Use chat: "Should I add an index?"
   - Review query performance

2. **Add to Schema**:
   ```prisma
   model User {
     id    Int    @id @default(autoincrement())
     email String @unique
     
     @@index([email])
   }
   ```

3. **Generate Migration**:
   - Review index creation SQL
   - Consider impact on writes

4. **Apply Migration**:
   - Test performance improvement
   - Monitor database load

## Anti-Patterns to Avoid

### ❌ Don't Ignore Warnings

**Bad**:
- Ignoring yellow warnings
- Only fixing red errors
- Skipping review

**Good**:
- Review all mismatches
- Understand each issue
- Fix systematically

### ❌ Don't Apply Fixes Blindly

**Bad**:
- Applying fixes without review
- Not testing changes
- Skipping migration review

**Good**:
- Always review fixes
- Test before applying
- Understand impact

### ❌ Don't Skip Migrations

**Bad**:
- Making manual database changes
- Not generating migrations
- Inconsistent environments

**Good**:
- Always use migrations
- Generate from DevSync
- Keep environments in sync

## Continuous Improvement

### Regular Reviews

**Schedule Regular Reviews**:
- Weekly: Review scan trends
- Monthly: Review technical debt
- Quarterly: Review best practices

### Team Learning

**Share Knowledge**:
- Document solutions
- Share tips in team chat
- Learn from mistakes
- Update practices

### Tool Updates

**Stay Current**:
- Update DevSync regularly
- Check for new features
- Read release notes
- Provide feedback

---

**Remember**: Best practices evolve. Adapt these to your team's needs and update as you learn.

**Need Help?** Check out our [User Guide](USER_GUIDE.md) or [Contact Support](https://devsync.ai/support).

