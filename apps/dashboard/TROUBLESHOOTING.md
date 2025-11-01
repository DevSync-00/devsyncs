# Troubleshooting Guide

## Common Issues

### 500 Error When Creating Project

If you get a `500 Internal Server Error` when trying to create a project, check the following:

#### 1. Database Migrations Not Run

**Problem**: The `projects` table or constraints don't exist.

**Solution**: Run all database migrations in order:

```sql
-- Run these in Supabase SQL Editor:

-- 1. Initial schema
-- Copy and run: supabase/migrations/001_initial_schema.sql

-- 2. Update schema types
-- Copy and run: supabase/migrations/002_update_schema_types.sql

-- 3. Migration execution tracking
-- Copy and run: supabase/migrations/003_add_migration_execution_tracking.sql

-- 4. Fix RLS policies
-- Copy and run: supabase/migrations/004_fix_rls_policies.sql
```

#### 2. RLS Policy Blocking INSERT

**Problem**: Row Level Security (RLS) is preventing inserts.

**Solution**: Run this SQL in Supabase SQL Editor:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'projects';

-- Ensure INSERT policy exists
DROP POLICY IF EXISTS "Users can create own projects" ON projects;

CREATE POLICY "Users can create own projects"
  ON projects FOR INSERT
  WITH CHECK (user_id = auth.uid());
```

#### 3. Missing Constraint

**Problem**: The `schema_type` constraint might be missing or incorrect.

**Solution**: Run this SQL:

```sql
-- Drop old constraint if exists
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_schema_type_check;

-- Add correct constraint
ALTER TABLE projects 
ADD CONSTRAINT projects_schema_type_check 
CHECK (schema_type IN (
  'prisma',
  'supabase',
  'typeorm',
  'kysely',
  'sequelize',
  'drizzle',
  'django',
  'sqlalchemy',
  'raw-sql'
));
```

#### 4. Check Supabase Logs

1. Go to your Supabase Dashboard
2. Navigate to **Logs** → **API Logs**
3. Look for the error message when creating a project
4. Check for specific constraint violations or RLS errors

#### 5. Verify Table Structure

Run this query to verify the projects table structure:

```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'projects'
ORDER BY ordinal_position;
```

Expected columns:
- `id` (UUID, PRIMARY KEY)
- `name` (TEXT, NOT NULL)
- `slug` (TEXT, UNIQUE, NOT NULL)
- `user_id` (UUID, REFERENCES auth.users)
- `team_id` (UUID, nullable)
- `db_connection_string` (TEXT, nullable)
- `schema_type` (TEXT, with CHECK constraint)
- `config` (JSONB, default '{}')
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### Quick Fix Script

Run this complete fix script in Supabase SQL Editor:

```sql
-- Fix RLS policies
DROP POLICY IF EXISTS "Users can create own projects" ON projects;

CREATE POLICY "Users can create own projects"
  ON projects FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Fix schema_type constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_schema_type_check;

ALTER TABLE projects 
ADD CONSTRAINT projects_schema_type_check 
CHECK (schema_type IN (
  'prisma', 'supabase', 'typeorm', 'kysely', 'sequelize', 
  'drizzle', 'django', 'sqlalchemy', 'raw-sql'
));

-- Ensure slug column exists
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
```

### Still Getting Errors?

1. **Check Browser Console**: Look for detailed error messages
2. **Check Network Tab**: See the exact request/response
3. **Check Supabase Dashboard**: Look at API logs for server-side errors
4. **Verify Authentication**: Make sure you're logged in (check `auth.users` table)

