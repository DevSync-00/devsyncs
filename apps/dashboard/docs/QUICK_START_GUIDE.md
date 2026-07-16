# Devsync AI - Quick Start Guide

**Ready to use!** This guide will help you get started with Devsync AI now that all phases are implemented.

---

## 🚀 Quick Start

### 1. Build the CLI

```bash
cd packages/cli
npm install
npm run build
```

### 2. Initialize a Project

```bash
# From your project root
cd /path/to/your-project
node ../../packages/cli/dist/index.js init

# Or if installed globally
devsync init
```

This creates `.devsync/config.json` with safe defaults.

### 3. Scan Your Project

```bash
# Scan for schema sources (read-only, safe)
devsync scan

# Or with JSON output
devsync scan --format json

# Scan a specific path
devsync scan --path /path/to/project
```

**What it does:**
- Detects database connection strings
- Finds schema files (Prisma, SQL, etc.)
- Detects ORM configurations
- Reports findings (read-only)

### 4. Check Schema Status

```bash
# Check schema readiness and conflicts (read-only)
devsync status

# With database connection for conflict detection
devsync status --db postgresql://user:pass@host:port/db

# JSON output
devsync status --format json --db postgresql://...
```

**What it does:**
- Extracts and normalizes schemas (code + database)
- Detects conflicts between code and database
- Reports conflict summary (high/medium/low risk)
- Shows detailed conflict information

### 5. Generate Fix Proposals (Preview Only)

```bash
# Generate fix plan (preview-only, no writes)
devsync fix --db postgresql://user:pass@host:port/db

# Save migration to file
devsync fix --db postgresql://... --output migration.sql

# Include AI reasoning (requires API key)
devsync fix --db postgresql://... \
  --api-key YOUR_OPENAI_KEY \
  --provider openai \
  --model gpt-4

# Include low-risk conflicts
devsync fix --db postgresql://... --include-low-risk

# JSON output
devsync fix --db postgresql://... --format json
```

**What it does:**
- Detects conflicts between code and database schemas
- Uses AI (if API key provided) to explain conflicts
- Generates SQL migration proposals
- Shows safety assessments
- **All fixes are preview-only** (no writes by default)

### 6. Apply Fixes (Blocked by Default)

```bash
# The apply command is blocked for safety
devsync apply
# Shows: "DB writes are disabled by default. Use fix command with explicit opt-in."
```

**Safety Note:** The `apply` command is intentionally blocked. To apply fixes:
1. Use `devsync fix` to generate migration files
2. Review the migration files manually
3. Apply them using your database client or migration tool

---

## 📋 Typical Workflow

### Workflow 1: New Project Setup

```bash
# 1. Initialize Devsync
devsync init

# 2. Scan project to discover schemas
devsync scan

# 3. Check status (without DB connection)
devsync status

# 4. When DB connection is available, check conflicts
devsync status --db postgresql://...

# 5. Generate fixes if conflicts found
devsync fix --db postgresql://... --output migration.sql

# 6. Review migration.sql manually

# 7. Apply migration using your DB tool
psql postgresql://... < migration.sql
```

### Workflow 2: Ongoing Development

```bash
# 1. After making schema changes, check for conflicts
devsync status --db postgresql://...

# 2. If conflicts detected, get AI-powered explanations
devsync fix --db postgresql://... \
  --api-key YOUR_KEY \
  --provider openai \
  --output migration.sql

# 3. Review and apply
```

### Workflow 3: CI/CD Integration

```bash
# In CI pipeline (read-only checks)
devsync scan --format json > scan-results.json
devsync status --db $DATABASE_URL --format json > status.json

# Check for conflicts programmatically
if jq '.conflicts | length > 0' status.json; then
  echo "Schema conflicts detected!"
  exit 1
fi
```

---

## 🔑 Configuration

### Configuration File: `.devsync/config.json`

Created by `devsync init`:

```json
{
  "version": "1.0",
  "project": {
    "name": "your-project",
    "schemaType": "prisma"
  },
  "database": {
    "mode": "auto",
    "connectionString": "",
    "writeAccess": false
  },
  "ai": {
    "provider": "",
    "apiKey": "",
    "model": {
      "reasoning": "",
      "apply": ""
    },
    "ollamaUrl": "http://localhost:11434"
  },
  "safety": {
    "allowWrites": false,
    "allowDbWrites": false,
    "requirePlanApproval": true
  }
}
```

### Environment Variables

Devsync can detect database connection strings from:
- `.env` files
- `.env.local`, `.env.development`, `.env.production`
- `docker-compose.yml`
- Config files

Common patterns detected:
- `DATABASE_URL`
- `POSTGRES_URL`, `POSTGRES_CONNECTION_STRING`
- `DB_URL`, `DB_CONNECTION_STRING`

---

## 🤖 AI Providers

### OpenAI

```bash
devsync fix --db postgresql://... \
  --api-key sk-... \
  --provider openai \
  --model gpt-4
```

### Anthropic (Claude)

```bash
devsync fix --db postgresql://... \
  --api-key sk-ant-... \
  --provider anthropic \
  --model claude-3-opus-20240229
```

### Ollama (Local)

```bash
# Start Ollama locally first
ollama serve

# Use with Devsync
devsync fix --db postgresql://... \
  --provider ollama \
  --model llama3.2:3b \
  --ollama-url http://localhost:11434
```

**Note:** API keys are never stored or sent to external services except the AI provider you specify.

---

## 🛡️ Safety Features

### Read-Only by Default

- ✅ `scan` - Always read-only
- ✅ `status` - Always read-only
- ✅ `fix` - Preview-only (no writes)

### Explicit Opt-In Required

- ✅ Database writes require explicit confirmation
- ✅ File writes require explicit approval
- ✅ All changes are previewed first

### Preview-Only Fixes

- ✅ All fixes generate migration files
- ✅ No automatic application
- ✅ Manual review required

---

## 📊 Output Formats

### Table Format (Default)

Human-readable output for terminal viewing:

```bash
devsync status
devsync scan
```

### JSON Format

Structured output for programmatic use:

```bash
devsync status --format json > status.json
devsync scan --format json > scan.json
devsync fix --format json > fix-proposal.json
```

---

## 🔍 Schema Discovery Priority

Devsync follows a strict discovery priority (per charter):

1. **Database Connection** → Inspects live database (read-only)
2. **Schema Files** → Parses .prisma, .sql, migrations, ORM schemas
3. **Deep Scan** → Infers schema from codebase patterns

This priority is enforced automatically - you don't need to specify it.

---

## 📝 Examples

### Example 1: Prisma Project

```bash
# Project has schema.prisma
devsync scan
# Detects: Prisma schema file

devsync status
# Shows: Code schema from Prisma file

devsync status --db postgresql://...
# Shows: Conflicts between Prisma schema and live database
```

### Example 2: Raw SQL Project

```bash
# Project has SQL migrations
devsync scan
# Detects: SQL migration files

devsync status --db postgresql://...
# Compares SQL migrations with live database
```

### Example 3: TypeORM Project

```bash
# Project uses TypeORM entities
devsync scan
# Detects: TypeORM configuration

devsync status --db postgresql://...
# Compares TypeORM entities with database
```

---

## ❓ Common Questions

### Q: How do I apply migrations?

**A:** Devsync generates migration files but doesn't apply them automatically (for safety). Review the generated SQL and apply using your database client:

```bash
# Generate migration
devsync fix --db postgresql://... --output migration.sql

# Review migration.sql

# Apply manually
psql postgresql://... < migration.sql
```

### Q: Is it safe to run on production databases?

**A:** Yes! All database operations are read-only by default. The `fix` command only generates migration files - it never writes to your database.

### Q: Do I need an API key?

**A:** Not required for basic usage. The `scan` and `status` commands work without AI. The `fix` command can generate migrations without AI, but AI reasoning provides better explanations and recommendations.

### Q: How do I disable AI analysis?

**A:** Just don't provide `--api-key`. The `fix` command will still generate migrations based on detected conflicts, just without AI-powered explanations.

### Q: Can I use this in CI/CD?

**A:** Yes! Use JSON output format for programmatic processing:

```bash
devsync status --format json --db $DATABASE_URL > status.json
# Parse status.json to check for conflicts
```

---

## 🐛 Troubleshooting

### "Database connection failed"

- Check connection string format
- Verify database is accessible
- Check network connectivity
- Review connection string encoding (special chars must be URL-encoded)

### "No schema detected"

- Run `devsync scan` to see what's detected
- Check if schema files are in ignored directories
- Verify schema file formats are supported

### "CLI not found"

- Make sure to build: `npm run build` in `packages/cli`
- Check that `dist/index.js` exists
- Use full path: `node packages/cli/dist/index.js scan`

---

## 📚 Next Steps

1. **Try it on a test project** - Start with a non-critical project
2. **Review the migration files** - Understand what Devsync generates
3. **Test with different schema types** - Prisma, SQL, TypeORM, etc.
4. **Integrate into your workflow** - Add to CI/CD or daily checks

---

## 🔗 Related Documentation

- `DEV_SYNC_PROJECT_CHARTER.md` - Project principles and safety rules
- `PHASE_1_8_IMPLEMENTATION_COMPLETE.md` - Technical implementation details
- `INTEGRATION_VERIFICATION.md` - Integration verification checklist

---

**Ready to sync your schemas!** 🚀

