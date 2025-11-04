# 🔧 How DevSync Works

## Overview

DevSync is an **AI-powered schema synchronization platform** that automatically detects and fixes mismatches between your codebase and database. It helps developers keep their database schema in sync with their application code, preventing bugs and deployment issues.

---

## 🎯 What DevSync Does

DevSync solves the problem of **schema drift** - when your code expects a certain database structure, but your actual database is different. This happens when:

- Team members make manual database changes
- Migrations are applied incorrectly
- Code is deployed before migrations run
- Schema changes are made directly in production

**DevSync automatically:**
1. ✅ Scans your codebase and database
2. ✅ Detects mismatches
3. ✅ Generates migration scripts
4. ✅ Provides AI-powered explanations
5. ✅ Tracks changes over time

---

## 🏗️ Architecture

DevSync consists of **4 main components**:

```
┌─────────────────────────────────────────────────────────┐
│                    DevSync Platform                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. CLI Tool         2. Dashboard      3. AI Engine     │
│     (Local)            (Web)            (Analysis)      │
│                                                           │
│  4. GitHub Actions                                       │
│     (CI/CD Integration)                                   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 1. CLI Tool (`packages/cli`)

**What it does:**
- Scans your codebase for database schema definitions
- Connects to your database and extracts current schema
- Compares code schema vs database schema
- Generates migration SQL scripts
- Reports mismatches and suggests fixes

**Where it runs:** On your local machine or CI/CD

**Technologies:** TypeScript, Node.js, PostgreSQL client

### 2. Dashboard (`apps/dashboard`)

**What it does:**
- Visual interface for viewing schema mismatches
- Project management (multiple projects, teams)
- Migration execution and rollback
- Scan history and reports
- Team collaboration

**Where it runs:** Web application (Next.js, hosted on Vercel)

**Technologies:** Next.js, React, Supabase, Tailwind CSS

### 3. AI Engine (`packages/ai-reasoner` + `packages/cli/src/services/ai-code-analyzer.ts`)

**What it does:**
- Analyzes code patterns to infer expected schema
- Explains migrations in natural language
- Assesses migration risks
- Answers questions about schema changes

**Where it runs:** Can use OpenAI API or Ollama (local, free)

**Technologies:** OpenAI API, Ollama, Pattern matching fallback

### 4. GitHub Actions Integration (`.github/workflows`)

**What it does:**
- Automatically scans on pull requests
- Comments on PRs with mismatch reports
- Prevents merging if critical mismatches found
- Generates migration previews

**Where it runs:** GitHub Actions (cloud)

**Technologies:** GitHub Actions, YAML workflows

---

## 🔄 Workflow: How It Works Step-by-Step

### Step 1: Code Scanning

**What happens:**
1. DevSync scans your codebase for database schema definitions
2. It looks for:
   - **Prisma schemas** (`prisma/schema.prisma`)
   - **Supabase migrations** (`supabase/migrations/*.sql`)
   - **TypeORM entities** (`@Entity` decorators)
   - **Sequelize models** (`sequelize.define()`)
   - **Raw SQL** in code
   - **AI-powered inference** from code patterns (`.from()`, `.select()`, etc.)

**Example:**
```typescript
// Code expects this table structure:
const { data } = await supabase
  .from('projects')  // ← DevSync detects: projects table
  .select('id, name, user_id')  // ← Detects: id, name, user_id fields
  .eq('user_id', userId);
```

**Output:** A `CodeSchema` object representing what your code expects:

```json
{
  "models": [
    {
      "name": "projects",
      "fields": [
        { "name": "id", "type": "uuid", "primaryKey": true },
        { "name": "name", "type": "text" },
        { "name": "user_id", "type": "uuid" }
      ]
    }
  ]
}
```

### Step 2: Database Scanning

**What happens:**
1. DevSync connects to your database (PostgreSQL, MySQL, SQLite)
2. Queries `information_schema` to extract actual schema
3. Reads:
   - Table names
   - Column names and types
   - Constraints (primary keys, foreign keys, unique)
   - Indexes

**Example SQL query:**
```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

**Output:** A `DbSchema` object representing what your database actually has:

```json
{
  "models": [
    {
      "name": "projects",
      "fields": [
        { "name": "id", "type": "uuid", "primaryKey": true },
        { "name": "name", "type": "text" },
        { "name": "user_id", "type": "uuid" },
        { "name": "created_at", "type": "timestamp" }  // ← Extra field in DB
      ]
    },
    {
      "name": "migrations",  // ← Table in DB but not in code
      "fields": [...]
    }
  ]
}
```

### Step 3: Schema Comparison

**What happens:**
1. DevSync compares `CodeSchema` vs `DbSchema`
2. Detects mismatches:
   - **MISSING_TABLE**: Code expects table, but DB doesn't have it
   - **MISSING_FIELD**: Code expects field, but DB doesn't have it
   - **EXTRA_TABLE**: DB has table, but code doesn't reference it
   - **EXTRA_FIELD**: DB has field, but code doesn't use it
   - **TYPE_MISMATCH**: Field type differs (e.g., `text` vs `uuid`)
   - **CONSTRAINT_MISMATCH**: Primary key, foreign key, or unique constraints differ

**Example comparison:**

```
Code expects:              Database has:
┌─────────────┐          ┌──────────────┐
│ projects    │          │ projects     │
│ - id        │   ✓      │ - id         │ ✓ Match
│ - name      │   ✓      │ - name        │ ✓ Match
│ - user_id   │   ✓      │ - user_id     │ ✓ Match
│             │          │ - created_at │ ⚠️ Extra (info)
│             │          │              │
│ scan_reports│   ✗      │              │ ❌ Missing (error)
└─────────────┘          └──────────────┘
```

**Output:** A `SchemaDiff` with all mismatches:

```json
{
  "mismatches": [
    {
      "type": "missing_table",
      "model": "scan_reports",
      "severity": "error"
    },
    {
      "type": "extra_field",
      "model": "projects",
      "field": "created_at",
      "severity": "info"
    }
  ]
}
```

### Step 4: Migration Generation

**What happens:**
1. DevSync analyzes mismatches
2. Generates SQL migration script to fix them
3. Includes:
   - Safe operations (additions)
   - Risky operations (deletions, type changes)
   - Rollback script

**Example generated migration:**

```sql
-- Migration: Fix schema mismatches
-- Generated: 2025-01-15 10:30:00

-- Create missing table
CREATE TABLE IF NOT EXISTS scan_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_scan_reports_project_id 
  ON scan_reports(project_id);
```

### Step 5: AI Explanation (Optional)

**What happens:**
1. DevSync sends migration to AI (OpenAI or Ollama)
2. AI explains:
   - What the migration does
   - Why it's needed
   - Risks involved
   - Recommendations

**Example AI explanation:**

```
Summary: Adds scan_reports table to track schema scan results

Description:
This migration creates a new 'scan_reports' table to store the results
of schema scans. This allows tracking when mismatches were detected,
what they were, and their status.

Risk Level: Low
- Adding new table is safe
- No data loss
- No downtime

Recommendations:
- Review indexes for performance
- Consider adding RLS policies if using Supabase
```

### Step 6: Execution (Optional)

**What happens:**
1. User reviews migration in dashboard
2. Clicks "Apply Migration"
3. DevSync executes SQL in a transaction
4. Logs execution history
5. Updates database schema

---

## 🤖 AI-Powered Code Analysis

### How AI Analysis Works

Instead of relying on migration files, DevSync can **infer schema from code patterns**:

#### 1. Code Collection

DevSync scans your codebase for:
- TypeScript/JavaScript files (`.ts`, `.tsx`, `.js`, `.jsx`)
- Excludes: `node_modules`, `.next`, `dist`, `build`

#### 2. Pattern Detection

Looks for database query patterns:

```typescript
// Supabase queries
supabase.from('projects').select('id, name')

// SQL queries
SELECT * FROM users WHERE id = ?

// ORM patterns
@Entity('users')
class User { ... }
```

#### 3. AI Inference

**Option A: OpenAI** (cloud, paid)
- Sends code files to GPT-4o-mini
- AI analyzes and returns JSON schema
- Better quality, requires API key

**Option B: Ollama** (local, free)
- Runs LLM locally (llama3.2, qwen2.5, etc.)
- No API costs, completely private
- Requires local installation

**Option C: Pattern Matching** (fallback)
- Regex-based pattern detection
- Extracts table/field names from code
- No AI needed, works offline

#### 4. Schema Extraction

AI/patterns extract:
- Table names (from `.from('table_name')`)
- Field names (from `.select('field1, field2')`)
- Field types (inferred from usage)
- Relationships (from foreign keys)

---

## 📊 Dashboard Features

### Project Management

- **Multiple Projects**: Manage multiple databases/codebases
- **Teams**: Collaborate with team members
- **Roles**: Owner, Admin, Member permissions

### Scan Reports

- **History**: View all past scans
- **Details**: See exact mismatches found
- **Trends**: Track schema changes over time

### Migration Management

- **Preview**: Review migration SQL before applying
- **Execute**: Apply migrations safely
- **Rollback**: Undo migrations if needed
- **History**: Track all migrations applied

### Visual Interface

- **Tables**: See all tables and their fields
- **Mismatches**: Color-coded (error/warning/info)
- **Diff View**: Side-by-side code vs database comparison

---

## 🔗 CLI Integration

### Basic Commands

```bash
# Scan codebase and database
devsync scan \
  --path . \
  --db "postgresql://user:pass@host/db" \
  --output .devsync/results.json

# Generate migration
devsync migrate \
  --path . \
  --db "postgresql://user:pass@host/db" \
  --output .devsync/migration.sql

# Use AI analysis
devsync scan \
  --ai-analysis \
  --use-ollama \
  --ollama-model "llama3.2:3b" \
  --path . \
  --db "postgresql://..."
```

### Options

- `--path`: Codebase directory to scan
- `--db`: Database connection string
- `--ai-analysis`: Enable AI-powered code analysis
- `--use-ollama`: Use Ollama instead of OpenAI
- `--output`: Save results to JSON file
- `--sync`: Upload results to dashboard (optional)

---

## 🔄 GitHub Actions Integration

### Automatic Scanning

**What happens:**
1. Developer creates PR with schema changes
2. GitHub Actions workflow runs automatically
3. DevSync scans changed files
4. Detects mismatches
5. Comments on PR with results

**Workflow file:** `.github/workflows/devsync-scan.yml`

**Example output:**
```
❌ DevSync found 3 mismatches:

1. MISSING_TABLE: scan_reports
2. MISSING_FIELD: projects.deleted_at
3. TYPE_MISMATCH: users.email (text → varchar(255))
```

### CI/CD Benefits

- **Pre-merge checks**: Catch schema mismatches before merging
- **Migration previews**: See generated migrations before deploying
- **Team visibility**: Everyone sees schema changes in PR comments

---

## 🛠️ Supported Technologies

### Database ORMs

- ✅ **Prisma** - `prisma/schema.prisma`
- ✅ **TypeORM** - `@Entity()` decorators
- ✅ **Sequelize** - `sequelize.define()`
- ✅ **Drizzle** - Schema definitions
- ✅ **Raw SQL** - SQL queries in code

### Database Types

- ✅ **PostgreSQL** (primary)
- ✅ **MySQL** (supported)
- ✅ **SQLite** (supported)

### Cloud Providers

- ✅ **Supabase** (primary)
- ✅ **Neon** (PostgreSQL)
- ✅ **Railway** (PostgreSQL)
- ✅ **Custom PostgreSQL**

---

## 📈 Example Workflow

### Scenario: Adding a new feature

**1. Developer writes code:**
```typescript
// New feature needs 'notifications' table
await supabase
  .from('notifications')
  .insert({ user_id, message, read: false });
```

**2. Run DevSync scan:**
```bash
devsync scan --path . --db $DATABASE_URL
```

**3. DevSync detects mismatch:**
```
⚠️ Found 1 mismatch:
  MISSING_TABLE: notifications
```

**4. DevSync generates migration:**
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**5. Developer reviews migration:**
- Opens dashboard
- Reviews migration SQL
- Sees AI explanation: "Creates notifications table for user alerts"

**6. Apply migration:**
- Clicks "Apply Migration"
- Database updated
- Code and DB are now in sync ✅

---

## 🎓 Key Concepts

### Schema Drift

**Definition:** When code expects one schema, but database has another.

**Example:**
- Code expects: `users.email` (TEXT)
- Database has: `users.email` (VARCHAR(255))
- **Result:** Type mismatch (warning)

### Migration Safety

**Safe operations:**
- ✅ Adding new tables
- ✅ Adding new columns (nullable)
- ✅ Adding indexes
- ✅ Adding constraints (if no conflicts)

**Risky operations:**
- ⚠️ Deleting tables/columns (data loss)
- ⚠️ Changing column types (potential data loss)
- ⚠️ Dropping constraints (may break queries)

### AI Fallback

If AI fails (quota, network, memory):
- Falls back to pattern matching
- Still works, just less accurate
- No single point of failure

---

## 🚀 Benefits

### For Developers

- ✅ **Catch bugs early** - Detect schema mismatches before production
- ✅ **Save time** - No manual schema comparison
- ✅ **Stay in sync** - Always know if code matches database

### For Teams

- ✅ **Visibility** - Everyone sees schema changes
- ✅ **Collaboration** - Shared projects and teams
- ✅ **History** - Track all schema changes

### For DevOps

- ✅ **Automation** - CI/CD integration
- ✅ **Safety** - Review migrations before applying
- ✅ **Rollback** - Undo problematic migrations

---

## 📚 Related Documentation

- **[AI Code Analysis](./AI_CODE_ANALYSIS.md)** - How AI infers schema from code
- **[Architecture](./ARCHITECTURE.md)** - Technical architecture details
- **[Ollama Setup](../OLLAMA_SETUP.md)** - Using free local AI
- **[GitHub Actions Setup](./GITHUB_ACTIONS_SETUP.md)** - CI/CD integration
- **[Testing DevSync](./TESTING_DEVSYNC_ON_ITSELF.md)** - Testing DevSync itself

---

## 🎯 Summary

**DevSync = Automated Schema Sync**

1. **Scans** your code and database
2. **Detects** mismatches automatically
3. **Generates** migration SQL
4. **Explains** changes with AI
5. **Tracks** everything in dashboard

**Result:** Your code and database are always in sync! 🎉

---

## 🤔 Questions?

- **How does it know what my code expects?** → Scans Prisma schemas, ORM models, or infers from code patterns
- **Is it safe to use?** → Yes! Reviews migrations before applying, supports rollback
- **Does it cost money?** → Dashboard free, AI optional (can use free Ollama)
- **Does it work offline?** → Yes! CLI works offline, AI optional (Ollama works offline)

---

**Want to get started?** Check out the [Quick Start Guide](../README.md#quick-start)


