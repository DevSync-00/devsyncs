# Common Use Cases

Real-world scenarios and how to use DevSync to solve them.

## Table of Contents

1. [Keeping Schema and Database in Sync](#keeping-schema-and-database-in-sync)
2. [Onboarding New Team Members](#onboarding-new-team-members)
3. [Database Migration Workflow](#database-migration-workflow)
4. [Debugging Schema Issues](#debugging-schema-issues)
5. [Code Review Preparation](#code-review-preparation)
6. [Production Deployment Checks](#production-deployment-checks)

## Keeping Schema and Database in Sync

### Problem

Your Prisma schema and database have drifted apart. You're not sure what's different.

### Solution with DevSync

1. **Run Regular Scans**:
   - Set up auto-scan in settings
   - Or run scans before important operations

2. **Review Mismatches**:
   - Check the sidebar for all mismatches
   - Prioritize critical errors

3. **Apply Fixes**:
   - Use one-click fixes for simple changes
   - Generate migrations for complex changes

4. **Verify Sync**:
   - Run another scan to confirm
   - Check that all mismatches are resolved

### Example Workflow

```bash
# Morning routine
1. Open VS Code
2. DevSync auto-scans (if enabled)
3. Review any new mismatches
4. Apply fixes as needed
5. Commit changes
```

## Onboarding New Team Members

### Problem

New team members need to understand the current schema state and any pending changes.

### Solution with DevSync

1. **Show Current State**:
   - Run a scan to show current mismatches
   - Use the sidebar to visualize schema state

2. **Explain with Chat**:
   - Use chat assistant to answer questions
   - "What fields are in the User model?"
   - "What's the difference between dev and prod?"

3. **Guide Through Fixes**:
   - Show how to apply fixes
   - Explain migration workflow

### Example Conversation

**New Team Member**: "I just cloned the repo. What do I need to know?"

**You**: "Run DevSync scan to see the current schema state. Then use the chat to ask questions about any mismatches."

## Database Migration Workflow

### Problem

You need to add a new field to your schema and ensure it's properly migrated.

### Solution with DevSync

1. **Update Schema**:
   ```prisma
   model User {
     id        Int      @id @default(autoincrement())
     email     String   @unique
     name      String?
     createdAt DateTime @default(now())  // New field
   }
   ```

2. **Run Scan**:
   - DevSync detects the new field
   - Shows it as a mismatch

3. **Generate Migration**:
   - Click "Generate Migration"
   - Review the generated SQL

4. **Test Migration**:
   - Apply to development database
   - Verify with another scan

5. **Deploy**:
   - Apply migration to production
   - Verify production is in sync

### Complete Workflow

```
1. Edit schema.prisma
   ↓
2. DevSync detects mismatch (auto-scan)
   ↓
3. Generate migration
   ↓
4. Review migration SQL
   ↓
5. Apply to dev database
   ↓
6. Verify with scan
   ↓
7. Commit changes
   ↓
8. Deploy to production
```

## Debugging Schema Issues

### Problem

Something's wrong with your database, but you're not sure what.

### Solution with DevSync

1. **Run Diagnostic Scan**:
   - Run a full scan
   - Review all mismatches

2. **Use Chat for Investigation**:
   - "What's different between my schema and database?"
   - "Why is this field showing as missing?"
   - "What constraints are different?"

3. **Compare States**:
   - Use schema comparison feature
   - View side-by-side differences

4. **Identify Root Cause**:
   - Check migration history
   - Review recent changes
   - Identify when mismatch occurred

### Example Debugging Session

**Issue**: "Users can't log in. Getting database errors."

**Steps**:
1. Run DevSync scan
2. Find mismatch: "email field type mismatch"
3. Use chat: "Explain the email field mismatch"
4. DevSync: "Your schema has String but database has VARCHAR(50)"
5. Apply fix or generate migration
6. Verify fix resolves the issue

## Code Review Preparation

### Problem

You want to ensure your schema changes are correct before submitting a PR.

### Solution with DevSync

1. **Pre-Commit Scan**:
   - Run scan before committing
   - Fix any issues found

2. **Generate Migration Preview**:
   - Generate migration for review
   - Include in PR description

3. **Document Changes**:
   - Use chat to generate explanations
   - Add to PR comments

### PR Checklist

- [ ] Schema changes are valid Prisma syntax
- [ ] Scan shows no unexpected mismatches
- [ ] Migration has been generated and reviewed
- [ ] Changes are documented in PR description
- [ ] Tests pass with new schema

## Production Deployment Checks

### Problem

You want to ensure production database matches your schema before deploying.

### Solution with DevSync

1. **Pre-Deployment Scan**:
   ```bash
   devsync scan --db $PROD_DATABASE_URL --fail-on-error
   ```

2. **Review Critical Issues**:
   - Check for blocking errors
   - Review migration requirements

3. **Generate Production Migration**:
   - Generate migration for production
   - Review carefully
   - Test in staging first

4. **Deploy with Confidence**:
   - Apply migration
   - Verify with post-deployment scan

### Deployment Checklist

- [ ] Pre-deployment scan completed
- [ ] No critical errors found
- [ ] Migration generated and reviewed
- [ ] Migration tested in staging
- [ ] Rollback plan prepared
- [ ] Post-deployment scan scheduled

## Advanced Use Cases

### Multi-Environment Management

**Problem**: Managing schemas across dev, staging, and production.

**Solution**:
1. Use different scan profiles for each environment
2. Compare environments using chat: "Compare dev and prod schemas"
3. Generate environment-specific migrations

### Schema Refactoring

**Problem**: Need to refactor a large schema safely.

**Solution**:
1. Run scan to establish baseline
2. Make incremental changes
3. Scan after each change
4. Use chat to understand impact: "What will break if I rename this field?"

### Team Collaboration

**Problem**: Multiple developers working on schema changes.

**Solution**:
1. Use DevSync to detect conflicts early
2. Share scan results in team chat
3. Use chat to discuss changes: "Should we add this field?"
4. Generate team-approved migrations

## Tips and Best Practices

1. **Run scans regularly**: Catch issues early
2. **Use chat for questions**: Get instant answers
3. **Review migrations carefully**: Always review before applying
4. **Test in dev first**: Never apply untested migrations to production
5. **Document changes**: Use chat to generate explanations

---

**Need More Examples?** Check out our [Tutorials](TUTORIALS.md) or [Best Practices](BEST_PRACTICES.md).

