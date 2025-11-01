# Setting Up DevSync in GitHub Actions

## Quick Setup

### 1. Add Secrets to GitHub Repository

Go to your repository → Settings → Secrets and variables → Actions → New repository secret

**Required Secrets:**
- `DATABASE_URL` - Your PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - Example: `postgresql://postgres:password@localhost:5432/mydb`

**Optional Secrets (for dashboard sync):**
- `DEVSYNC_API_URL` - DevSync dashboard API URL (default: http://localhost:3000)
- `DEVSYNC_API_KEY` - JWT token from dashboard
- `DEVSYNC_PROJECT_ID` - Project ID from dashboard

### 2. Add Workflow File

Copy `.github/workflows/devsync-scan.yml` or `.github/workflows/devsync-scan-simple.yml` to your repository's `.github/workflows/` directory.

### 3. Commit and Push

```bash
git add .github/workflows/devsync-scan.yml
git commit -m "Add DevSync schema scanning to CI"
git push
```

### 4. Test

Create a PR with schema changes to trigger the workflow.

## Workflow Options

### Full Workflow (`devsync-scan.yml`)

**Features:**
- ✅ Full scan with dashboard sync
- ✅ Migration generation
- ✅ PR comments with detailed results
- ✅ Status checks
- ✅ Fails CI on errors

**Use When:**
- You want full integration with dashboard
- You want migration previews in PRs
- You want status checks to block merges

### Simple Workflow (`devsync-scan-simple.yml`)

**Features:**
- ✅ Basic scan
- ✅ PR comments
- ✅ JSON output
- ⚠️ Doesn't fail CI (continue-on-error)

**Use When:**
- You want lightweight integration
- You just want to see mismatches in PRs
- You don't need dashboard sync

## Configuration

### Scan Triggers

By default, the workflow triggers on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Changes to Prisma schema files

**Customize triggers** in `.github/workflows/devsync-scan.yml`:

```yaml
on:
  push:
    branches: [main, develop]
    paths:
      - '**/schema.prisma'
      - '**/*.prisma'
  pull_request:
    branches: [main, develop]
```

### Database Connection

**Option 1: Repository Secret** (Recommended)
```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

**Option 2: Environment Variable** (For public repos)
- Use a service like GitHub-hosted PostgreSQL
- Or use connection pooling service

**Option 3: Skip Database** (Code-only scan)
- Remove `--db` flag
- Will only scan Prisma schema (no mismatch detection)

### Exit Codes

The CLI exits with:
- `0` - Success (no mismatches or only info-level)
- `1` - Error (mismatches found with error severity)

To fail CI on warnings too:
```yaml
--fail-on-warnings
```

## PR Comments

### Success Comment

```
## 🔍 DevSync Schema Scan Results

✅ No mismatches found! Your schema is in sync.
```

### Failure Comment

```
## 🔍 DevSync Schema Scan Results

⚠️ Found 3 mismatch(es):

1. **MISSING_FIELD**: User.age
   ```sql
   ALTER TABLE "User" ADD COLUMN "age" INTEGER;
   ```

2. **TYPE_MISMATCH**: User.email
   ```sql
   ALTER TABLE "User" ALTER COLUMN "email" TYPE TEXT;
   ```
```

## Status Checks

The workflow creates a status check:
- **Success**: `devsync/schema-scan` ✅
- **Failure**: `devsync/schema-scan` ❌

### Require Status Check (Branch Protection)

1. Go to repository → Settings → Branches
2. Add branch protection rule
3. Check "Require status checks to pass"
4. Select `devsync/schema-scan`

This will **block merges** if mismatches are found!

## Troubleshooting

### Error: "DATABASE_URL not set"

**Solution**: Add `DATABASE_URL` secret to repository settings

### Error: "Cannot connect to database"

**Solution**: 
1. Verify connection string format
2. Check database is accessible from GitHub Actions
3. Whitelist GitHub Actions IPs (if using firewall)

### Error: "No schema files found"

**Solution**: 
- Check workflow `paths` filter includes your schema location
- Ensure schema file is committed to repository

### Workflow not running

**Solution**:
1. Check workflow file is in `.github/workflows/` directory
2. Verify triggers match your branch/PR
3. Check Actions tab for errors

## Advanced Usage

### Multiple Databases

Scan against different databases:

```yaml
- name: Scan Staging
  run: devsync scan --db ${{ secrets.STAGING_DB }}

- name: Scan Production (Read-only)
  run: devsync scan --db ${{ secrets.PROD_DB }} --read-only
```

### Custom Output Path

```yaml
- name: Scan
  run: |
    devsync scan \
      --output .devsync/pr-scan.json \
      --json
```

### Scan Only Specific Paths

```yaml
- name: Scan API Schema
  run: devsync scan --path packages/api
```

## Best Practices

### ✅ Do:
- Use repository secrets for sensitive data
- Review PR comments before merging
- Test workflow on a branch first
- Keep database connection secure
- Use staging database for CI

### ❌ Don't:
- Commit database passwords
- Use production database in CI (unless read-only)
- Skip reviewing scan results
- Disable status checks without review

## Example Workflow

See `.github/workflows/devsync-scan.yml` for a complete example with:
- ✅ Full dashboard integration
- ✅ Migration generation
- ✅ PR comments
- ✅ Status checks
- ✅ Error handling

---

**Ready to set up?** Copy the workflow file and add your secrets! 🚀

