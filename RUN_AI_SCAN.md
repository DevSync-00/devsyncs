# 🚀 Quick Command Reference - AI Code Analysis

## The Issue

You used `<` and `>` which bash interprets as redirection operators. You need to **quote** the API key!

## ✅ Correct Commands

### Option 1: Quote the API Key

```bash
node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --openai-api-key "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" \
  --db "postgresql://postgres:Habermian@321@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres" \
  --output .devsync/scan-results.json
```

### Option 2: Use Environment Variable (Safer!)

**Git Bash / Linux / Mac:**
```bash
export OPENAI_API_KEY="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"

node packages/cli/dist/index.js scan \
  --path . \
  --ai-analysis \
  --db "postgresql://postgres:Habermian@321@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres" \
  --output .devsync/scan-results.json
```

**Windows PowerShell:**
```powershell
$env:OPENAI_API_KEY="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"

node packages/cli/dist/index.js scan `
  --path . `
  --ai-analysis `
  --db "postgresql://postgres:Habermian@321@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres" `
  --output .devsync/scan-results.json
```

**Windows CMD:**
```cmd
set OPENAI_API_KEY=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

node packages/cli/dist/index.js scan ^
  --path . ^
  --ai-analysis ^
  --db "postgresql://postgres:Habermian@321@db.lzvaidnvedhzpaczpxlk.supabase.co:5432/postgres" ^
  --output .devsync/scan-results.json
```

## ⚠️ Security Warning

**Your API key is now visible in:**
- Command history
- Terminal output
- Git Bash history

**Recommendation:**
1. Use environment variable (Option 2) - safer
2. **Rotate your API key** after this session for security
3. Go to https://platform.openai.com/api-keys and create a new key
4. Revoke the old one

## What to Expect

```
🔍 Scanning codebase and database...

📁 Scanning codebase...
🤖 Using AI-powered code analysis (skipping migration files)...
✅ Code schema extracted (X models)

🗄️  Scanning database...
✅ Database schema extracted (X tables)

🔬 Comparing schemas...
✅ Comparison complete

✨ No mismatches found! Everything is in sync.
```

## Quick Test

```bash
# Test with environment variable (safest)
export OPENAI_API_KEY="your-key-here"
node packages/cli/dist/index.js scan --path . --ai-analysis --db "your-connection-string"
```

