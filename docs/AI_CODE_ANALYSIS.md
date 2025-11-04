# 🤖 AI-Powered Code Analysis

## Overview

DevSync now includes **AI-powered code analysis** that reads through your project files and intelligently infers the expected database schema based on code patterns, without relying on migration files.

---

## How It Works

Instead of scanning migration files (`supabase/migrations/*.sql`), the AI analyzer:

1. **Scans your codebase** - Reads through TypeScript/JavaScript files
2. **Identifies patterns** - Finds database queries, ORM usage, table references
3. **Infers schema** - Uses AI (OpenAI) to understand what the database schema should be
4. **Compares** - Compares inferred schema with actual database
5. **Reports mismatches** - Shows differences between what code expects and what database has

---

## Usage

### Basic Usage

```bash
# Enable AI analysis with OpenAI API key
devsync scan --ai-analysis --openai-api-key <your-openai-key> --db <connection-string>

# Or set environment variable
export OPENAI_API_KEY=<your-openai-key>
devsync scan --ai-analysis --db <connection-string>
```

### Example

```bash
# Scan DevSync project itself using AI
devsync scan \
  --ai-analysis \
  --openai-api-key sk-... \
  --db postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres \
  --path .
```

---

## What Gets Analyzed

The AI analyzer looks for:

### 1. Database Queries
- SQL queries (SELECT, INSERT, UPDATE, DELETE)
- Supabase queries (`.from()`, `.select()`, `.insert()`)
- ORM query patterns

### 2. Table References
- Direct table names in queries
- ORM model references
- TypeScript interfaces that map to tables

### 3. Field Access Patterns
- Property access on models
- Field references in queries
- Type definitions

### 4. Code Patterns
- Prisma models (if detected)
- TypeORM entities (if detected)
- Sequelize models (if detected)
- Raw SQL in code

---

## How It Infers Schema

### Step 1: Collect Code Files

Scans these directories (in order):
- `apps/` - Application code
- `packages/` - Package code
- `lib/` - Library code
- `src/` - Source code

**Excludes:**
- `node_modules/`
- `.next/`
- `dist/`
- `build/`
- `test/`, `tests/`, `__tests__/`

### Step 2: Analyze with AI

Sends code files to OpenAI with this prompt:

```
Analyze this codebase and infer the expected database schema.

Focus on:
1. Database queries (SELECT, INSERT, UPDATE, DELETE)
2. ORM model definitions (Prisma, TypeORM, Sequelize, etc.)
3. Table references in code
4. Field access patterns (model.field)
5. Type definitions that indicate database structure

Code files:
[File contents here]

Return a JSON object with this structure:
{
  "models": [
    {
      "name": "table_name",
      "fields": [
        {
          "name": "field_name",
          "type": "postgresql_type",
          "nullable": true/false,
          "primaryKey": true/false
        }
      ]
    }
  ]
}
```

### Step 3: Parse AI Response

Extracts schema from AI response and converts to DevSync's `CodeSchema` format.

### Step 4: Fallback to Pattern Matching

If AI fails or is unavailable, falls back to pattern matching:
- Regex patterns for table names
- Field name extraction
- Type inference

---

## Example: DevSync Project

When scanning the DevSync project itself:

**AI analyzes:**
- `apps/dashboard/app/api/projects/route.ts` → Finds `.from('projects')`
- `apps/dashboard/lib/db-optimizations.ts` → Finds `.from('scan_reports')`
- TypeScript interfaces → Maps to table structures

**Infers schema:**
- `projects` table with fields: `id`, `name`, `slug`, `user_id`, `schema_type`, etc.
- `scan_reports` table with fields: `id`, `project_id`, `status`, `mismatches`, etc.
- `teams`, `team_members`, `migrations`, etc.

**Compares with Supabase database** to find mismatches!

---

## Benefits

### ✅ No Migration Files Needed

Works even if you:
- Don't have migration files
- Have unapplied migrations
- Use direct database changes
- Have messy migration history

### ✅ Understands Your Code

AI reads your actual code and understands:
- How you use the database
- What tables you actually need
- Field relationships

### ✅ Intelligent Inference

AI can:
- Understand context
- Infer types from usage
- Identify relationships
- Handle complex patterns

---

## Limitations

### ⚠️ Requires OpenAI API Key

AI analysis requires:
- OpenAI API key
- Internet connection
- API costs (uses `gpt-4o-mini` - very affordable)

### ⚠️ File Limit

Only analyzes first **100 code files** to:
- Keep costs reasonable
- Stay within token limits
- Provide fast analysis

### ⚠️ May Miss Complex Patterns

Pattern matching fallback may miss:
- Complex relationships
- Dynamic queries
- Generated code

---

## Configuration

### Environment Variables

```bash
export OPENAI_API_KEY=sk-...
```

### CLI Options

```bash
devsync scan \
  --ai-analysis \              # Enable AI analysis
  --openai-api-key <key> \     # OpenAI API key
  --db <connection-string> \   # Database connection
  --path .                     # Project path
```

### Cost Considerations

Uses `gpt-4o-mini` model:
- Very affordable (~$0.15 per 1M input tokens)
- ~$0.60 per 1M output tokens
- Typical scan: $0.01-0.05

---

## Comparison: AI vs Traditional

| Feature | AI Analysis | Traditional (Migrations) |
|---------|-------------|-------------------------|
| No migration files | ✅ Yes | ❌ Needs migrations |
| Understands code | ✅ Yes | ❌ Only reads migrations |
| Complex patterns | ✅ Yes | ⚠️ Limited |
| Cost | ⚠️ Requires API key | ✅ Free |
| Speed | ⚠️ ~5-10 seconds | ✅ Instant |
| Accuracy | ✅ High | ✅ High (if migrations accurate) |

---

## Best Use Cases

**Use AI Analysis when:**
- ✅ You don't have migration files
- ✅ You want to understand code expectations
- ✅ You have complex code patterns
- ✅ Migrations are out of sync

**Use Traditional when:**
- ✅ You have accurate migration files
- ✅ You want fastest analysis
- ✅ No API key available
- ✅ Migrations are up to date

---

## Tips

### 1. Focus on Application Code

AI analyzer prioritizes:
- `apps/` directory
- `src/` directory
- Library code

### 2. Clean Code = Better Analysis

Well-structured code with:
- Clear table names
- Explicit field types
- Type definitions

... leads to better schema inference!

### 3. Use Both Methods

You can:
1. Use AI analysis to discover expected schema
2. Generate migration files
3. Use traditional scanning going forward

---

## Troubleshooting

### Issue: "AI analysis failed"

**Causes:**
- Invalid API key
- Network issues
- API rate limits

**Solution:**
- Check API key validity
- Verify internet connection
- Falls back to pattern matching automatically

### Issue: "No schema inferred"

**Causes:**
- No database queries in code
- Code files not found
- AI couldn't understand patterns

**Solution:**
- Ensure code contains database queries
- Check file paths
- Use traditional scanning with migration files

---

## Future Improvements

Planned enhancements:
- Support for more ORMs
- Better relationship detection
- Type inference improvements
- Cost optimization
- Caching of AI results

---

## Summary

**AI-powered code analysis** allows DevSync to:
- ✅ Analyze codebase without migration files
- ✅ Understand what your code expects from database
- ✅ Compare with actual database schema
- ✅ Find mismatches intelligently

**Perfect for projects without migration files or when migrations are out of sync!**

