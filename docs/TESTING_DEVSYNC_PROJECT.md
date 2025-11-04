# 🧪 Testing DevSync Project Itself

## 🎯 Goal

Test the DevSync project itself for schema mismatches between:
- Test project's schema files (e.g., `test-prisma-project/prisma/schema.prisma`)
- Test database schema

---

## 📋 Prerequisites

1. **A test database** that matches the test project's schema
2. **Database connection string** for the test database
3. **Workflow modifications** to include test projects (or manual CLI testing)

---

## 🚀 Option 1: Manual CLI Testing (Recommended for Quick Testing)

### Step 1: Set Up Test Database

1. **Create a PostgreSQL database** (can use Supabase free tier)
2. **Run migrations** to create tables matching `test-prisma-project/prisma/schema.prisma`
3. **Get connection string**:
   ```
   postgresql://postgres:password@host:port/database
   ```

### Step 2: Test Using CLI Locally

```bash
# Navigate to project root
cd path/to/stacksync-copilot

# Build CLI
cd packages/cli
npm run build

# Run scan on test project
node dist/index.js scan \
  --path ../../test-prisma-project \
  --db "postgresql://postgres:password@host:port/database" \
  --output ../../.devsync/scan-results.json

# Check results
cat ../../.devsync/scan-results.json
```

### Step 3: Test with Migration Generation

```bash
# Generate migration if mismatches found
node dist/index.js migrate \
  --path ../../test-prisma-project \
  --db "postgresql://postgres:password@host:port/database" \
  --output ../../.devsync/migrations/test-migration.sql \
  --dry-run
```

---

## 🚀 Option 2: GitHub Actions Testing (For CI/CD Testing)

### Step 1: Create Test Database

1. **Set up a PostgreSQL database** (Supabase, Railway, etc.)
2. **Run migrations** to create tables matching `test-prisma-project/prisma/schema.prisma`
3. **Get connection string**

### Step 2: Modify Workflow to Include Test Project

Edit `.github/workflows/devsync-scan.yml`:

**Before:**
```yaml
paths:
  - '**/*.prisma'
  - '!test-prisma-project/**'  # Excluded
```

**After:**
```yaml
paths:
  - '**/*.prisma'
  # Remove exclusion to test test-prisma-project
  # - '!test-prisma-project/**'
```

### Step 3: Add DATABASE_URL Secret

1. **Go to GitHub repository**
   - Navigate to: **Settings** → **Secrets and variables** → **Actions**

2. **Add secret:**
   - **Name**: `DATABASE_URL`
   - **Value**: Your test database connection string
     ```
     postgresql://postgres:password@host:port/database
     ```

3. **Save**

### Step 4: Trigger Workflow

1. **Make a change** to `test-prisma-project/prisma/schema.prisma`
2. **Commit and push**:
   ```bash
   git add test-prisma-project/prisma/schema.prisma
   git commit -m "test: trigger DevSync scan"
   git push
   ```
3. **Check workflow run** in GitHub Actions tab

---

## 🧪 Creating Test Scenarios

### Scenario 1: Missing Field (Code Has, DB Doesn't)

1. **Edit schema** (`test-prisma-project/prisma/schema.prisma`):
   ```prisma
   model User {
     id        String   @id @default(uuid())
     email     String   @unique
     name      String?
     age       Int?     // Add this field
     createdAt DateTime @default(now())
   }
   ```

2. **Don't run migration** (leave database without `age` column)

3. **Run scan**:
   ```bash
   node packages/cli/dist/index.js scan \
     --path test-prisma-project \
     --db "postgresql://..."
   ```

4. **Expected result**: Mismatch detected - missing `age` column

### Scenario 2: Extra Field (DB Has, Code Doesn't)

1. **Manually add column to database**:
   ```sql
   ALTER TABLE "User" ADD COLUMN "phone" TEXT;
   ```

2. **Don't update schema.prisma** (leave schema without `phone` field)

3. **Run scan**:
   ```bash
   node packages/cli/dist/index.js scan \
     --path test-prisma-project \
     --db "postgresql://..."
   ```

4. **Expected result**: Mismatch detected - extra `phone` column in database

### Scenario 3: Type Mismatch

1. **Edit schema**:
   ```prisma
   model User {
     id        String   @id @default(uuid())
     email     String   @unique
     age       Int?     // Change from String to Int
   }
   ```

2. **Database has** `age TEXT` (old type)

3. **Run scan**:
   ```bash
   node packages/cli/dist/index.js scan \
     --path test-prisma-project \
     --db "postgresql://..."
   ```

4. **Expected result**: Mismatch detected - type mismatch

---

## 🗄️ Setting Up Test Database

### Option 1: Supabase (Free Tier)

1. **Create Supabase project**
2. **Go to SQL Editor**
3. **Run this SQL** to create test tables:
   ```sql
   -- Create User table
   CREATE TABLE "User" (
     "id" TEXT PRIMARY KEY,
     "email" TEXT UNIQUE NOT NULL,
     "name" TEXT,
     "age" INTEGER,
     "createdAt" TIMESTAMP DEFAULT NOW(),
     "updatedAt" TIMESTAMP DEFAULT NOW()
   );

   -- Create Post table
   CREATE TABLE "Post" (
     "id" TEXT PRIMARY KEY,
     "title" TEXT NOT NULL,
     "content" TEXT,
     "published" BOOLEAN DEFAULT false,
     "publishedAt" TIMESTAMP,
     "authorId" TEXT NOT NULL,
     "createdAt" TIMESTAMP DEFAULT NOW(),
     "updatedAt" TIMESTAMP DEFAULT NOW(),
     FOREIGN KEY ("authorId") REFERENCES "User"("id")
   );
   ```

4. **Get connection string**:
   - Go to **Settings** → **Database**
   - Copy **Connection string** (URI format)
   - Replace `[YOUR-PASSWORD]` with your actual password

### Option 2: Local PostgreSQL

1. **Install PostgreSQL** (if not installed)

2. **Create database**:
   ```bash
   createdb devsync_test
   ```

3. **Create tables** (same SQL as above)

4. **Connection string**:
   ```
   postgresql://postgres:password@localhost:5432/devsync_test
   ```

### Option 3: Docker

1. **Run PostgreSQL container**:
   ```bash
   docker run --name devsync-test-db \
     -e POSTGRES_PASSWORD=password \
     -e POSTGRES_DB=devsync_test \
     -p 5432:5432 \
     -d postgres:15
   ```

2. **Create tables** (same SQL as above)

3. **Connection string**:
   ```
   postgresql://postgres:password@localhost:5432/devsync_test
   ```

---

## 🔍 Verifying Test Results

### Check Scan Results

```bash
# View scan results
cat .devsync/scan-results.json | jq

# Or if no jq:
cat .devsync/scan-results.json
```

**Expected output** (if mismatches found):
```json
{
  "mismatches": [
    {
      "type": "MISSING_FIELD",
      "model": "User",
      "field": "age",
      "severity": "error",
      "suggestedFix": "ALTER TABLE \"User\" ADD COLUMN \"age\" INTEGER;"
    }
  ]
}
```

### Check Migration Generation

```bash
# View generated migration
cat .devsync/migrations/test-migration.sql
```

**Expected output** (if mismatches found):
```sql
-- Migration generated by DevSync
ALTER TABLE "User" ADD COLUMN "age" INTEGER;
```

---

## 📝 Workflow Configuration

### Temporary Workflow for Testing

Create `.github/workflows/devsync-test.yml`:

```yaml
name: DevSync Test Project Scan

on:
  workflow_dispatch:  # Manual trigger
  push:
    branches: [main, develop]
    paths:
      - 'test-prisma-project/**/*.prisma'

jobs:
  test-scan:
    name: Test DevSync on Test Project
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

      - name: Run DevSync Scan on Test Project
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          echo "::group::Scanning test project..."
          node packages/cli/dist/index.js scan \
            --path test-prisma-project \
            --db "$DATABASE_URL" \
            --output .devsync/scan-results.json
          echo "::endgroup::"

      - name: Display Results
        run: |
          echo "::group::Scan Results"
          cat .devsync/scan-results.json | jq . || cat .devsync/scan-results.json
          echo "::endgroup::"
```

**Benefits:**
- ✅ Separate workflow for testing
- ✅ Only triggers on test project changes
- ✅ Manual trigger option (`workflow_dispatch`)
- ✅ Doesn't interfere with main workflow

---

## 🔄 Restoring Original Configuration

After testing, restore the exclusion:

```yaml
paths:
  - '**/*.prisma'
  - '!test-prisma-project/**'  # Re-add exclusion
```

---

## ✅ Quick Test Checklist

- [ ] Set up test database
- [ ] Get database connection string
- [ ] Build CLI: `cd packages/cli && npm run build`
- [ ] Run scan: `node dist/index.js scan --path ../../test-prisma-project --db "..."`
- [ ] Check results in `.devsync/scan-results.json`
- [ ] (Optional) Generate migration: `node dist/index.js migrate --path ../../test-prisma-project --db "..."`
- [ ] (Optional) Test in GitHub Actions by modifying workflow

---

## 📖 Related Documentation

- **[GitHub Actions Setup](./GITHUB_ACTIONS_SETUP.md)** - Setting up GitHub Actions
- **[What Does DevSync Scan](./WHAT_DOES_DEVSYNC_SCAN.md)** - Understanding what gets scanned
- **[CLI Documentation](../packages/cli/README.md)** - CLI usage guide

---

## 🎯 Summary

**Quick Test (Local):**
1. Set up test database
2. Build CLI: `cd packages/cli && npm run build`
3. Run scan: `node dist/index.js scan --path test-prisma-project --db "connection-string"`

**CI/CD Test (GitHub Actions):**
1. Create separate test workflow (or modify main one temporarily)
2. Add `DATABASE_URL` secret (test database)
3. Remove exclusion: `!test-prisma-project/**`
4. Push changes to trigger workflow

**Remember**: Restore exclusions after testing if you modified the main workflow!

