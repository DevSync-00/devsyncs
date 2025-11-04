# 🎯 Testing DevSync on Itself (Eating Your Own Dog Food!)

## 🎪 The Concept

Test DevSync by comparing:
- **Code Schema**: `supabase/migrations/*.sql` files (DevSync's migration files)
- **Database Schema**: DevSync's actual Supabase database

This tests DevSync's **Raw SQL / Supabase migration scanner** on real migrations!

---

## ✅ Prerequisites

1. **DevSync Supabase database** (your dashboard database)
2. **Supabase connection string** (your DevSync dashboard database)
3. **Migration files** in `supabase/migrations/` (should exist if you've created any)

---

## 🚀 Option 1: Manual CLI Testing (Recommended)

### Step 1: Get Your Supabase Connection String

1. **Go to Supabase Dashboard**
   - Navigate to your DevSync project on Supabase

2. **Get Connection String**
   - Go to **Settings** → **Database**
   - Copy **Connection string** (URI format)
   - Example: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`
   - **Replace** `[YOUR-PASSWORD]` with your actual database password

### Step 2: Build CLI

```bash
cd packages/cli
npm run build
```

### Step 3: Run Scan on DevSync Project

```bash
# From project root
node packages/cli/dist/index.js scan \
  --path . \
  --db "postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres" \
  --output .devsync/scan-results.json
```

**This will:**
- ✅ Scan `supabase/migrations/*.sql` files (code schema)
- ✅ Connect to your Supabase database (database schema)
- ✅ Compare them and find mismatches

### Step 4: Check Results

```bash
# View results
cat .devsync/scan-results.json | jq

# Or without jq:
cat .devsync/scan-results.json
```

**Expected output** (if mismatches found):
```json
{
  "mismatches": [
    {
      "type": "MISSING_FIELD",
      "model": "projects",
      "field": "some_field",
      "severity": "error",
      "suggestedFix": "ALTER TABLE \"projects\" ADD COLUMN \"some_field\" TEXT;"
    }
  ]
}
```

### Step 5: Generate Migration (if mismatches found)

```bash
node packages/cli/dist/index.js migrate \
  --path . \
  --db "postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres" \
  --output .devsync/migrations/devsync-self-migration.sql \
  --dry-run
```

---

## 🚀 Option 2: GitHub Actions Testing

### Step 1: Add DATABASE_URL Secret

1. **Go to GitHub repository**
   - Navigate to: **Settings** → **Secrets and variables** → **Actions**

2. **Add secret:**
   - **Name**: `DATABASE_URL`
   - **Value**: Your DevSync Supabase connection string
     ```
     postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
     ```

3. **Save**

### Step 2: Modify Workflow to Scan This Project

Edit `.github/workflows/devsync-scan.yml`:

**Add this to paths:**
```yaml
paths:
  - '**/*.prisma'
  - 'supabase/migrations/**/*.sql'  # Add this!
  - '.devsync/**'
```

**Or modify to specifically scan supabase migrations:**
```yaml
on:
  push:
    branches: [main, develop]
    paths:
      - 'supabase/migrations/**/*.sql'  # Only Supabase migrations
      - '.github/workflows/devsync-scan.yml'
```

### Step 3: Trigger Workflow

1. **Make a change** to `supabase/migrations/` (add a new migration file or modify existing one)
2. **Commit and push**:
   ```bash
   git add supabase/migrations/
   git commit -m "test: trigger DevSync self-scan"
   git push
   ```
3. **Check workflow run** in GitHub Actions tab

---

## 🔍 Understanding What Gets Scanned

### Code Schema (from migrations)

DevSync will scan:
- ✅ `supabase/migrations/*.sql` files
- ✅ Extract `CREATE TABLE` statements
- ✅ Extract `ALTER TABLE` statements
- ✅ Merge all tables from multiple migrations

### Database Schema (from Supabase)

DevSync will:
- ✅ Connect to your Supabase database
- ✅ Query `information_schema` for actual tables
- ✅ Compare with code schema

---

## 📊 What Tables Should Be Scanned?

Based on DevSync's schema, you should have these tables:

### Core Tables
- `projects` - DevSync projects
- `scan_reports` - Scan results
- `migrations` - Migration history
- `migration_executions` - Migration execution tracking
- `teams` - Team management
- `team_members` - Team membership
- `users` - User profiles (from Supabase Auth)

### Check Your Database

Run this in Supabase SQL Editor to see your tables:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

---

## 🧪 Creating Test Scenarios

### Scenario 1: Missing Migration File

1. **Add a column directly to database** (without creating migration file):
   ```sql
   -- Run in Supabase SQL Editor
   ALTER TABLE "projects" ADD COLUMN "test_field" TEXT;
   ```

2. **Don't create a migration file** for this change

3. **Run scan**:
   ```bash
   node packages/cli/dist/index.js scan \
     --path . \
     --db "postgresql://..."
   ```

4. **Expected result**: Mismatch detected - `test_field` exists in DB but not in migrations

### Scenario 2: Unapplied Migration

1. **Create a new migration file** `supabase/migrations/007_add_test_column.sql`:
   ```sql
   ALTER TABLE "projects" ADD COLUMN "test_field_2" TEXT;
   ```

2. **Don't run this migration** on database

3. **Run scan**:
   ```bash
   node packages/cli/dist/index.js scan \
     --path . \
     --db "postgresql://..."
   ```

4. **Expected result**: Mismatch detected - `test_field_2` exists in migrations but not in DB

### Scenario 3: Type Mismatch

1. **Create migration file** with different type:
   ```sql
   -- Migration says TEXT
   ALTER TABLE "projects" ADD COLUMN "age" TEXT;
   ```

2. **Database has** `INTEGER` (manually changed)

3. **Run scan**:
   ```bash
   node packages/cli/dist/index.js scan \
     --path . \
     --db "postgresql://..."
   ```

4. **Expected result**: Mismatch detected - type mismatch

---

## 🔧 Troubleshooting

### Issue: "No schema files found"

**Problem**: DevSync can't find `supabase/migrations/*.sql` files

**Solutions**:
1. **Check if migrations directory exists**:
   ```bash
   ls supabase/migrations/
   ```

2. **Create a test migration file**:
   ```bash
   mkdir -p supabase/migrations
   touch supabase/migrations/001_test.sql
   ```

3. **Ensure migration files have CREATE TABLE statements**

### Issue: "Cannot connect to database"

**Problem**: Connection string is incorrect or database is not accessible

**Solutions**:
1. **Verify connection string format**:
   ```
   postgresql://user:password@host:port/database
   ```

2. **Test connection manually**:
   ```bash
   psql "postgresql://user:password@host:port/database"
   ```

3. **Check Supabase firewall** (might need to whitelist IPs)

### Issue: "No mismatches found" (but you know there are)

**Problem**: Scanner might not be detecting Supabase migrations correctly

**Solutions**:
1. **Check scanner priority** - Supabase migrations should be detected as "Raw SQL"
2. **Verify migration file location** - Should be in `supabase/migrations/`
3. **Check migration file content** - Should have `CREATE TABLE` or `ALTER TABLE` statements

---

## 📝 Workflow Configuration Example

### Create Separate Workflow for Self-Testing

Create `.github/workflows/devsync-self-test.yml`:

```yaml
name: DevSync Self-Test

on:
  workflow_dispatch:  # Manual trigger
  push:
    branches: [main, develop]
    paths:
      - 'supabase/migrations/**/*.sql'
      - '.github/workflows/devsync-self-test.yml'

jobs:
  self-test:
    name: Test DevSync on Itself
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: |
          cd packages/cli
          npm ci

      - name: Build DevSync CLI
        run: |
          cd packages/cli
          npm run build

      - name: Create .devsync directory
        run: |
          mkdir -p .devsync/migrations

      - name: Run DevSync Self-Scan
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          echo "::group::Scanning DevSync migrations vs database..."
          node packages/cli/dist/index.js scan \
            --path . \
            --db "$DATABASE_URL" \
            --output .devsync/scan-results.json
          echo "::endgroup::"

      - name: Display Results
        run: |
          echo "::group::Self-Test Results"
          cat .devsync/scan-results.json | jq . || cat .devsync/scan-results.json
          echo "::endgroup::"

      - name: Generate Migration (if mismatches)
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          if [ -n "$DATABASE_URL" ]; then
            echo "::group::Generating migration..."
            node packages/cli/dist/index.js migrate \
              --path . \
              --db "$DATABASE_URL" \
              --output .devsync/migrations/self-fix_${GITHUB_SHA}.sql \
              --dry-run
            echo "::endgroup::"
          fi
```

**Benefits:**
- ✅ Separate workflow for self-testing
- ✅ Only triggers on Supabase migration changes
- ✅ Manual trigger option (`workflow_dispatch`)
- ✅ Doesn't interfere with main workflow

---

## ✅ Quick Test Checklist

- [ ] Get Supabase connection string (DevSync dashboard database)
- [ ] Verify `supabase/migrations/` directory exists
- [ ] Build CLI: `cd packages/cli && npm run build`
- [ ] Run scan: `node dist/index.js scan --path ../.. --db "connection-string"`
- [ ] Check results in `.devsync/scan-results.json`
- [ ] (Optional) Generate migration if mismatches found
- [ ] (Optional) Set up GitHub Actions self-test workflow

---

## 🎉 The Irony

You're using DevSync to scan DevSync's own schema! This is:
- ✅ **Meta-testing** - Testing the tool on itself
- ✅ **Real-world validation** - Using actual migrations
- ✅ **Dog-fooding** - Eating your own dog food
- ✅ **Fun** - Testing your own medicine! 😄

---

## 📖 Related Documentation

- **[Testing DevSync Project](./TESTING_DEVSYNC_PROJECT.md)** - Testing with test-prisma-project
- **[What Does DevSync Scan](./WHAT_DOES_DEVSYNC_SCAN.md)** - Understanding what gets scanned
- **[GitHub Actions Setup](../docs/GITHUB_ACTIONS_SETUP.md)** - Setting up GitHub Actions

---

## 🎯 Summary

**To test DevSync on itself:**

1. **Get your Supabase connection string** (DevSync dashboard database)
2. **Scan**: `devsync scan --path . --db "your-supabase-connection-string"`
3. **Compare**: Supabase migrations vs actual Supabase database
4. **Find mismatches**: See if migrations match database!

**It's like using DevSync to verify DevSync is working correctly!** 🎪

