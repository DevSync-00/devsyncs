# 🔄 GitHub Actions - Quick FAQ

## Why is the workflow scanning this DevSync project?

**Answer**: The workflow triggers on **any `.prisma` files** in the repository. This DevSync project contains:
- `test-prisma-project/prisma/schema.prisma` - Test project for CLI testing

When you push to GitHub, if you modify `.prisma` files, the workflow runs automatically.

**Is this a problem?**
- ✅ **Not really** - It's actually good for testing your tool!
- ⚠️ **But** if you don't want it, you can exclude paths (see below)

---

## How do I set DATABASE_URL?

### Step-by-Step Instructions

1. **Go to your GitHub repository**
   - Navigate to your repo on GitHub

2. **Open Settings**
   - Click on **Settings** tab (top of repository page)

3. **Go to Secrets**
   - Click **Secrets and variables** → **Actions** (left sidebar)

4. **Add New Secret**
   - Click **New repository secret** button

5. **Fill in the secret:**
   - **Name**: `DATABASE_URL` (exactly this, case-sensitive)
   - **Value**: Your PostgreSQL connection string
     ```
     postgresql://username:password@host:port/database
     ```
   
   **Example:**
   ```
   postgresql://postgres:mypassword@db.example.com:5432/mydb
   ```

6. **Save**
   - Click **Add secret**

### Connection String Format

```
postgresql://[username]:[password]@[host]:[port]/[database]
```

**Components:**
- `username` - Database username
- `password` - Database password
- `host` - Database hostname or IP
- `port` - Database port (usually 5432)
- `database` - Database name

**Examples:**
- Local: `postgresql://postgres:password@localhost:5432/mydb`
- Cloud: `postgresql://user:pass@db.provider.com:5432/dbname`
- With SSL: `postgresql://user:pass@host:5432/db?sslmode=require`

---

## Do I need DATABASE_URL?

### Option 1: Yes - If you want migration generation in CI ✅

**When to use:**
- You want to automatically generate migrations in CI/CD
- You have a database accessible from GitHub Actions
- You want preview migrations in PRs

**How to set up:**
1. Add `DATABASE_URL` secret (see above)
2. Workflow will generate migrations automatically

### Option 2: No - If you only want scanning ⚠️

**When to use:**
- You only want to scan code (no database comparison)
- You generate migrations manually
- Database is not accessible from CI

**How it works:**
- Workflow will scan your code
- Migration generation will be skipped
- You'll see a warning message (but workflow won't fail)

---

## How to exclude this DevSync project from scanning?

### Option 1: Exclude Test Projects (Already Done!)

The workflow is already configured to exclude test projects:

```yaml
paths:
  - '**/*.prisma'
  - '!test-prisma-project/**'  # Excluded
  - '!**/node_modules/**'       # Excluded
  - '!**/dist/**'               # Excluded
```

**Files that WON'T trigger workflow:**
- `test-prisma-project/**` - Test project excluded
- `node_modules/**` - Dependencies excluded
- `dist/**` - Build outputs excluded

### Option 2: Only Scan Specific Directories

If you want to scan only specific projects:

```yaml
on:
  push:
    branches: [main, develop]
    paths:
      # Only scan your actual project
      - 'apps/your-actual-app/**/*.prisma'
      - 'packages/your-package/**/*.prisma'
```

### Option 3: Disable Workflow Completely

If you don't want the workflow to run at all:

1. **Delete the workflow file:**
   ```bash
   rm .github/workflows/devsync-scan.yml
   ```

2. **Or disable it:**
   ```yaml
   jobs:
     scan:
       if: false  # Disable workflow
   ```

---

## What files trigger the workflow?

The workflow runs when you push/PR changes to:

**Triggers:**
- ✅ `**/schema.prisma` - Any schema.prisma file
- ✅ `**/*.prisma` - Any .prisma file
- ✅ `.devsync/**` - DevSync configuration files
- ✅ `.github/workflows/devsync-scan.yml` - Workflow file itself

**Excluded (won't trigger):**
- ❌ `test-prisma-project/**` - Test project
- ❌ `node_modules/**` - Dependencies
- ❌ `dist/**` - Build outputs

---

## Current Workflow Configuration

The workflow is already configured to:
- ✅ Exclude test projects (`test-prisma-project/**`)
- ✅ Exclude dependencies (`node_modules/**`)
- ✅ Handle missing `DATABASE_URL` gracefully
- ✅ Provide helpful error messages

**So if you:**
- Don't set `DATABASE_URL` → Workflow runs but skips migration generation (with warning)
- Set `DATABASE_URL` → Workflow runs and generates migrations

---

## Quick Reference

### Set DATABASE_URL
1. GitHub → Repository → Settings
2. Secrets and variables → Actions
3. New repository secret
4. Name: `DATABASE_URL`
5. Value: `postgresql://user:pass@host:port/db`
6. Add secret

### Exclude Paths
Already done in workflow - test projects are excluded!

### Disable Workflow
Delete or disable `.github/workflows/devsync-scan.yml`

---

## Need Help?

- 📖 [GitHub Actions Guide](./docs/GITHUB_ACTIONS_GUIDE.md) - Complete setup guide
- 📖 [Deployment Checklist](./docs/DEPLOYMENT_CHECKLIST.md) - Deployment guide
- 📖 [Troubleshooting](../apps/dashboard/TROUBLESHOOTING.md) - Troubleshooting guide

