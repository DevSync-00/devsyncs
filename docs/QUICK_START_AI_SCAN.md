# 🚀 Quick Start: AI Code Analysis

## The Problem

You're getting this error:
```
❌ Error: No schema file found. Looking for:
  - prisma/schema.prisma
  - Supabase migrations (supabase/migrations/*.sql)
  ...
```

**Reason:** Your `supabase/migrations/` directory is empty (no SQL files).

---

## The Solution: Use AI Code Analysis

Instead of scanning migration files, use **AI-powered code analysis** to infer the schema from your codebase!

---

## Step-by-Step

### 1. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create account
3. Click **"Create new secret key"**
4. Copy the key (starts with `sk-...`)

### 2. Run Scan with AI Analysis

```bash
node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --openai-api-key sk-... \
  --db "postgresql://postgres:Habermian@321@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres" \
  --output .devsync/scan-results.json
```

### 3. Or Set Environment Variable

```bash
# Set environment variable (Windows PowerShell)
$env:OPENAI_API_KEY="sk-..."

# Or (Windows CMD)
set OPENAI_API_KEY=sk-...

# Or (Git Bash)
export OPENAI_API_KEY=sk-...

# Then run
node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --db "postgresql://postgres:Habermian@321@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres" \
  --output .devsync/scan-results.json
```

---

## What AI Analysis Does

1. **Scans your codebase:**
   - `apps/dashboard/` - Your dashboard code
   - `packages/` - Your packages
   - `lib/` - Libraries
   - `src/` - Source code

2. **Finds database patterns:**
   - Supabase queries (`.from('projects')`)
   - Table references
   - Field access patterns
   - Type definitions

3. **Infers schema:**
   - Uses AI to understand what tables/fields your code expects
   - Creates schema based on code patterns

4. **Compares with database:**
   - Compares inferred schema with actual Supabase database
   - Finds mismatches

---

## Expected Output

```
🔍 Scanning codebase and database...

📁 Scanning codebase...
🤖 Using AI-powered code analysis...
✅ Code schema extracted (5 models)

🗄️  Scanning database...
✅ Database schema extracted (5 tables)

🔬 Comparing schemas...
✅ Comparison complete

✨ No mismatches found! Everything is in sync.
```

---

## Cost

Uses `gpt-4o-mini` model:
- Very affordable (~$0.15 per 1M input tokens)
- Typical scan: $0.01-0.05 per run

---

## Troubleshooting

### Issue: "OpenAI API key not configured"

**Solution:** Make sure you:
- Added `--openai-api-key` flag, OR
- Set `OPENAI_API_KEY` environment variable

### Issue: "AI analysis failed"

**Solution:** 
- Check your OpenAI API key is valid
- Check you have internet connection
- Falls back to pattern matching automatically

---

## Alternative: Create Migration Files

If you don't want to use AI analysis, you can create migration files:

1. **Create `supabase/migrations/` directory** (already exists ✅)
2. **Create SQL files** with your schema
3. **Run scan normally** (without `--ai-analysis`)

But **AI analysis is easier** - no migration files needed!

---

## Summary

**Quick fix:**
```bash
node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --openai-api-key <your-key> \
  --db "your-connection-string"
```

That's it! 🎉

