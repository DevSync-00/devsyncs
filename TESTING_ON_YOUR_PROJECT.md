# Testing DevSync on Your Project

## Quick Start

### 1. Initialize DevSync in Your Project

Navigate to your project directory and run:

```bash
cd /path/to/your/project
devsync init
```

This creates `.devsync/config.json` in your project.

### 2. Test Local Scan (No Database Required)

If you have a Prisma schema, test scanning the codebase first:

```bash
devsync scan --path .
```

**Expected Output**:
- ✅ Code schema extracted (models found)
- ✅ Models listed with fields
- ⚠️ Warning about no database connection (expected)

### 3. Test with Database (Full Scan)

If you have a database connection, configure it:

**Option A: Command Line**
```bash
devsync scan \
  --path . \
  --db postgresql://user:password@localhost:5432/dbname
```

**Option B: Config File**
Edit `.devsync/config.json`:
```json
{
  "version": "1.0",
  "project": {
    "name": "Your Project Name",
    "schemaType": "prisma"
  },
  "database": {
    "connectionString": "postgresql://user:password@localhost:5432/dbname",
    "provider": "postgresql"
  }
}
```

Then run:
```bash
devsync scan --path .
```

**Expected Output**:
- ✅ Code schema extracted
- ✅ Database schema extracted
- ✅ Comparison complete
- ✅ Mismatches listed (if any)

### 4. Generate Migration (If Mismatches Found)

If the scan found mismatches, generate a migration:

```bash
devsync migrate \
  --path . \
  --db postgresql://user:password@localhost:5432/dbname \
  --output ./migrations/devsync_migration.sql
```

**To Preview Only (Dry Run)**:
```bash
devsync migrate \
  --path . \
  --db postgresql://user:password@localhost:5432/dbname \
  --dry-run
```

### 5. Test Cloud Sync (Optional)

If you want to sync results to the dashboard:

**Step 1**: Set up dashboard (if not done):
```bash
cd apps/dashboard
npm run dev
# Visit http://localhost:3000
# Sign up, create a project, copy project ID
```

**Step 2**: Get API token:
- Open dashboard in browser
- Open DevTools (F12)
- Application → Cookies
- Find: `sb-<project-id>-auth-token`
- Copy the token value

**Step 3**: Update `.devsync/config.json`:
```json
{
  "api": {
    "url": "http://localhost:3000",
    "key": "<your-jwt-token>"
  },
  "project": {
    "id": "<project-id-from-dashboard>"
  }
}
```

**Step 4**: Run scan (will auto-sync):
```bash
devsync scan --path .
```

**Expected Output**:
- ✅ All scan steps
- ✅ "☁️ Syncing results to dashboard..."
- ✅ "✅ Scan report synced to dashboard!"

---

## Common Project Types

### Prisma Projects ✅ (Fully Supported)

**Works Best With**:
- Prisma schema files (`prisma/schema.prisma`)
- PostgreSQL databases
- TypeScript/JavaScript projects

**Example**:
```bash
# In your Prisma project
devsync init
devsync scan --path . --db $DATABASE_URL
```

### TypeORM Projects ⚠️ (Limited Support)

**Currently**: Only Prisma schemas are fully supported  
**Workaround**: Use Prisma alongside TypeORM (if compatible)

**Future**: Will support TypeORM entity files

### Raw SQL Projects ⚠️ (Limited Support)

**Currently**: Not fully supported  
**Workaround**: Use Prisma migration files or manual SQL

**Future**: Will support SQL schema files

---

## Troubleshooting

### Issue: "No models found"

**Cause**: DevSync can't find Prisma schema  
**Solution**:
1. Ensure `prisma/schema.prisma` exists
2. Check path: `devsync scan --path /correct/path/to/project`
3. Verify file is readable

### Issue: "Database connection failed"

**Cause**: Invalid connection string or DB not accessible  
**Solution**:
1. Check connection string format: `postgresql://user:pass@host:port/db`
2. Verify database is running
3. Check credentials
4. Test connection: `psql postgresql://user:pass@host:port/db`

### Issue: "Module not found" or "Command not found"

**Cause**: CLI not built or not in PATH  
**Solution**:
```bash
# Build CLI
cd packages/cli
npm run build

# Link globally (optional)
npm link

# Or use directly
npx tsx packages/cli/src/index.ts scan --path .
```

### Issue: "Permission denied" on database

**Cause**: Database user lacks permissions  
**Solution**:
1. Ensure user has SELECT permissions on `information_schema`
2. Grant permissions: `GRANT SELECT ON ALL TABLES IN SCHEMA information_schema TO user;`
3. Or use superuser account (not recommended for production)

### Issue: "Type mismatch" warnings

**Cause**: Normal behavior - code and DB types differ slightly  
**Solution**:
- Review warnings (they're often safe)
- Types might be compatible even if different names
- Check migration SQL before applying

---

## Example Test Scenarios

### Scenario 1: New Project (No DB Yet)

```bash
# Initialize
devsync init

# Scan code only (will work)
devsync scan --path .

# Expected: Models found, warning about no DB
```

### Scenario 2: Existing Project (DB Out of Sync)

```bash
# Initialize
devsync init

# Edit config with DB connection
# Then scan
devsync scan --path . --db $DATABASE_URL

# Expected: Mismatches found (fields in code but not in DB)

# Generate migration
devsync migrate --path . --db $DATABASE_URL --output ./migration.sql

# Review migration.sql
# Apply manually: psql $DATABASE_URL < migration.sql
```

### Scenario 3: Synced Project (Everything in Sync)

```bash
# Scan
devsync scan --path . --db $DATABASE_URL

# Expected: "✨ No mismatches found! Everything is in sync."
```

### Scenario 4: With Cloud Dashboard

```bash
# Configure cloud sync in .devsync/config.json
# Then scan
devsync scan --path . --db $DATABASE_URL

# Expected: Scan completes + syncs to dashboard
# Visit dashboard to see report
```

---

## Best Practices

### ✅ Do:
- Test on a development/staging database first
- Review generated migrations before applying
- Use `--dry-run` to preview migrations
- Backup database before applying migrations
- Test scan before generating migrations

### ❌ Don't:
- Apply migrations directly to production without review
- Skip reviewing generated SQL
- Use `--apply` flag without understanding the changes
- Run on production database without backup

---

## What to Test

### ✅ Core Features
- [ ] `devsync init` - Creates config file
- [ ] `devsync scan` (code only) - Finds Prisma models
- [ ] `devsync scan` (with DB) - Compares code vs database
- [ ] `devsync migrate` - Generates SQL migration
- [ ] `devsync migrate --dry-run` - Preview migration

### ✅ Edge Cases
- [ ] Project with no Prisma schema (should error gracefully)
- [ ] Project with mismatches (should detect them)
- [ ] Project in sync (should show no mismatches)
- [ ] Large schema (performance test)

### ✅ Integration
- [ ] Cloud sync to dashboard (if configured)
- [ ] View reports in dashboard
- [ ] Migration file format (review SQL)

---

## Getting Help

If you encounter issues:

1. **Check logs**: Run with `DEBUG=true` for verbose output
2. **Verify setup**: Ensure CLI is built and in PATH
3. **Test connection**: Verify database connection works
4. **Review errors**: Read error messages carefully
5. **Check config**: Verify `.devsync/config.json` is valid JSON

**Common Issues**:
- Path issues (Windows vs Unix paths)
- Database permissions
- Missing Prisma schema
- Invalid connection strings

---

## Next Steps After Testing

Once you've tested on your project:

1. **Report Issues**: Note any bugs or unexpected behavior
2. **Feature Requests**: Suggest improvements
3. **Edge Cases**: Test with unusual schema configurations
4. **Performance**: Test with large schemas (100+ tables)
5. **Feedback**: What works well? What doesn't?

---

**Ready to test?** Let's start! 🚀

