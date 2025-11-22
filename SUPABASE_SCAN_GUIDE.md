# How to Use DevSync with Supabase

## Your Error
```
❌ Error: No schema file found
```

This happens because DevSync needs to know what schema your code expects. Here are your options:

## Option 1: Create Supabase Migration Files (Recommended)

1. **Create the migrations directory:**
   ```bash
   mkdir -p supabase/migrations
   ```

2. **Create a migration file** (e.g., `supabase/migrations/001_initial_schema.sql`):
   ```sql
   -- Example: Create your tables
   CREATE TABLE IF NOT EXISTS users (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     email TEXT UNIQUE NOT NULL,
     name TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );

   CREATE TABLE IF NOT EXISTS posts (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES users(id),
     title TEXT NOT NULL,
     content TEXT,
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

3. **Run scan:**
   ```bash
   devsync scan --db postgresql://user:password@host:5432/dbname
   ```

## Option 2: Use AI Analysis (No Schema Files Needed)

If you don't have migration files, use AI to infer schema from your code:

```bash
# With OpenAI
devsync scan \
  --ai-analysis \
  --openai-api-key sk-... \
  --db postgresql://user:password@host:5432/dbname

# Or with Ollama (free, local)
devsync scan \
  --ai-analysis \
  --use-ollama \
  --db postgresql://user:password@host:5432/dbname
```

The AI will:
- Scan your TypeScript/JavaScript files
- Find database queries (`.from()`, `.select()`, etc.)
- Infer what tables and columns your code expects
- Compare with actual database

## Option 3: Use Prisma Schema

If you're using Prisma:

1. **Create `prisma/schema.prisma`:**
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }

   model User {
     id        String   @id @default(uuid())
     email     String   @unique
     name      String?
     createdAt DateTime @default(now()) @map("created_at")
   }
   ```

2. **Run scan:**
   ```bash
   devsync scan --db postgresql://user:password@host:5432/dbname
   ```

## Getting Your Supabase Connection String

1. Go to your Supabase project dashboard
2. Settings → Database
3. Copy the "Connection string" (use "URI" format)
4. It looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```

## How Database Scanning Works

DevSync connects to your Supabase database (which is PostgreSQL) and:
1. Queries `information_schema.tables` to get all tables
2. Queries `information_schema.columns` to get all columns
3. Queries constraints and indexes
4. Compares with your code schema

**No special Supabase information needed** - it's just PostgreSQL!

## Example Full Command

```bash
# Scan with Supabase connection
devsync scan \
  --path . \
  --db "postgresql://postgres:your-password@db.xxxxx.supabase.co:5432/postgres" \
  --output .devsync/scan-results.json
```

## Troubleshooting

**Error: "No schema file found"**
- Create `supabase/migrations/*.sql` files, OR
- Use `--ai-analysis` flag

**Error: "Cannot connect to database"**
- Check your connection string format
- Verify password is correct
- Check if database is accessible from your network

**Error: "Authentication required"**
- Run `devsync login` first

