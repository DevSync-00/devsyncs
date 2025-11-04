# 🔍 What Does DevSync Actually Scan?

## 🤔 Your Question

When you push the **DevSync project itself** to GitHub:
- Which database is it comparing?
- Which codebase is it scanning?
- Is it comparing this project's database with Supabase?

---

## ✅ Quick Answer

**When you push THIS DevSync project:**
- **Nothing is scanned** - Test projects are excluded!
- The workflow won't run (no `.prisma` files trigger it)
- **No comparison happens**

**The Supabase database DevSync uses is:**
- ✅ For DevSync dashboard data only (projects, scans, migrations, users)
- ❌ **NOT** for schema scanning
- ❌ **NOT** for comparing with code

node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --openai-api-key "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" \
  --db "postgresql://postgres.lzvaidnvedhzpaczpxlk:HanibalMejbiri@aws-1-eu-north-1.pooler.supabase.com:5432/postgres" \
  --output .devsync/scan-results.json
## 📊 Two Different Use Cases

### Use Case 1: DevSync Project Itself (This Repo)

**What happens:**
1. You push the DevSync project to GitHub
2. Workflow checks for `.prisma` files
3. Finds `test-prisma-project/prisma/schema.prisma` 
4. **But it's excluded!** (`!test-prisma-project/**`)
5. **Result: Workflow doesn't run** ✅

**What is NOT scanned:**
- ❌ DevSync's own code (no `.prisma` files in main project)
- ❌ Test project (excluded)
- ❌ DevSync's Supabase database (not used for scanning)

**What IS the Supabase database for:**
- ✅ Storing DevSync dashboard data
- ✅ User authentication
- ✅ Project management
- ✅ Scan report storage
- ❌ **NOT** for schema scanning

---

### Use Case 2: Using DevSync on YOUR Other Projects

**What happens:**
1. You copy the workflow to YOUR project
2. You add `DATABASE_URL` secret (YOUR project's database)
3. You push YOUR project to GitHub
4. Workflow scans YOUR project's `.prisma` files
5. Compares YOUR code schema with YOUR database
6. Generates migrations if mismatches found

**What IS scanned:**
- ✅ YOUR project's `.prisma` files
- ✅ YOUR project's code schema
- ✅ YOUR project's database schema

**What is compared:**
- ✅ YOUR code schema vs YOUR database schema
- ✅ Example: Your `schema.prisma` vs Your PostgreSQL database

---

## 🔄 Understanding the Flow

### For THIS DevSync Project

```
Your Push
  ↓
Workflow Trigger Check
  ↓
Looks for .prisma files
  ↓
Finds test-prisma-project/prisma/schema.prisma
  ↓
BUT: Excluded in workflow! (!test-prisma-project/**)
  ↓
Result: Workflow doesn't run ✅
```

**No scanning happens because:**
- ✅ Test projects are excluded
- ✅ Main DevSync project has no `.prisma` files to scan
- ✅ Workflow won't trigger

---

### For YOUR Other Projects (When Using DevSync)

```
Your Push (to YOUR project)
  ↓
Workflow Trigger Check
  ↓
Looks for .prisma files
  ↓
Finds YOUR project's schema.prisma
  ↓
Workflow runs! ✅
  ↓
Scans YOUR schema.prisma
  ↓
Connects to YOUR database (DATABASE_URL)
  ↓
Compares: YOUR code vs YOUR database
  ↓
Generates migrations if mismatches found
```

**What gets compared:**
- ✅ YOUR `schema.prisma` (code)
- ✅ YOUR PostgreSQL/MySQL/etc database (database)
- ✅ Example: `model User { id String }` vs `CREATE TABLE User (id TEXT)`

---

## 🗄️ Two Different Databases

### 1. DevSync Dashboard Database (Supabase)

**What it is:**
- DevSync's own database for dashboard functionality
- Stored in Supabase

**What it stores:**
- ✅ DevSync projects (metadata)
- ✅ Scan reports
- ✅ Migration history
- ✅ User accounts
- ✅ Teams and members

**What it does NOT do:**
- ❌ Schema scanning
- ❌ Code comparison
- ❌ Migration generation for your projects

**When it's used:**
- Dashboard displays projects and scans
- API stores scan results
- User authentication

---

### 2. YOUR Project's Database (DATABASE_URL)

**What it is:**
- YOUR actual project's database
- The one YOUR application uses

**What it stores:**
- ✅ YOUR application data
- ✅ YOUR tables and schemas
- ✅ Example: User table, Post table, etc.

**What it DOES:**
- ✅ Schema scanning (compared with code)
- ✅ Code comparison (vs database)
- ✅ Migration generation

**When it's used:**
- GitHub Actions workflow scans YOUR database
- Compares with YOUR code schema
- Generates migrations for YOUR project

---

## 🎯 Practical Example

### Scenario: You Have a Project "MyApp"

**MyApp Setup:**
```
my-app/
├── prisma/
│   └── schema.prisma       # Your code schema
└── Uses PostgreSQL database  # Your database
```

**DevSync Setup:**
```
devsync/
├── .github/workflows/
│   └── devsync-scan.yml     # Copied to MyApp
└── Uses Supabase            # DevSync dashboard only
```

**What Happens:**

1. **You copy workflow to MyApp**
   ```bash
   cp devsync/.github/workflows/devsync-scan.yml my-app/.github/workflows/
   ```

2. **You add DATABASE_URL secret to MyApp repo**
   - Name: `DATABASE_URL`
   - Value: **MyApp's PostgreSQL connection string** (not DevSync's Supabase!)

3. **You push MyApp to GitHub**
   - Workflow scans `my-app/prisma/schema.prisma`
   - Connects to **MyApp's PostgreSQL database**
   - Compares: MyApp's code schema vs MyApp's database
   - Generates migrations if mismatches found

**What is compared:**
- ✅ MyApp's `schema.prisma` (code)
- ✅ MyApp's PostgreSQL database (database)
- ❌ **NOT** DevSync's Supabase database

---

## ❓ Common Questions

### Q: When I push DevSync project, what database is it comparing?

**A:** **Nothing!** The workflow doesn't run because:
- Test projects are excluded (`!test-prisma-project/**`)
- Main DevSync project has no `.prisma` files
- Workflow won't trigger

### Q: Is it comparing with DevSync's Supabase database?

**A:** **NO!** DevSync's Supabase database is:
- ✅ For dashboard data only
- ❌ **NOT** used for schema scanning
- ❌ **NOT** compared with code

### Q: What database should I use for DATABASE_URL?

**A:** **YOUR PROJECT'S database**, not DevSync's:
- ✅ If your project uses Supabase → Use your project's Supabase database
- ✅ If your project uses PostgreSQL → Use your project's PostgreSQL
- ❌ **NOT** DevSync's Supabase database

### Q: Can I use DevSync's Supabase for DATABASE_URL?

**A:** **NO!** That would:
- ❌ Try to scan DevSync's dashboard database (wrong database!)
- ❌ Compare it with wrong schema files
- ❌ Won't work correctly

### Q: What if I want to scan this DevSync project itself?

**A:** You would need:
- ✅ A separate database that matches test-prisma-project's schema
- ✅ Remove the exclusion from workflow
- ✅ Add that database's connection string to DATABASE_URL

**But**: Most people don't need this - you'd scan your actual projects, not DevSync itself!

---

## 📋 Summary

### For THIS DevSync Project

**What happens:**
- ❌ Nothing is scanned (test projects excluded)
- ❌ Workflow doesn't run
- ❌ No database comparison

**Supabase database:**
- ✅ Used for DevSync dashboard only
- ❌ **NOT** used for scanning

### For YOUR Other Projects

**What happens:**
- ✅ YOUR project's code is scanned
- ✅ YOUR project's database is compared
- ✅ Migrations generated if mismatches found

**DATABASE_URL:**
- ✅ Use **YOUR PROJECT'S** database connection string
- ❌ **NOT** DevSync's Supabase URL

---

## 🎯 Key Takeaway

**When using DevSync:**
1. Copy workflow to YOUR project
2. Add **YOUR PROJECT'S** database URL (not DevSync's)
3. Workflow compares **YOUR code** with **YOUR database**
4. DevSync's Supabase is only for dashboard data, not scanning

---

## 📖 Related Documentation

- **[GitHub Actions Setup](./GITHUB_ACTIONS_SETUP.md)** - How to set up workflow
- **[DATABASE_URL Explained](./GITHUB_ACTIONS_DATABASE_URL.md)** - Which database URL to use
- **[GitHub Actions Guide](./GITHUB_ACTIONS_GUIDE.md)** - Complete guide

---

**Remember**: 
- DevSync's Supabase = Dashboard data only
- DATABASE_URL = YOUR project's database
- Workflow compares YOUR code with YOUR database

